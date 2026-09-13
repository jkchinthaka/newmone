import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { FgBootstrapResult, FgBrokerSession, FgSessionActor } from "./fg-session.types";

const SESSION_COOKIE = "fg_sessionid";
const CSRF_COOKIE = "csrftoken";
const DEFAULT_TIMEOUT_MS = 15_000;

export class FgUpstreamAuthError extends Error {
  constructor(message = "FG upstream session unauthenticated") {
    super(message);
    this.name = "FgUpstreamAuthError";
  }
}

export type FgDjangoJson = {
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string[]>;
  };
  message?: string;
};

@Injectable()
export class FgDjangoClient {
  private readonly logger = new Logger(FgDjangoClient.name);

  constructor(private readonly configService: ConfigService) {}

  private resolveBaseUrl(): string {
    const raw = String(this.configService.get<string>("FG_API_INTERNAL_URL") ?? "").trim();
    if (!raw) {
      throw new ServiceUnavailableException("FG mobile broker is not configured (FG_API_INTERNAL_URL)");
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new ServiceUnavailableException("FG_API_INTERNAL_URL is not a valid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ServiceUnavailableException("FG_API_INTERNAL_URL must be http(s)");
    }
    if (parsed.username || parsed.password) {
      throw new ServiceUnavailableException("FG_API_INTERNAL_URL must not include userinfo");
    }
    // Strip trailing slash for stable joins.
    return raw.replace(/\/+$/, "");
  }

  private timeoutMs(): number {
    const raw = Number(this.configService.get<string | number>("FG_API_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS);
    if (!Number.isFinite(raw) || raw < 1000 || raw > 120_000) {
      return DEFAULT_TIMEOUT_MS;
    }
    return Math.floor(raw);
  }

  /** Allow only relative /api/v1/... paths — no absolute URLs or traversal. */
  assertAllowlistedPath(path: string): string {
    if (typeof path !== "string" || !path.startsWith("/api/v1/")) {
      throw new BadRequestException("Invalid FG upstream path");
    }
    if (path.includes("://") || path.includes("..") || path.includes("\\")) {
      throw new BadRequestException("Invalid FG upstream path");
    }
    if (path.includes("@") || /^\/api\/v1\/\//.test(path)) {
      throw new BadRequestException("Invalid FG upstream path");
    }
    return path;
  }

  private parseSetCookie(
    headers: Headers
  ): { sessionCookieValue?: string; csrfCookieValue?: string } {
    const values: string[] = [];
    const anyHeaders = headers as Headers & { getSetCookie?: () => string[]; raw?: () => Record<string, string | string[]> };

    if (typeof anyHeaders.getSetCookie === "function") {
      values.push(...anyHeaders.getSetCookie());
    } else {
      const single = headers.get("set-cookie");
      if (single) values.push(single);
    }

    let sessionCookieValue: string | undefined;
    let csrfCookieValue: string | undefined;

    for (const line of values) {
      const parts = String(line).split(";");
      const [pair] = parts;
      if (!pair) continue;
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name === SESSION_COOKIE) sessionCookieValue = value;
      if (name === CSRF_COOKIE) csrfCookieValue = value;
    }

    return { sessionCookieValue, csrfCookieValue };
  }

  private async readJson(response: Response): Promise<FgDjangoJson | null> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as FgDjangoJson;
    } catch {
      return null;
    }
  }

  /**
   * Map Django error envelope to Nest HttpExceptions.
   * Never includes cookies, assertion, CSRF, or Authorization material.
   */
  mapUpstreamError(status: number, body: FgDjangoJson | null, cause?: unknown): never {
    if (cause && (cause as { name?: string }).name === "TimeoutError") {
      throw new GatewayTimeoutException("FG upstream request timed out");
    }
    if (cause instanceof Error && /aborted|timeout/i.test(cause.message)) {
      throw new GatewayTimeoutException("FG upstream request timed out");
    }

    const code = String(body?.error?.code ?? "").toUpperCase();
    const message = this.sanitizeMessage(body?.error?.message || body?.message || "FG upstream error");
    const fieldErrors = body?.error?.fieldErrors;

    if (status === 401 || code === "UNAUTHENTICATED") {
      throw new UnauthorizedException({ message, code: code || "UNAUTHENTICATED" });
    }
    if (status === 403 || code === "FORBIDDEN" || code === "SELF_REVIEW_BLOCKED") {
      throw new ForbiddenException({ message, code: code || "FORBIDDEN" });
    }
    if (status === 404 || code === "NOT_FOUND") {
      throw new NotFoundException({ message, code: code || "NOT_FOUND" });
    }
    if (status === 409 || code === "CONFLICT" || code === "IMMUTABLE") {
      throw new ConflictException({ message, code: code || "CONFLICT" });
    }
    if (status === 400 || code === "VALIDATION" || code === "BAD_REQUEST") {
      throw new BadRequestException({
        message,
        code: code || "VALIDATION",
        ...(fieldErrors ? { fieldErrors } : {})
      });
    }
    if (status === 503 || code === "UPSTREAM_UNAVAILABLE") {
      throw new ServiceUnavailableException({ message, code: "UPSTREAM_UNAVAILABLE" });
    }
    if (status >= 500) {
      throw new BadGatewayException("FG upstream request failed");
    }
    throw new BadGatewayException("FG upstream request failed");
  }

  private sanitizeMessage(message: string): string {
    // Strip anything that looks like secrets if Django ever echoes them.
    return String(message ?? "")
      .replace(/Bearer\s+\S+/gi, "[redacted]")
      .replace(/fg_sessionid=[^;\s]+/gi, "[redacted]")
      .replace(/csrftoken=[^;\s]+/gi, "[redacted]")
      .replace(/csrf(token)?[=:]\s*\S+/gi, "[redacted]")
      .slice(0, 500);
  }

  private isUnauthenticatedEnvelope(status: number, body: FgDjangoJson | null): boolean {
    if (status === 401) return true;
    const code = String(body?.error?.code ?? "").toUpperCase();
    return code === "UNAUTHENTICATED";
  }

  async bootstrapSession(assertion: string): Promise<FgBootstrapResult> {
    const base = this.resolveBaseUrl();
    const url = `${base}/api/v1/session`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${assertion}`,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(this.timeoutMs())
      });
    } catch (err) {
      this.logger.warn("FG bootstrap request failed");
      this.mapUpstreamError(504, null, err);
    }

    const body = await this.readJson(response);
    if (!response.ok) {
      if (this.isUnauthenticatedEnvelope(response.status, body)) {
        throw new FgUpstreamAuthError(this.sanitizeMessage(body?.error?.message ?? "unauthenticated"));
      }
      this.mapUpstreamError(response.status, body);
    }

    const cookies = this.parseSetCookie(response.headers);
    const data = (body?.data ?? {}) as {
      csrfToken?: string;
      actor?: FgSessionActor;
      authenticated?: boolean;
    };

    const csrfToken = String(data.csrfToken ?? cookies.csrfCookieValue ?? "").trim();
    const sessionCookieValue = String(cookies.sessionCookieValue ?? "").trim();
    const csrfCookieValue = String(cookies.csrfCookieValue ?? csrfToken).trim();

    if (!sessionCookieValue || !csrfToken) {
      throw new BadGatewayException("FG session bootstrap incomplete");
    }

    return {
      session: {
        sessionCookieName: SESSION_COOKIE,
        sessionCookieValue,
        csrfCookieName: CSRF_COOKIE,
        csrfCookieValue,
        csrfToken
      },
      actor: data.actor ?? null,
      authenticated: data.authenticated !== false
    };
  }

  async request(
    session: FgBrokerSession,
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; data: unknown; raw: FgDjangoJson | null }> {
    const safePath = this.assertAllowlistedPath(path);
    const base = this.resolveBaseUrl();
    const url = `${base}${safePath}`;
    const upper = method.toUpperCase();

    const headers: Record<string, string> = {
      Accept: "application/json",
      Cookie: `${session.sessionCookieName}=${session.sessionCookieValue}; ${session.csrfCookieName}=${session.csrfCookieValue}`
    };

    if (upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE") {
      headers["X-CSRFToken"] = session.csrfToken;
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: upper,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs())
      });
    } catch (err) {
      this.logger.warn(`FG upstream ${upper} failed`);
      this.mapUpstreamError(504, null, err);
    }

    const raw = await this.readJson(response);

    if (this.isUnauthenticatedEnvelope(response.status, raw) || (response.status === 403 && String(raw?.error?.code ?? "").toUpperCase() === "UNAUTHENTICATED")) {
      throw new FgUpstreamAuthError(this.sanitizeMessage(raw?.error?.message ?? "unauthenticated"));
    }

    if (!response.ok) {
      this.mapUpstreamError(response.status, raw);
    }

    return {
      status: response.status,
      data: raw?.data !== undefined ? raw.data : raw,
      raw
    };
  }
}
