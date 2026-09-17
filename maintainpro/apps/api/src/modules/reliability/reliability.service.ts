import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

export const DOWNTIME_CATEGORIES = [
  "ACTIVE_REPAIR",
  "WAITING_PARTS",
  "WAITING_VENDOR",
  "WAITING_APPROVAL",
  "WAITING_TECHNICIAN",
  "AWAITING_SHUTDOWN",
  "TESTING",
  "OPERATIONAL_DELAY",
  "OTHER"
] as const;

export const PERMIT_TYPES = [
  "ELECTRICAL",
  "HOT_WORK",
  "CONFINED_SPACE",
  "WORKING_AT_HEIGHT",
  "HIGH_RISK_MACHINERY",
  "OTHER"
] as const;

export const PERMIT_STATUSES = [
  "DRAFT",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
  "CLOSED",
  "EXPIRED"
] as const;

const PERMIT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["APPROVED", "CLOSED"],
  APPROVED: ["ACTIVE", "CLOSED"],
  ACTIVE: ["SUSPENDED", "CLOSED", "EXPIRED"],
  SUSPENDED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
  EXPIRED: ["CLOSED"]
};

const RCA_STATUSES = ["OPEN", "IN_REVIEW", "COMPLETED", "CLOSED"] as const;
const CAPA_KINDS = ["CORRECTIVE", "PREVENTIVE"] as const;
const CAPA_STATUSES = ["OPEN", "IN_PROGRESS", "VERIFIED", "CLOSED", "CANCELLED"] as const;

const DEFAULT_CRITICALITIES = ["CRITICAL", "HIGH"];

@Injectable()
export class ReliabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreatePolicy(tenantId: string) {
    const existing = await this.prisma.reliabilityPolicy.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.prisma.reliabilityPolicy.create({
      data: {
        tenantId,
        repeatWindowDays: 90,
        matchSameFaultCode: true,
        matchSameAsset: true,
        requireRcaOnRepeat: false,
        requirePermitForCriticalAssets: true,
        permitRequiredCriticalities: DEFAULT_CRITICALITIES.join(","),
        requireLotoWhenPermitRequires: true
      }
    });
  }

  async getPolicy(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.getOrCreatePolicy(tenantId);
  }

  async updatePolicy(
    actor: Actor,
    input: {
      repeatWindowDays?: number;
      matchSameFaultCode?: boolean;
      matchSameAsset?: boolean;
      requireRcaOnRepeat?: boolean;
      requirePermitForCriticalAssets?: boolean;
      permitRequiredCriticalities?: string[];
      requireLotoWhenPermitRequires?: boolean;
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const before = await this.getOrCreatePolicy(tenantId);
    if (input.repeatWindowDays != null && (input.repeatWindowDays < 1 || input.repeatWindowDays > 730)) {
      throw new BadRequestException("repeatWindowDays must be between 1 and 730");
    }
    const criticalities =
      input.permitRequiredCriticalities?.map((c) => c.trim().toUpperCase()).filter(Boolean) ??
      before.permitRequiredCriticalities.split(",").map((c) => c.trim()).filter(Boolean);

    const updated = await this.prisma.reliabilityPolicy.update({
      where: { tenantId },
      data: {
        ...(input.repeatWindowDays != null ? { repeatWindowDays: input.repeatWindowDays } : {}),
        ...(input.matchSameFaultCode != null ? { matchSameFaultCode: input.matchSameFaultCode } : {}),
        ...(input.matchSameAsset != null ? { matchSameAsset: input.matchSameAsset } : {}),
        ...(input.requireRcaOnRepeat != null ? { requireRcaOnRepeat: input.requireRcaOnRepeat } : {}),
        ...(input.requirePermitForCriticalAssets != null
          ? { requirePermitForCriticalAssets: input.requirePermitForCriticalAssets }
          : {}),
        ...(input.requireLotoWhenPermitRequires != null
          ? { requireLotoWhenPermitRequires: input.requireLotoWhenPermitRequires }
          : {}),
        permitRequiredCriticalities: criticalities.join(",") || DEFAULT_CRITICALITIES.join(",")
      }
    });

    await this.recordHistory(actor, {
      entityType: "ReliabilityPolicy",
      entityId: updated.id,
      action: "UPDATE",
      beforeJson: before,
      afterJson: updated,
      reason: input.reason ?? "Reliability policy updated"
    });

    return updated;
  }

  parseRequiredCriticalities(csv: string): string[] {
    return csv
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
  }

  /**
   * Blocks WO start when policy requires a valid permit for the asset criticality.
   * Emergency override is allowed only when caller passes allowEmergencyOverride=true
   * (WO service records audit separately).
   */
  async assertPermitReadyForStart(input: {
    tenantId: string;
    workOrderId: string;
    assetId?: string | null;
    allowEmergencyOverride?: boolean;
  }): Promise<{ required: boolean; reasons: string[] }> {
    const policy = await this.getOrCreatePolicy(input.tenantId);
    if (!policy.requirePermitForCriticalAssets) {
      return { required: false, reasons: [] };
    }

    let criticality: string | null = null;
    if (input.assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: input.assetId, tenantId: input.tenantId },
        select: { criticalityLevel: true, criticality: true }
      });
      criticality = (asset?.criticalityLevel || asset?.criticality || "").toString().toUpperCase() || null;
    }

    const requiredLevels = this.parseRequiredCriticalities(policy.permitRequiredCriticalities);
    if (!criticality || !requiredLevels.includes(criticality)) {
      return { required: false, reasons: [] };
    }

    const now = new Date();
    const permits = await this.prisma.workPermit.findMany({
      where: {
        tenantId: input.tenantId,
        workOrderId: input.workOrderId,
        status: { in: ["APPROVED", "ACTIVE"] }
      }
    });

    const valid = permits.filter((p) => {
      if (p.validTo && p.validTo.getTime() < now.getTime()) return false;
      if (p.validFrom && p.validFrom.getTime() > now.getTime()) return false;
      return true;
    });

    if (valid.length > 0) {
      return { required: true, reasons: [] };
    }

    const reasons = [
      `Asset criticality ${criticality} requires an APPROVED or ACTIVE work permit before start`,
      ...(permits.length
        ? ["Existing permits are expired, not yet valid, or not approved"]
        : ["No work permit linked to this work order"])
    ];

    if (input.allowEmergencyOverride) {
      return { required: true, reasons: [...reasons, "Emergency override accepted"] };
    }

    throw new BadRequestException({
      code: "SAFETY_BLOCK",
      message: "Cannot start work — mandatory permit requirements incomplete",
      reasons
    });
  }

  async detectRepeatFailure(input: {
    tenantId: string;
    workOrderId: string;
    assetId?: string | null;
    failureCode?: string | null;
  }) {
    const policy = await this.getOrCreatePolicy(input.tenantId);
    if (!input.assetId && policy.matchSameAsset) {
      return { isRepeat: false, similarCount: 0, windowDays: policy.repeatWindowDays };
    }

    const since = new Date(Date.now() - policy.repeatWindowDays * 24 * 60 * 60 * 1000);
    const where: Record<string, unknown> = {
      tenantId: input.tenantId,
      id: { not: input.workOrderId },
      createdAt: { gte: since },
      status: { notIn: ["CANCELLED"] }
    };
    if (policy.matchSameAsset && input.assetId) {
      where.assetId = input.assetId;
    }
    if (policy.matchSameFaultCode && input.failureCode) {
      where.OR = [
        { failureCodeSnapshot: input.failureCode },
        { causeCodeSnapshot: input.failureCode }
      ];
    }

    const similarCount = await this.prisma.workOrder.count({ where: where as never });
    const isRepeat = similarCount > 0;

    if (isRepeat) {
      await this.prisma.workOrder.updateMany({
        where: { id: input.workOrderId, tenantId: input.tenantId },
        data: { repeatFailureCandidate: true }
      });
    }

    return { isRepeat, similarCount, windowDays: policy.repeatWindowDays, requireRcaOnRepeat: policy.requireRcaOnRepeat };
  }

  // ── Downtime segments ──────────────────────────────────────────────

  async listDowntime(actor: Actor, workOrderId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    await this.assertWorkOrder(tenantId, workOrderId);
    return this.prisma.downtimeSegment.findMany({
      where: { tenantId, workOrderId },
      orderBy: { startedAt: "asc" }
    });
  }

  async openDowntime(
    actor: Actor,
    workOrderId: string,
    input: {
      category: string;
      planned?: boolean;
      reasonCode?: string;
      reasonNotes?: string;
      startedAt?: string;
      productionAffected?: boolean;
      estimatedLostHours?: number;
      estimatedLostUnits?: number;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const wo = await this.assertWorkOrder(tenantId, workOrderId);
    const category = input.category.trim().toUpperCase();
    if (!(DOWNTIME_CATEGORIES as readonly string[]).includes(category)) {
      throw new BadRequestException(`Invalid downtime category. Allowed: ${DOWNTIME_CATEGORIES.join(", ")}`);
    }

    const open = await this.prisma.downtimeSegment.findFirst({
      where: { tenantId, workOrderId, endedAt: null }
    });
    if (open) {
      throw new BadRequestException("Close the open downtime segment before opening another");
    }

    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
    if (Number.isNaN(startedAt.getTime())) throw new BadRequestException("Invalid startedAt");

    const segment = await this.prisma.downtimeSegment.create({
      data: {
        tenantId,
        workOrderId,
        assetId: wo.assetId,
        category,
        planned: Boolean(input.planned),
        reasonCode: input.reasonCode?.trim() || null,
        reasonNotes: input.reasonNotes?.trim() || null,
        startedAt,
        productionAffected: Boolean(input.productionAffected),
        estimatedLostHours: input.estimatedLostHours ?? null,
        estimatedLostUnits: input.estimatedLostUnits ?? null,
        openedById: actor.sub
      }
    });

    if (!wo.downtimeApplicable || !wo.downtimeStartedAt) {
      await this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: {
          downtimeApplicable: true,
          downtimeStartedAt: wo.downtimeStartedAt ?? startedAt,
          affectsOperation: true
        }
      });
    }

    return segment;
  }

  async closeDowntime(
    actor: Actor,
    segmentId: string,
    input: { endedAt?: string; reasonNotes?: string } = {}
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const segment = await this.prisma.downtimeSegment.findFirst({
      where: { id: segmentId, tenantId }
    });
    if (!segment) throw new NotFoundException("Downtime segment not found");
    if (segment.endedAt) throw new BadRequestException("Segment already closed");

    const endedAt = input.endedAt ? new Date(input.endedAt) : new Date();
    if (Number.isNaN(endedAt.getTime())) throw new BadRequestException("Invalid endedAt");
    if (endedAt.getTime() < segment.startedAt.getTime()) {
      throw new BadRequestException("endedAt must be on or after startedAt");
    }

    const updated = await this.prisma.downtimeSegment.update({
      where: { id: segmentId },
      data: {
        endedAt,
        reasonNotes: input.reasonNotes?.trim() || segment.reasonNotes,
        closedById: actor.sub
      }
    });

    const stillOpen = await this.prisma.downtimeSegment.count({
      where: { tenantId, workOrderId: segment.workOrderId, endedAt: null }
    });
    if (stillOpen === 0) {
      await this.prisma.workOrder.update({
        where: { id: segment.workOrderId },
        data: { downtimeEndedAt: endedAt }
      });
    }

    return updated;
  }

  async summarizeDowntime(actor: Actor, workOrderId: string) {
    const segments = await this.listDowntime(actor, workOrderId);
    const byCategory: Record<string, number> = {};
    let totalMs = 0;
    for (const s of segments) {
      const end = s.endedAt?.getTime() ?? Date.now();
      const ms = Math.max(0, end - s.startedAt.getTime());
      totalMs += ms;
      byCategory[s.category] = (byCategory[s.category] ?? 0) + ms;
    }
    return {
      segmentCount: segments.length,
      openCount: segments.filter((s) => !s.endedAt).length,
      totalHours: Math.round((totalMs / 3600000) * 100) / 100,
      hoursByCategory: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k, Math.round((v / 3600000) * 100) / 100])
      ),
      segments
    };
  }

  // ── RCA / CAPA ─────────────────────────────────────────────────────

  async listRca(actor: Actor, query: { workOrderId?: string; assetId?: string; status?: string } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.rcaCase.findMany({
      where: {
        tenantId,
        ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.status ? { status: query.status.toUpperCase() } : {})
      },
      include: { capaActions: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createRca(
    actor: Actor,
    input: {
      workOrderId?: string;
      assetId?: string;
      vehicleId?: string;
      problemStatement: string;
      failureCode?: string;
      causeCode?: string;
      evidence?: string[];
      fiveWhy?: string[];
      ownerId?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    if (!input.problemStatement?.trim()) throw new BadRequestException("problemStatement is required");

    let assetId = input.assetId ?? null;
    let failureCode = input.failureCode?.trim() || null;
    if (input.workOrderId) {
      const wo = await this.assertWorkOrder(tenantId, input.workOrderId);
      assetId = assetId ?? wo.assetId;
      failureCode = failureCode || wo.failureCodeSnapshot || null;
    }

    const repeat = await this.detectRepeatFailure({
      tenantId,
      workOrderId: input.workOrderId ?? "none",
      assetId,
      failureCode
    });

    return this.prisma.rcaCase.create({
      data: {
        tenantId,
        workOrderId: input.workOrderId ?? null,
        assetId,
        vehicleId: input.vehicleId ?? null,
        problemStatement: input.problemStatement.trim(),
        evidenceJson: JSON.stringify(input.evidence ?? []),
        fiveWhyJson: JSON.stringify(input.fiveWhy ?? []),
        failureCode,
        causeCode: input.causeCode?.trim() || null,
        repeatCandidate: repeat.isRepeat,
        repeatWindowDays: repeat.windowDays,
        similarWoCount: repeat.similarCount,
        ownerId: input.ownerId ?? actor.sub,
        status: "OPEN"
      },
      include: { capaActions: true }
    });
  }

  async updateRca(
    actor: Actor,
    id: string,
    input: {
      status?: string;
      rootCause?: string;
      failureCode?: string;
      causeCode?: string;
      fiveWhy?: string[];
      evidence?: string[];
      ownerId?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const existing = await this.prisma.rcaCase.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("RCA case not found");

    if (input.status) {
      const status = input.status.toUpperCase();
      if (!(RCA_STATUSES as readonly string[]).includes(status)) {
        throw new BadRequestException("Invalid RCA status");
      }
    }

    return this.prisma.rcaCase.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status.toUpperCase() } : {}),
        ...(input.rootCause != null ? { rootCause: input.rootCause.trim() || null } : {}),
        ...(input.failureCode != null ? { failureCode: input.failureCode.trim() || null } : {}),
        ...(input.causeCode != null ? { causeCode: input.causeCode.trim() || null } : {}),
        ...(input.fiveWhy ? { fiveWhyJson: JSON.stringify(input.fiveWhy) } : {}),
        ...(input.evidence ? { evidenceJson: JSON.stringify(input.evidence) } : {}),
        ...(input.ownerId != null ? { ownerId: input.ownerId } : {}),
        ...(input.status?.toUpperCase() === "COMPLETED" || input.status?.toUpperCase() === "CLOSED"
          ? { completedAt: new Date() }
          : {})
      },
      include: { capaActions: true }
    });
  }

  async addCapa(
    actor: Actor,
    rcaCaseId: string,
    input: { kind: string; description: string; ownerId?: string; dueDate?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const rca = await this.prisma.rcaCase.findFirst({ where: { id: rcaCaseId, tenantId } });
    if (!rca) throw new NotFoundException("RCA case not found");

    const kind = input.kind.trim().toUpperCase();
    if (!(CAPA_KINDS as readonly string[]).includes(kind)) {
      throw new BadRequestException("kind must be CORRECTIVE or PREVENTIVE");
    }
    if (!input.description?.trim()) throw new BadRequestException("description is required");

    return this.prisma.capaAction.create({
      data: {
        tenantId,
        rcaCaseId,
        kind,
        description: input.description.trim(),
        ownerId: input.ownerId ?? actor.sub,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: "OPEN"
      }
    });
  }

  async updateCapa(
    actor: Actor,
    id: string,
    input: { status?: string; verificationNote?: string; dueDate?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const existing = await this.prisma.capaAction.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("CAPA action not found");

    if (input.status) {
      const status = input.status.toUpperCase();
      if (!(CAPA_STATUSES as readonly string[]).includes(status)) {
        throw new BadRequestException("Invalid CAPA status");
      }
    }

    const status = input.status?.toUpperCase();
    return this.prisma.capaAction.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(input.verificationNote != null ? { verificationNote: input.verificationNote } : {}),
        ...(input.dueDate != null ? { dueDate: new Date(input.dueDate) } : {}),
        ...(status === "VERIFIED" ? { verifiedAt: new Date() } : {}),
        ...(status === "CLOSED" ? { closedAt: new Date() } : {})
      }
    });
  }

  // ── Work permits ───────────────────────────────────────────────────

  async listPermits(actor: Actor, query: { workOrderId?: string; status?: string } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.workPermit.findMany({
      where: {
        tenantId,
        ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
        ...(query.status ? { status: query.status.toUpperCase() } : {})
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createPermit(
    actor: Actor,
    input: {
      workOrderId: string;
      permitType: string;
      hazards?: string[];
      ppe?: string[];
      validFrom?: string;
      validTo?: string;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    await this.assertWorkOrder(tenantId, input.workOrderId);
    const permitType = input.permitType.trim().toUpperCase();
    if (!(PERMIT_TYPES as readonly string[]).includes(permitType)) {
      throw new BadRequestException(`Invalid permitType. Allowed: ${PERMIT_TYPES.join(", ")}`);
    }

    const count = await this.prisma.workPermit.count({ where: { tenantId } });
    const permitNumber = `PTW-${String(count + 1).padStart(6, "0")}`;

    return this.prisma.workPermit.create({
      data: {
        tenantId,
        workOrderId: input.workOrderId,
        permitNumber,
        permitType,
        status: "DRAFT",
        hazardsJson: JSON.stringify(input.hazards ?? []),
        ppeJson: JSON.stringify(input.ppe ?? []),
        validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
        validTo: input.validTo ? new Date(input.validTo) : null,
        notes: input.notes?.trim() || null,
        issuedById: actor.sub
      }
    });
  }

  async transitionPermit(actor: Actor, id: string, input: { status: string; notes?: string }) {
    const tenantId = requireTenantId(actor.tenantId);
    const existing = await this.prisma.workPermit.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Work permit not found");

    const next = input.status.trim().toUpperCase();
    const allowed = PERMIT_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Invalid permit transition ${existing.status} → ${next}`);
    }

    // Expire check when activating
    if (next === "ACTIVE" && existing.validTo && existing.validTo.getTime() < Date.now()) {
      throw new BadRequestException("Cannot activate an expired permit — extend validTo first");
    }

    return this.prisma.workPermit.update({
      where: { id },
      data: {
        status: next,
        ...(next === "APPROVED" || next === "ACTIVE" ? { approvedById: actor.sub } : {}),
        ...(input.notes != null ? { notes: input.notes } : {})
      }
    });
  }

  async listAssetCriticality(actor: Actor, query: { criticalityLevel?: string } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    const assets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        ...(query.criticalityLevel
          ? { criticalityLevel: query.criticalityLevel.toUpperCase() }
          : {})
      },
      select: {
        id: true,
        assetTag: true,
        name: true,
        criticalityLevel: true,
        criticality: true,
        status: true
      },
      orderBy: [{ criticalityLevel: "asc" }, { assetTag: "asc" }],
      take: 500
    });
    return assets;
  }

  async setAssetCriticality(
    actor: Actor,
    assetId: string,
    input: { criticalityLevel: string; reason?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const level = input.criticalityLevel.trim().toUpperCase();
    const allowed = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NON_CRITICAL"];
    if (!allowed.includes(level)) {
      throw new BadRequestException(`criticalityLevel must be one of: ${allowed.join(", ")}`);
    }

    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundException("Asset not found");

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        criticalityLevel: level,
        criticality: level
      }
    });

    await this.recordHistory(actor, {
      entityType: "AssetCriticality",
      entityId: assetId,
      action: "UPDATE",
      beforeJson: { criticalityLevel: asset.criticalityLevel, criticality: asset.criticality },
      afterJson: { criticalityLevel: level },
      reason: input.reason ?? "Asset criticality updated"
    });

    return updated;
  }

  private async assertWorkOrder(tenantId: string, workOrderId: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: {
        id: true,
        assetId: true,
        downtimeApplicable: true,
        downtimeStartedAt: true,
        failureCodeSnapshot: true,
        causeCodeSnapshot: true,
        maintenanceTemplateSnapshot: true,
        lotoRequired: true
      }
    });
    if (!wo) throw new NotFoundException("Work order not found");
    return wo;
  }

  /**
   * Blocks start when LOTO is required (template safety or ELECTRICAL/HIGH_RISK permit)
   * and no VERIFIED isolation record exists.
   */
  async assertLotoReadyForStart(input: {
    tenantId: string;
    workOrderId: string;
    allowEmergencyOverride?: boolean;
  }): Promise<{ required: boolean; reasons: string[] }> {
    const policy = await this.getOrCreatePolicy(input.tenantId);
    if (!policy.requireLotoWhenPermitRequires) {
      return { required: false, reasons: [] };
    }

    const wo = await this.prisma.workOrder.findFirst({
      where: { id: input.workOrderId, tenantId: input.tenantId },
      select: { maintenanceTemplateSnapshot: true, lotoRequired: true }
    });

    let requiresLoto = Boolean(wo?.lotoRequired);
    if (!requiresLoto && wo?.maintenanceTemplateSnapshot) {
      try {
        const snap = JSON.parse(wo.maintenanceTemplateSnapshot) as { safetyRequirements?: string[] };
        requiresLoto = (snap.safetyRequirements ?? []).some((s) => String(s).toUpperCase().includes("LOTO"));
      } catch {
        requiresLoto = false;
      }
    }

    if (!requiresLoto) {
      const permits = await this.prisma.workPermit.findMany({
        where: {
          tenantId: input.tenantId,
          workOrderId: input.workOrderId,
          status: { in: ["APPROVED", "ACTIVE"] },
          permitType: { in: ["ELECTRICAL", "HIGH_RISK_MACHINERY", "CONFINED_SPACE"] }
        },
        select: { id: true }
      });
      requiresLoto = permits.length > 0;
    }

    if (!requiresLoto) {
      return { required: false, reasons: [] };
    }

    const verified = await this.prisma.lotoRecord.findFirst({
      where: {
        tenantId: input.tenantId,
        workOrderId: input.workOrderId,
        status: "VERIFIED"
      }
    });

    if (verified) {
      return { required: true, reasons: [] };
    }

    const reasons = ["LOTO isolation must be verified before starting this work order"];
    if (input.allowEmergencyOverride) {
      return { required: true, reasons: [...reasons, "Emergency override accepted"] };
    }

    throw new BadRequestException({
      code: "SAFETY_BLOCK",
      message: "Cannot start work — LOTO requirements incomplete",
      reasons
    });
  }

  // ── Condition monitoring (CBM) ─────────────────────────────────────

  async listConditionRules(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.conditionMonitoringRule.findMany({
      where: { tenantId },
      orderBy: { code: "asc" }
    });
  }

  async upsertConditionRule(
    actor: Actor,
    input: {
      code: string;
      name: string;
      measurementType: string;
      assetId?: string;
      meterId?: string;
      upperWarning?: number | null;
      upperCritical?: number | null;
      lowerWarning?: number | null;
      lowerCritical?: number | null;
      consecutiveBreaches?: number;
      actionOnWarning?: string;
      actionOnCritical?: string;
      active?: boolean;
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const code = input.code.trim().toUpperCase();
    if (!code || !input.name?.trim()) throw new BadRequestException("code and name are required");

    const data = {
      name: input.name.trim(),
      measurementType: input.measurementType.trim().toUpperCase(),
      assetId: input.assetId ?? null,
      meterId: input.meterId ?? null,
      upperWarning: input.upperWarning ?? null,
      upperCritical: input.upperCritical ?? null,
      lowerWarning: input.lowerWarning ?? null,
      lowerCritical: input.lowerCritical ?? null,
      consecutiveBreaches: input.consecutiveBreaches ?? 1,
      actionOnWarning: (input.actionOnWarning ?? "ALERT").toUpperCase(),
      actionOnCritical: (input.actionOnCritical ?? "CREATE_REQUEST").toUpperCase(),
      active: input.active ?? true
    };

    const saved = await this.prisma.conditionMonitoringRule.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: { tenantId, code, ...data },
      update: data
    });

    await this.recordHistory(actor, {
      entityType: "ConditionMonitoringRule",
      entityId: saved.id,
      action: "UPSERT",
      afterJson: saved,
      reason: input.reason ?? "Condition rule saved"
    });

    return saved;
  }

  async listConditionEvents(actor: Actor, query: { status?: string; severity?: string } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.conditionEvent.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status.toUpperCase() } : {}),
        ...(query.severity ? { severity: query.severity.toUpperCase() } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { rule: { select: { code: true, name: true } } }
    });
  }

  async evaluateMeterReading(input: {
    tenantId: string;
    meterId: string;
    assetId?: string | null;
    meterType: string;
    value: number;
  }) {
    const now = new Date();
    const rules = await this.prisma.conditionMonitoringRule.findMany({
      where: {
        tenantId: input.tenantId,
        active: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
      }
    });

    const applicable = rules.filter((rule) => {
      if (rule.meterId && rule.meterId === input.meterId) return true;
      if (rule.meterId) return false;
      const typeOk =
        rule.measurementType === "GENERIC" ||
        rule.measurementType === input.meterType.toUpperCase();
      if (!typeOk) return false;
      if (rule.assetId && rule.assetId !== input.assetId) return false;
      return true;
    });

    const triggered: Array<{ ruleId: string; severity: string; message: string }> = [];

    for (const rule of applicable) {
      let severity: "WARNING" | "CRITICAL" | null = null;
      let threshold: number | null = null;

      if (rule.upperCritical != null && input.value >= rule.upperCritical) {
        severity = "CRITICAL";
        threshold = rule.upperCritical;
      } else if (rule.lowerCritical != null && input.value <= rule.lowerCritical) {
        severity = "CRITICAL";
        threshold = rule.lowerCritical;
      } else if (rule.upperWarning != null && input.value >= rule.upperWarning) {
        severity = "WARNING";
        threshold = rule.upperWarning;
      } else if (rule.lowerWarning != null && input.value <= rule.lowerWarning) {
        severity = "WARNING";
        threshold = rule.lowerWarning;
      }

      if (!severity) continue;

      const dedupeKey = `${rule.id}:${input.meterId}:${severity}:OPEN`;
      const existing = await this.prisma.conditionEvent.findUnique({
        where: { tenantId_dedupeKey: { tenantId: input.tenantId, dedupeKey } }
      });

      if (existing && existing.status === "OPEN") {
        await this.prisma.conditionEvent.update({
          where: { id: existing.id },
          data: {
            breachCount: { increment: 1 },
            readingValue: input.value,
            thresholdValue: threshold
          }
        });
        if (existing.breachCount + 1 < (rule.consecutiveBreaches || 1)) {
          continue;
        }
      } else if (!existing) {
        const message = `${rule.name}: ${severity} breach value=${input.value} threshold=${threshold}`;
        await this.prisma.conditionEvent.create({
          data: {
            tenantId: input.tenantId,
            ruleId: rule.id,
            assetId: input.assetId ?? rule.assetId,
            meterId: input.meterId,
            severity,
            readingValue: input.value,
            thresholdValue: threshold,
            status: "OPEN",
            breachCount: 1,
            message,
            dedupeKey
          }
        });
        if ((rule.consecutiveBreaches || 1) > 1) {
          continue;
        }
      }

      triggered.push({
        ruleId: rule.id,
        severity,
        message: `${rule.name}: ${severity} (${input.value})`
      });
    }

    return { triggered, ruleCount: applicable.length };
  }

  async resolveConditionEvent(actor: Actor, id: string, status: string = "RESOLVED") {
    const tenantId = requireTenantId(actor.tenantId);
    const event = await this.prisma.conditionEvent.findFirst({ where: { id, tenantId } });
    if (!event) throw new NotFoundException("Condition event not found");
    const next = status.toUpperCase();
    if (!["ACKNOWLEDGED", "RESOLVED", "SUPPRESSED"].includes(next)) {
      throw new BadRequestException("Invalid status");
    }
    return this.prisma.conditionEvent.update({
      where: { id },
      data: {
        status: next,
        ...(next === "RESOLVED" || next === "SUPPRESSED" ? { resolvedAt: new Date() } : {})
      }
    });
  }

  // ── LOTO ───────────────────────────────────────────────────────────

  async listLoto(actor: Actor, workOrderId?: string) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.lotoRecord.findMany({
      where: {
        tenantId,
        ...(workOrderId ? { workOrderId } : {})
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createLoto(
    actor: Actor,
    input: {
      workOrderId: string;
      workPermitId?: string;
      energySources?: string[];
      isolationPoints?: string[];
      lockTagIds?: string[];
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    await this.assertWorkOrder(tenantId, input.workOrderId);
    return this.prisma.lotoRecord.create({
      data: {
        tenantId,
        workOrderId: input.workOrderId,
        workPermitId: input.workPermitId ?? null,
        energySourcesJson: JSON.stringify(input.energySources ?? []),
        isolationPointsJson: JSON.stringify(input.isolationPoints ?? []),
        lockTagIdsJson: JSON.stringify(input.lockTagIds ?? []),
        notes: input.notes?.trim() || null,
        status: "DRAFT"
      }
    });
  }

  async transitionLoto(
    actor: Actor,
    id: string,
    input: { status: string; notes?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const existing = await this.prisma.lotoRecord.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("LOTO record not found");

    const next = input.status.trim().toUpperCase();
    const allowed: Record<string, string[]> = {
      DRAFT: ["ISOLATED", "CANCELLED"],
      ISOLATED: ["VERIFIED", "CANCELLED"],
      VERIFIED: ["RESTORED"],
      RESTORED: [],
      CANCELLED: []
    };
    if (!(allowed[existing.status] ?? []).includes(next)) {
      throw new BadRequestException(`Invalid LOTO transition ${existing.status} → ${next}`);
    }

    if (next === "VERIFIED" && existing.isolatedById === actor.sub) {
      throw new BadRequestException({
        code: "SOD_VIOLATION",
        message: "Isolating person cannot verify their own LOTO"
      });
    }

    return this.prisma.lotoRecord.update({
      where: { id },
      data: {
        status: next,
        ...(input.notes != null ? { notes: input.notes } : {}),
        ...(next === "ISOLATED"
          ? { isolatedById: actor.sub, isolatedAt: new Date() }
          : {}),
        ...(next === "VERIFIED"
          ? { verifiedById: actor.sub, verifiedAt: new Date() }
          : {}),
        ...(next === "RESTORED"
          ? { restoredById: actor.sub, restoredAt: new Date() }
          : {})
      }
    });
  }

  private async recordHistory(
    actor: Actor,
    input: {
      entityType: string;
      entityId: string;
      action: string;
      beforeJson?: unknown;
      afterJson?: unknown;
      reason: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const version =
      (await this.prisma.configChangeHistory.count({
        where: { tenantId, entityType: input.entityType, entityId: input.entityId }
      })) + 1;

    await this.prisma.configChangeHistory.create({
      data: {
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        version,
        action: input.action,
        beforeJson: input.beforeJson ? JSON.stringify(input.beforeJson) : null,
        afterJson: input.afterJson ? JSON.stringify(input.afterJson) : null,
        reason: input.reason,
        actorId: actor.sub
      }
    });
  }
}
