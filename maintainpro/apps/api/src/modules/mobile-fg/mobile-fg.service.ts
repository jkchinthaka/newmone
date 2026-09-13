import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";

import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { FgSsoService } from "../auth/fg-sso.service";
import { FgDjangoClient, FgUpstreamAuthError } from "./fg-django-client";
import {
  FG_MOBILE_SESSION_TTL_DEFAULT,
  FG_SESSION_STORE,
  type FgSessionStore
} from "./fg-session-store";
import type { FgBrokerSession, FgSessionActor } from "./fg-session.types";

export const CL18_FORM_CODE = "NMS/PPU/CL/18";
export const CL24_FORM_CODE = "NMS/PPU/CL/24";
export const CL30_FORM_CODE = "NMS/PPU/CL/30";
export const CL39_FORM_CODE = "NMS/PPU/CL/39";

export const MOBILE_FG_FORM_CODES = new Set([
  CL18_FORM_CODE,
  CL24_FORM_CODE,
  CL30_FORM_CODE,
  CL39_FORM_CODE
]);

const OCCURRENCE_REQUIRED = new Set([CL18_FORM_CODE, CL30_FORM_CODE]);

const REVIEW_DECISIONS = new Set(["APPROVED", "RETURNED_FOR_CORRECTION"]);
const QA_DECISIONS = new Set(["RELEASE", "HOLD", "REJECT"]);

export type FgAuthedRequest = {
  user: JwtPayload;
  headers?: Record<string, string | string[] | undefined>;
};

@Injectable()
export class MobileFgService {
  constructor(
    private readonly fgSso: FgSsoService,
    private readonly django: FgDjangoClient,
    @Inject(FG_SESSION_STORE) private readonly store: FgSessionStore,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private ttlSeconds(): number {
    const raw = Number(
      this.configService.get<string | number>("FG_MOBILE_SESSION_TTL_SECONDS") ??
        FG_MOBILE_SESSION_TTL_DEFAULT
    );
    if (!Number.isFinite(raw) || raw < 60 || raw > 86_400) {
      return FG_MOBILE_SESSION_TTL_DEFAULT;
    }
    return Math.floor(raw);
  }

  resolveFingerprint(req: FgAuthedRequest): string {
    const raw = req.headers?.authorization ?? req.headers?.Authorization;
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header || typeof header !== "string") {
      throw new UnauthorizedException("Authorization bearer token is required");
    }
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match?.[1]) {
      throw new UnauthorizedException("Authorization bearer token is required");
    }
    return createHash("sha256").update(match[1].trim()).digest("hex").slice(0, 32);
  }

  sessionStoreKey(tenantId: string, userId: string, fingerprint: string): string {
    return `${tenantId}|${userId}|${fingerprint}`;
  }

  private actorIds(user: JwtPayload): { tenantId: string; userId: string } {
    const userId = String(user?.sub ?? "").trim();
    if (!userId) {
      throw new UnauthorizedException("Authenticated user context is required");
    }
    const tenantId = String(user.tenantId ?? "").trim() || "none";
    return { tenantId, userId };
  }

  async ensureSession(user: JwtPayload, fingerprint: string): Promise<FgBrokerSession> {
    const { tenantId, userId } = this.actorIds(user);
    const key = this.sessionStoreKey(tenantId, userId, fingerprint);
    const existing = await this.store.get(key);
    if (existing && existing.expiresAtMs > Date.now()) {
      return existing;
    }

    const { assertion } = await this.fgSso.exchangeForUser(userId);
    try {
      const boot = await this.django.bootstrapSession(assertion);
      const now = Date.now();
      const ttlMs = this.ttlSeconds() * 1000;
      const session: FgBrokerSession = {
        tenantId,
        userId,
        accessTokenFingerprint: fingerprint,
        sessionCookieName: boot.session.sessionCookieName,
        sessionCookieValue: boot.session.sessionCookieValue,
        csrfCookieName: boot.session.csrfCookieName,
        csrfCookieValue: boot.session.csrfCookieValue,
        csrfToken: boot.session.csrfToken,
        expiresAtMs: now + ttlMs,
        createdAtMs: now,
        refreshedAtMs: now
      };
      await this.store.set(key, session, this.ttlSeconds());
      return session;
    } finally {
      // Assertion must never linger in store or response.
      void assertion;
    }
  }

  async clearSession(user: JwtPayload, fingerprint: string): Promise<void> {
    const { tenantId, userId } = this.actorIds(user);
    await this.store.delete(this.sessionStoreKey(tenantId, userId, fingerprint));
  }

  /**
   * Ensure broker session, invoke fn. On FgUpstreamAuthError: clear store,
   * rebootstrap once, retry the same request once.
   */
  async withSession<T>(
    req: FgAuthedRequest,
    fn: (session: FgBrokerSession) => Promise<T>
  ): Promise<T> {
    const fingerprint = this.resolveFingerprint(req);
    let session = await this.ensureSession(req.user, fingerprint);
    try {
      return await fn(session);
    } catch (err) {
      if (!(err instanceof FgUpstreamAuthError)) {
        throw err;
      }
      await this.clearSession(req.user, fingerprint);
      session = await this.ensureSession(req.user, fingerprint);
      return fn(session);
    }
  }

  private safeSessionResponse(session: FgBrokerSession, actor: FgSessionActor | null = null) {
    return {
      authenticated: true as const,
      actor,
      expiresAt: new Date(session.expiresAtMs).toISOString()
    };
  }

  async bootstrap(req: FgAuthedRequest) {
    const fingerprint = this.resolveFingerprint(req);
    await this.clearSession(req.user, fingerprint);
    const session = await this.ensureSession(req.user, fingerprint);
    // Best-effort actor from a status call is optional; keep response cookie-free.
    return { data: this.safeSessionResponse(session), message: "FG mobile session ready" };
  }

  async getSession(req: FgAuthedRequest) {
    const fingerprint = this.resolveFingerprint(req);
    const session = await this.ensureSession(req.user, fingerprint);
    return { data: this.safeSessionResponse(session), message: "FG mobile session status" };
  }

  async deleteSession(req: FgAuthedRequest) {
    const fingerprint = this.resolveFingerprint(req);
    await this.clearSession(req.user, fingerprint);
    return { data: { cleared: true }, message: "FG mobile session cleared" };
  }

  private async auditMutation(
    user: JwtPayload,
    entity: string,
    entityId: string,
    action: "CREATE" | "UPDATE" | "DELETE",
    metadata?: Record<string, unknown>
  ) {
    try {
      await writeAuditTrail(this.prisma, {
        module: "mobile-fg",
        entity,
        entityId,
        action,
        actor: user,
        source: "MOBILE",
        metadata: {
          ...(metadata ?? {}),
          // Never include cookies, csrf, assertion, or Authorization.
          broker: true
        }
      });
    } catch {
      // Audit failures must not block the mobile path.
    }
  }

  async listCl30Vehicles(req: FgAuthedRequest, q?: string) {
    return this.listFormVehicles(req, CL30_FORM_CODE, q);
  }

  private assertAllowlistedFormCode(formCode: string): string {
    const code = String(formCode ?? "").trim();
    if (!MOBILE_FG_FORM_CODES.has(code)) {
      throw new BadRequestException("formCode is not allowlisted for mobile FG");
    }
    return code;
  }

  async listFormVehicles(req: FgAuthedRequest, formCode: string, q?: string) {
    const code = this.assertAllowlistedFormCode(formCode);
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    query.set("formCode", code);
    const path = `/api/v1/vehicles?${query.toString()}`;
    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "GET", path);
      return { data: result.data, message: "FG vehicles fetched" };
    });
  }

  async openFormRecord(
    req: FgAuthedRequest,
    formCode: string,
    body: { date?: string; occurrenceToken?: string; room?: string }
  ) {
    const code = this.assertAllowlistedFormCode(formCode);
    const occurrenceToken = String(body?.occurrenceToken ?? "").trim();
    if (OCCURRENCE_REQUIRED.has(code) && !occurrenceToken) {
      throw new BadRequestException("occurrenceToken is required");
    }
    const payload: Record<string, unknown> = { formCode: code };
    if (body?.date) payload.date = body.date;
    if (body?.room) payload.room = body.room;
    if (occurrenceToken) payload.occurrenceToken = occurrenceToken;

    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "POST", "/api/v1/records/open", payload);
      const recordId =
        typeof result.data === "object" && result.data && "record" in (result.data as object)
          ? String((result.data as { record: { id: unknown } }).record.id)
          : typeof result.data === "object" && result.data && "id" in (result.data as object)
            ? String((result.data as { id: unknown }).id)
            : "open";
      await this.auditMutation(req.user, "FgRecord", recordId, "CREATE", {
        op: "form.open",
        formCode: code
      });
      return { data: result.data, message: "FG record opened" };
    });
  }

  async openCl30Record(req: FgAuthedRequest, body: { date?: string; occurrenceToken?: string }) {
    return this.openFormRecord(req, CL30_FORM_CODE, body ?? {});
  }

  async openCl18Record(req: FgAuthedRequest, body: { date?: string; occurrenceToken?: string }) {
    return this.openFormRecord(req, CL18_FORM_CODE, body ?? {});
  }

  async openCl24Record(req: FgAuthedRequest, body: { date?: string }) {
    return this.openFormRecord(req, CL24_FORM_CODE, body ?? {});
  }

  async openCl39Record(req: FgAuthedRequest, body: { date?: string; room?: string }) {
    return this.openFormRecord(req, CL39_FORM_CODE, body ?? {});
  }

  async listCl18Vehicles(req: FgAuthedRequest, q?: string) {
    return this.listFormVehicles(req, CL18_FORM_CODE, q);
  }

  async getCl30Record(req: FgAuthedRequest, recordId: string) {
    const id = encodeURIComponent(String(recordId));
    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "GET", `/api/v1/records/${id}`);
      return { data: result.data, message: "CL30 record fetched" };
    });
  }

  async saveCl30Record(
    req: FgAuthedRequest,
    recordId: string,
    body: { fields?: unknown; expectedDraftVersion?: unknown }
  ) {
    const id = encodeURIComponent(String(recordId));
    const payload = {
      fields: body?.fields ?? {},
      expectedDraftVersion: body?.expectedDraftVersion
    };
    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "POST", `/api/v1/records/${id}/save`, payload);
      await this.auditMutation(req.user, "FgRecord", String(recordId), "UPDATE", {
        op: "cl30.save"
      });
      return { data: result.data, message: "CL30 record saved" };
    });
  }

  async submitCl30Record(
    req: FgAuthedRequest,
    recordId: string,
    body: { idempotencyKey?: string }
  ) {
    const id = encodeURIComponent(String(recordId));
    const payload: Record<string, unknown> = {};
    if (body?.idempotencyKey) payload.idempotencyKey = body.idempotencyKey;
    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "POST", `/api/v1/records/${id}/submit`, payload);
      await this.auditMutation(req.user, "FgRecord", String(recordId), "UPDATE", {
        op: "cl30.submit",
        hasIdempotencyKey: Boolean(body?.idempotencyKey)
      });
      return { data: result.data, message: "CL30 record submitted" };
    });
  }

  async history(
    req: FgAuthedRequest,
    query: {
      dateFrom?: string;
      dateTo?: string;
      formCode?: string;
      vehicle?: string;
      status?: string;
      page?: string;
    }
  ) {
    const formCode = this.assertAllowlistedFormCode(String(query.formCode ?? CL30_FORM_CODE));
    const params = new URLSearchParams();
    params.set("formCode", formCode);
    if (query.dateFrom) params.set("dateFrom", query.dateFrom);
    if (query.dateTo) params.set("dateTo", query.dateTo);
    if (query.vehicle) params.set("vehicle", query.vehicle);
    if (query.status) params.set("status", query.status);
    if (query.page) params.set("page", query.page);
    const path = `/api/v1/history?${params.toString()}`;
    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "GET", path);
      return { data: result.data, message: "FG history fetched" };
    });
  }

  async listReviews(req: FgAuthedRequest, page?: string) {
    const params = new URLSearchParams();
    if (page) params.set("page", page);
    const qs = params.toString();
    const path = qs ? `/api/v1/reviews?${qs}` : "/api/v1/reviews";
    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "GET", path);
      return { data: result.data, message: "FG reviews fetched" };
    });
  }

  async getReview(req: FgAuthedRequest, submissionId: string) {
    const id = encodeURIComponent(String(submissionId));
    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "GET", `/api/v1/reviews/${id}`);
      return { data: result.data, message: "FG review fetched" };
    });
  }

  async reviewDecision(
    req: FgAuthedRequest,
    submissionId: string,
    body: { decision?: string; reviewNote?: string; idempotencyKey?: string }
  ) {
    const decision = String(body?.decision ?? "").trim().toUpperCase();
    if (!REVIEW_DECISIONS.has(decision)) {
      throw new BadRequestException("decision must be APPROVED or RETURNED_FOR_CORRECTION");
    }
    const id = encodeURIComponent(String(submissionId));
    const payload: Record<string, unknown> = { decision };
    if (body?.reviewNote !== undefined) payload.reviewNote = body.reviewNote;
    if (body?.idempotencyKey) payload.idempotencyKey = body.idempotencyKey;

    return this.withSession(req, async (session) => {
      const result = await this.django.request(
        session,
        "POST",
        `/api/v1/reviews/${id}/decision`,
        payload
      );
      await this.auditMutation(req.user, "FgReview", String(submissionId), "UPDATE", {
        op: "review.decision",
        decision
      });
      return { data: result.data, message: "FG review decision recorded" };
    });
  }

  async listQa(req: FgAuthedRequest, page?: string) {
    const params = new URLSearchParams();
    if (page) params.set("page", page);
    const qs = params.toString();
    const path = qs ? `/api/v1/qa?${qs}` : "/api/v1/qa";
    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "GET", path);
      return { data: result.data, message: "FG QA queue fetched" };
    });
  }

  async getQa(req: FgAuthedRequest, submissionId: string) {
    const id = encodeURIComponent(String(submissionId));
    return this.withSession(req, async (session) => {
      const result = await this.django.request(session, "GET", `/api/v1/qa/${id}`);
      return { data: result.data, message: "FG QA item fetched" };
    });
  }

  async qaDecision(
    req: FgAuthedRequest,
    submissionId: string,
    body: { decision?: string; note?: string; reviewNote?: string; idempotencyKey?: string }
  ) {
    const decision = String(body?.decision ?? "").trim().toUpperCase();
    if (!QA_DECISIONS.has(decision)) {
      throw new BadRequestException("decision must be RELEASE, HOLD, or REJECT");
    }
    const id = encodeURIComponent(String(submissionId));
    const payload: Record<string, unknown> = { decision };
    // Django accepts reviewNote / review_note (not bare "note").
    const reviewNote = body?.reviewNote ?? body?.note;
    if (reviewNote !== undefined) payload.reviewNote = reviewNote;
    if (body?.idempotencyKey) payload.idempotencyKey = body.idempotencyKey;

    return this.withSession(req, async (session) => {
      const result = await this.django.request(
        session,
        "POST",
        `/api/v1/qa/${id}/decision`,
        payload
      );
      await this.auditMutation(req.user, "FgQa", String(submissionId), "UPDATE", {
        op: "qa.decision",
        decision
      });
      return { data: result.data, message: "FG QA decision recorded" };
    });
  }
}
