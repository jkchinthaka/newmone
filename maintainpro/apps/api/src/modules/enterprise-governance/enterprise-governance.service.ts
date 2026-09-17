import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { WorkOrderStatus } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

type SodRule = {
  /** Actor field that must differ from subject field (e.g. requesterId vs approverId) */
  denySameActorFields?: Array<{ actorField: string; subjectField: string }>;
  /** Hard-coded policy codes */
  code?: string;
};

@Injectable()
export class EnterpriseGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── SoD ──────────────────────────────────────────────────────────────────

  async listSodPolicies(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.soDPolicy.findMany({
      where: { tenantId },
      orderBy: { code: "asc" }
    });
  }

  async upsertSodPolicy(
    actor: Actor,
    body: { code: string; name: string; transactionType: string; ruleJson: string; active?: boolean }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    if (!body.code?.trim() || !body.transactionType?.trim()) {
      throw new BadRequestException("code and transactionType are required");
    }
    JSON.parse(body.ruleJson || "{}");
    return this.prisma.soDPolicy.upsert({
      where: { tenantId_code: { tenantId, code: body.code.trim() } },
      create: {
        tenantId,
        code: body.code.trim(),
        name: body.name || body.code,
        transactionType: body.transactionType.trim(),
        ruleJson: body.ruleJson || "{}",
        active: body.active !== false
      },
      update: {
        name: body.name || body.code,
        transactionType: body.transactionType.trim(),
        ruleJson: body.ruleJson || "{}",
        active: body.active !== false
      }
    });
  }

  /**
   * Evaluates active SoD policies for a transaction type.
   * context: { actorId, subject: Record<string, string | null | undefined> }
   */
  async assertSoD(
    tenantId: string,
    transactionType: string,
    context: { actorId: string; subject: Record<string, string | null | undefined> }
  ) {
    const policies = await this.prisma.soDPolicy.findMany({
      where: { tenantId, transactionType, active: true }
    });

    // Built-in defaults when no policies configured
    const defaults: Array<{ code: string; rule: SodRule }> = [
      {
        code: "SELF_APPROVAL",
        rule: { denySameActorFields: [{ actorField: "actorId", subjectField: "requesterId" }] }
      },
      {
        code: "SELF_VERIFY",
        rule: { denySameActorFields: [{ actorField: "actorId", subjectField: "executorId" }] }
      },
      {
        code: "METER_SELF_APPROVE",
        rule: { denySameActorFields: [{ actorField: "actorId", subjectField: "requestedById" }] }
      },
      {
        code: "GATE_SELF_OVERRIDE",
        rule: { denySameActorFields: [{ actorField: "actorId", subjectField: "overrideRequesterId" }] }
      }
    ];

    const effective =
      policies.length > 0
        ? policies.map((p) => ({
            code: p.code,
            rule: JSON.parse(p.ruleJson || "{}") as SodRule
          }))
        : defaults.filter((d) => {
            if (transactionType === "APPROVAL") return d.code === "SELF_APPROVAL";
            if (transactionType === "SAFETY_VERIFY") return d.code === "SELF_VERIFY";
            if (transactionType === "METER_CORRECTION") return d.code === "METER_SELF_APPROVE";
            if (transactionType === "GATE_OVERRIDE") return d.code === "GATE_SELF_OVERRIDE";
            if (transactionType === "CONFIG_PUBLISH") return d.code === "SELF_APPROVAL";
            return false;
          });

    for (const policy of effective) {
      for (const pair of policy.rule.denySameActorFields ?? []) {
        const actorValue =
          pair.actorField === "actorId" ? context.actorId : context.subject[pair.actorField];
        const subjectValue = context.subject[pair.subjectField];
        if (actorValue && subjectValue && actorValue === subjectValue) {
          throw new ForbiddenException({
            code: "SOD_VIOLATION",
            policy: policy.code,
            message: `Segregation of duties violated (${policy.code})`
          });
        }
      }
    }
  }

  // ── Meter corrections ────────────────────────────────────────────────────

  async requestMeterCorrection(
    actor: Actor,
    body: { meterId: string; readingId?: string; originalValue: number; correctedValue: number; reason: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    if (!body.reason?.trim()) throw new BadRequestException("reason is required");
    const meter = await this.prisma.assetMeter.findFirst({
      where: { id: body.meterId, tenantId }
    });
    if (!meter) throw new NotFoundException("Meter not found");

    return this.prisma.meterCorrection.create({
      data: {
        tenantId,
        meterId: body.meterId,
        readingId: body.readingId ?? null,
        originalValue: body.originalValue,
        correctedValue: body.correctedValue,
        reason: body.reason.trim(),
        requestedById: actor.sub,
        status: "PENDING"
      }
    });
  }

  async approveMeterCorrection(actor: Actor, correctionId: string, approve: boolean) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.prisma.meterCorrection.findFirst({
      where: { id: correctionId, tenantId }
    });
    if (!row) throw new NotFoundException("Meter correction not found");
    if (row.status !== "PENDING") throw new ConflictException("Correction is not pending");

    await this.assertSoD(tenantId, "METER_CORRECTION", {
      actorId: actor.sub,
      subject: { requestedById: row.requestedById }
    });

    if (!approve) {
      return this.prisma.meterCorrection.update({
        where: { id: row.id },
        data: { status: "REJECTED", approvedById: actor.sub, approvedAt: new Date() }
      });
    }

    // Append correction reading — never silently overwrite history
    await this.prisma.$transaction(async (tx) => {
      const meter = await tx.assetMeter.findFirst({ where: { id: row.meterId, tenantId } });
      await tx.meterCorrection.update({
        where: { id: row.id },
        data: { status: "APPROVED", approvedById: actor.sub, approvedAt: new Date() }
      });
      await tx.assetMeterReading.create({
        data: {
          tenantId,
          meterId: row.meterId,
          value: row.correctedValue,
          previousValue: meter?.currentValue ?? row.originalValue,
          recordedAt: new Date(),
          source: "CORRECTION",
          notes: `Correction ${row.id}: ${row.originalValue} → ${row.correctedValue}. ${row.reason}`,
          recordedById: actor.sub
        }
      });
      await tx.assetMeter.update({
        where: { id: row.meterId },
        data: { currentValue: row.correctedValue, lastReadingAt: new Date() }
      });
      await tx.configChangeHistory.create({
        data: {
          tenantId,
          entityType: "MeterCorrection",
          entityId: row.id,
          action: "APPROVE",
          beforeJson: JSON.stringify({ originalValue: row.originalValue }),
          afterJson: JSON.stringify({ correctedValue: row.correctedValue }),
          reason: row.reason,
          actorId: actor.sub
        }
      });
    });

    return this.prisma.meterCorrection.findUniqueOrThrow({ where: { id: row.id } });
  }

  // ── Temporary repair ─────────────────────────────────────────────────────

  async recordTemporaryRepair(
    actor: Actor,
    body: {
      workOrderId: string;
      reason: string;
      temporaryAction: string;
      risk?: string;
      expiryAt: string;
      createFollowUp?: boolean;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: body.workOrderId, tenantId }
    });
    if (!wo) throw new NotFoundException("Work order not found");
    const expiryAt = new Date(body.expiryAt);
    if (Number.isNaN(expiryAt.getTime())) throw new BadRequestException("Invalid expiryAt");

    let followUpId: string | null = null;
    if (body.createFollowUp !== false) {
      const woNumber = `WO-FU-${Date.now().toString(36).toUpperCase()}`;
      const followUp = await this.prisma.workOrder.create({
        data: {
          tenantId,
          woNumber,
          title: `Follow-up: permanent repair after temporary fix (${wo.woNumber})`,
          description: `Follow-up for temporary repair on ${wo.woNumber}. Reason: ${body.reason}`,
          status: WorkOrderStatus.OPEN,
          priority: wo.priority || "MEDIUM",
          type: wo.type || "CORRECTIVE",
          assetId: wo.assetId,
          vehicleId: wo.vehicleId,
          siteId: wo.siteId,
          departmentId: wo.departmentId,
          createdById: actor.sub,
          jobDomain: wo.jobDomain
        }
      });
      followUpId = followUp.id;
    }

    const record = await this.prisma.temporaryRepairRecord.create({
      data: {
        tenantId,
        workOrderId: wo.id,
        reason: body.reason,
        temporaryAction: body.temporaryAction,
        risk: body.risk ?? null,
        expiryAt,
        ownerId: actor.sub,
        followUpWorkOrderId: followUpId,
        status: "OPEN"
      }
    });

    await this.prisma.workOrder.update({
      where: { id: wo.id },
      data: {
        temporaryRepair: true,
        temporaryRepairExpiry: expiryAt,
        temporaryRepairFollowUpId: followUpId
      }
    });

    return { record, followUpWorkOrderId: followUpId };
  }

  // ── Custom fields ────────────────────────────────────────────────────────

  async listCustomFields(actor: Actor, entityType?: string) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.customFieldDefinition.findMany({
      where: { tenantId, ...(entityType ? { entityType } : {}) },
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }]
    });
  }

  async upsertCustomField(
    actor: Actor,
    body: {
      entityType: string;
      key: string;
      label: string;
      fieldType: string;
      required?: boolean;
      allowedValuesJson?: string;
      validationJson?: string;
      sortOrder?: number;
      active?: boolean;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const allowedTypes = [
      "text",
      "number",
      "currency",
      "date",
      "datetime",
      "boolean",
      "select",
      "multiselect",
      "reference",
      "textarea"
    ];
    if (!allowedTypes.includes(body.fieldType)) {
      throw new BadRequestException(`fieldType must be one of: ${allowedTypes.join(", ")}`);
    }
    if (!/^[a-z][a-z0-9_]*$/i.test(body.key)) {
      throw new BadRequestException("key must be alphanumeric/underscore");
    }
    // No executable expressions — only JSON validation metadata
    if (body.validationJson) JSON.parse(body.validationJson);

    return this.prisma.customFieldDefinition.upsert({
      where: {
        tenantId_entityType_key: {
          tenantId,
          entityType: body.entityType,
          key: body.key
        }
      },
      create: {
        tenantId,
        entityType: body.entityType,
        key: body.key,
        label: body.label,
        fieldType: body.fieldType,
        required: !!body.required,
        allowedValuesJson: body.allowedValuesJson ?? "[]",
        validationJson: body.validationJson ?? null,
        sortOrder: body.sortOrder ?? 0,
        active: body.active !== false
      },
      update: {
        label: body.label,
        fieldType: body.fieldType,
        required: !!body.required,
        allowedValuesJson: body.allowedValuesJson ?? "[]",
        validationJson: body.validationJson ?? null,
        sortOrder: body.sortOrder ?? 0,
        active: body.active !== false
      }
    });
  }

  // ── Approval delegation ──────────────────────────────────────────────────

  async createDelegation(
    actor: Actor,
    body: {
      delegateId: string;
      reason: string;
      startsAt: string;
      endsAt: string;
      scopeJson?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    if (body.delegateId === actor.sub) {
      throw new BadRequestException("Cannot delegate to yourself");
    }
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (!(startsAt < endsAt)) throw new BadRequestException("startsAt must be before endsAt");

    return this.prisma.approvalDelegation.create({
      data: {
        tenantId,
        delegatorId: actor.sub,
        delegateId: body.delegateId,
        reason: body.reason,
        startsAt,
        endsAt,
        scopeJson: body.scopeJson ?? "{}",
        active: true
      }
    });
  }

  async resolveDelegatedApprovers(tenantId: string, originalApproverId: string, at = new Date()) {
    const rows = await this.prisma.approvalDelegation.findMany({
      where: {
        tenantId,
        delegatorId: originalApproverId,
        active: true,
        startsAt: { lte: at },
        endsAt: { gte: at }
      }
    });
    return rows.map((r) => r.delegateId);
  }

  // ── Service API keys ─────────────────────────────────────────────────────

  async issueApiKey(actor: Actor, body: { name: string; scopes?: string[]; expiresAt?: string }) {
    const tenantId = requireTenantId(actor.tenantId);
    const raw = `mp_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(raw).digest("hex");
    const keyPrefix = raw.slice(0, 10);
    const row = await this.prisma.serviceApiKey.create({
      data: {
        tenantId,
        name: body.name,
        keyHash,
        keyPrefix,
        scopesJson: JSON.stringify(body.scopes ?? []),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdById: actor.sub
      }
    });
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      /** Returned once — store securely */
      apiKey: raw,
      expiresAt: row.expiresAt
    };
  }

  async revokeApiKey(actor: Actor, id: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.prisma.serviceApiKey.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("API key not found");
    return this.prisma.serviceApiKey.update({
      where: { id },
      data: { revokedAt: new Date() }
    });
  }

  // ── Outbound webhooks ────────────────────────────────────────────────────

  async registerWebhook(
    actor: Actor,
    body: { name: string; url: string; secret: string; events: string[] }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    if (!/^https?:\/\//i.test(body.url)) throw new BadRequestException("url must be http(s)");
    const secretHash = createHash("sha256").update(body.secret).digest("hex");
    return this.prisma.outboundWebhook.create({
      data: {
        tenantId,
        name: body.name,
        url: body.url,
        secretHash,
        eventsJson: JSON.stringify(body.events ?? []),
        active: true
      }
    });
  }

  async enqueueWebhookDelivery(
    tenantId: string,
    eventType: string,
    eventId: string,
    _payload: unknown
  ) {
    const hooks = await this.prisma.outboundWebhook.findMany({
      where: { tenantId, active: true }
    });
    const matched = hooks.filter((h) => {
      const events = JSON.parse(h.eventsJson || "[]") as string[];
      return events.includes(eventType) || events.includes("*");
    });

    const results = [];
    for (const hook of matched) {
      try {
        const delivery = await this.prisma.outboundWebhookDelivery.create({
          data: {
            tenantId,
            webhookId: hook.id,
            eventId: `${eventId}:${hook.id}`,
            eventType,
            status: "PENDING",
            attemptCount: 0
          }
        });
        // Synchronous attempt with graceful failure — ERP/webhook outage must not block core ops
        try {
          const res = await fetch(hook.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Event-Type": eventType },
            body: JSON.stringify({ eventId, eventType, tenantId }),
            signal: AbortSignal.timeout(5000)
          });
          await this.prisma.outboundWebhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: res.ok ? "DELIVERED" : "FAILED",
              attemptCount: 1,
              lastError: res.ok ? null : `HTTP ${res.status}`
            }
          });
          results.push({ webhookId: hook.id, status: res.ok ? "DELIVERED" : "FAILED" });
        } catch (err) {
          await this.prisma.outboundWebhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "FAILED",
              attemptCount: 1,
              lastError: err instanceof Error ? err.message.slice(0, 500) : "delivery failed"
            }
          });
          results.push({ webhookId: hook.id, status: "FAILED" });
        }
      } catch {
        // unique eventId — already delivered
      }
    }
    return results;
  }

  async retryFailedDeliveries(actor: Actor, limit = 20) {
    const tenantId = requireTenantId(actor.tenantId);
    const failed = await this.prisma.outboundWebhookDelivery.findMany({
      where: { tenantId, status: "FAILED", attemptCount: { lt: 5 } },
      take: limit,
      orderBy: { updatedAt: "asc" }
    });
    const out = [];
    for (const d of failed) {
      const hook = await this.prisma.outboundWebhook.findFirst({
        where: { id: d.webhookId, tenantId }
      });
      if (!hook) continue;
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Event-Type": d.eventType },
          body: JSON.stringify({ eventId: d.eventId, eventType: d.eventType, tenantId, retry: true }),
          signal: AbortSignal.timeout(5000)
        });
        const status = res.ok ? "DELIVERED" : "FAILED";
        await this.prisma.outboundWebhookDelivery.update({
          where: { id: d.id },
          data: {
            status,
            attemptCount: d.attemptCount + 1,
            lastError: res.ok ? null : `HTTP ${res.status}`
          }
        });
        out.push({ id: d.id, status });
      } catch (err) {
        await this.prisma.outboundWebhookDelivery.update({
          where: { id: d.id },
          data: {
            attemptCount: d.attemptCount + 1,
            lastError: err instanceof Error ? err.message.slice(0, 500) : "retry failed"
          }
        });
        out.push({ id: d.id, status: "FAILED" });
      }
    }
    return out;
  }

  // ── Global search ────────────────────────────────────────────────────────

  async globalSearch(actor: Actor, q: string, limit = 20) {
    const tenantId = requireTenantId(actor.tenantId);
    const query = q.trim();
    if (query.length < 2) return { results: [] };
    const take = Math.min(Math.max(limit, 1), 50);

    const [assets, workOrders, vehicles, suppliers] = await Promise.all([
      this.prisma.asset.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: query } },
            { assetTag: { contains: query } }
          ]
        },
        take,
        select: { id: true, name: true, assetTag: true }
      }),
      this.prisma.workOrder.findMany({
        where: {
          tenantId,
          OR: [{ title: { contains: query } }, { woNumber: { contains: query } }]
        },
        take,
        select: { id: true, title: true, woNumber: true, status: true }
      }),
      this.prisma.vehicle.findMany({
        where: {
          tenantId,
          OR: [
            { registrationNo: { contains: query } },
            { assetTag: { contains: query } },
            { vin: { contains: query } }
          ]
        },
        take,
        select: { id: true, registrationNo: true, assetTag: true }
      }),
      this.prisma.supplier.findMany({
        where: { tenantId, name: { contains: query } },
        take,
        select: { id: true, name: true }
      })
    ]);

    return {
      results: [
        ...assets.map((a) => ({ type: "ASSET", id: a.id, label: a.name, ref: a.assetTag })),
        ...workOrders.map((w) => ({
          type: "WORK_ORDER",
          id: w.id,
          label: w.title,
          ref: w.woNumber,
          status: w.status
        })),
        ...vehicles.map((v) => ({
          type: "VEHICLE",
          id: v.id,
          label: v.registrationNo,
          ref: v.assetTag
        })),
        ...suppliers.map((s) => ({ type: "SUPPLIER", id: s.id, label: s.name }))
      ].slice(0, take)
    };
  }
}
