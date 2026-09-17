import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

const SUBJECT_TYPES = [
  "ASSET",
  "VEHICLE",
  "MACHINE",
  "TYRE",
  "BATTERY",
  "SPARE_PART",
  "SERIALIZED_COMPONENT",
  "VENDOR_REPAIR"
] as const;

const CLAIM_STATUSES = [
  "ELIGIBLE",
  "PREPARED",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
  "RECOVERED",
  "CLOSED"
] as const;

const CLAIM_TRANSITIONS: Record<string, string[]> = {
  ELIGIBLE: ["PREPARED", "CLOSED"],
  PREPARED: ["SUBMITTED", "CLOSED"],
  SUBMITTED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["RECOVERED", "CLOSED"],
  REJECTED: ["CLOSED", "PREPARED"],
  RECOVERED: ["CLOSED"],
  CLOSED: []
};

@Injectable()
export class WarrantiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: Actor,
    query: { subjectType?: string; subjectId?: string; status?: string } = {}
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.entityWarranty.findMany({
      where: {
        tenantId,
        ...(query.subjectType ? { subjectType: query.subjectType.toUpperCase() } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.status ? { status: query.status.toUpperCase() } : {})
      },
      orderBy: { endDate: "desc" },
      include: { _count: { select: { claims: true } } }
    });
  }

  async create(
    actor: Actor,
    input: {
      subjectType: string;
      subjectId: string;
      provider: string;
      reference?: string;
      coverageType?: string;
      coverageNotes?: string;
      startDate: string;
      endDate: string;
      mileageLimit?: number;
      hourLimit?: number;
      documentUrls?: string[];
      policyAction?: string;
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const subjectType = input.subjectType.trim().toUpperCase();
    if (!(SUBJECT_TYPES as readonly string[]).includes(subjectType)) {
      throw new BadRequestException("Invalid subjectType");
    }
    if (!input.provider?.trim()) throw new BadRequestException("provider is required");
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("Invalid warranty dates");
    }
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException("endDate must be on or after startDate");
    }

    const policyAction = (input.policyAction ?? "WARN").toUpperCase();
    const allowedPolicy = ["WARN", "APPROVAL_REQUIRED", "RESTRICT_EXTERNAL", "VENDOR_RETURN"];
    if (!allowedPolicy.includes(policyAction)) {
      throw new BadRequestException("Invalid policyAction");
    }

    const created = await this.prisma.entityWarranty.create({
      data: {
        tenantId,
        subjectType,
        subjectId: input.subjectId,
        provider: input.provider.trim(),
        reference: input.reference?.trim() || null,
        coverageType: input.coverageType?.trim() || null,
        coverageNotes: input.coverageNotes?.trim() || null,
        startDate,
        endDate,
        mileageLimit: input.mileageLimit ?? null,
        hourLimit: input.hourLimit ?? null,
        documentUrlsJson: JSON.stringify(input.documentUrls ?? []),
        status: endDate.getTime() < Date.now() ? "EXPIRED" : "ACTIVE",
        policyAction,
        createdById: actor.sub
      }
    });

    await this.recordHistory(actor, {
      entityType: "EntityWarranty",
      entityId: created.id,
      action: "CREATE",
      reason: input.reason ?? "Warranty created",
      afterJson: created
    });

    return created;
  }

  /** Active warranties covering an asset and/or vehicle for WO context. */
  async findActiveForSubjects(
    tenantId: string,
    subjects: Array<{ subjectType: string; subjectId: string }>
  ) {
    if (subjects.length === 0) return [];
    const now = new Date();
    const or = subjects.map((s) => ({
      subjectType: s.subjectType,
      subjectId: s.subjectId
    }));
    return this.prisma.entityWarranty.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        startDate: { lte: now },
        endDate: { gte: now },
        OR: or
      },
      orderBy: { endDate: "asc" }
    });
  }

  async listClaims(actor: Actor, query: { warrantyId?: string; workOrderId?: string; status?: string } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.warrantyClaim.findMany({
      where: {
        tenantId,
        ...(query.warrantyId ? { warrantyId: query.warrantyId } : {}),
        ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
        ...(query.status ? { status: query.status.toUpperCase() } : {})
      },
      orderBy: { createdAt: "desc" },
      include: {
        warranty: {
          select: {
            id: true,
            provider: true,
            reference: true,
            subjectType: true,
            subjectId: true,
            endDate: true
          }
        }
      }
    });
  }

  async createClaim(
    actor: Actor,
    input: {
      warrantyId: string;
      workOrderId?: string;
      claimAmount?: number;
      notes?: string;
      documentUrls?: string[];
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const warranty = await this.prisma.entityWarranty.findFirst({
      where: { id: input.warrantyId, tenantId }
    });
    if (!warranty) throw new NotFoundException("Warranty not found");

    if (input.workOrderId) {
      const wo = await this.prisma.workOrder.findFirst({
        where: { id: input.workOrderId, tenantId },
        select: { id: true }
      });
      if (!wo) throw new NotFoundException("Work order not found");
    }

    const claimNumber = await this.nextClaimNumber(tenantId);
    const created = await this.prisma.warrantyClaim.create({
      data: {
        tenantId,
        warrantyId: warranty.id,
        workOrderId: input.workOrderId || null,
        claimNumber,
        status: "ELIGIBLE",
        claimAmount: input.claimAmount ?? null,
        notes: input.notes?.trim() || null,
        documentUrlsJson: JSON.stringify(input.documentUrls ?? []),
        createdById: actor.sub,
        updatedById: actor.sub
      }
    });

    await this.recordHistory(actor, {
      entityType: "WarrantyClaim",
      entityId: created.id,
      action: "CREATE",
      reason: input.reason ?? "Warranty claim created",
      afterJson: created
    });

    return created;
  }

  async transitionClaim(
    actor: Actor,
    claimId: string,
    input: {
      status: string;
      approvedAmount?: number;
      recoveredAmount?: number;
      notes?: string;
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const claim = await this.prisma.warrantyClaim.findFirst({
      where: { id: claimId, tenantId }
    });
    if (!claim) throw new NotFoundException("Warranty claim not found");

    const next = input.status.trim().toUpperCase();
    if (!(CLAIM_STATUSES as readonly string[]).includes(next)) {
      throw new BadRequestException("Invalid claim status");
    }
    const allowed = CLAIM_TRANSITIONS[claim.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Cannot transition claim from ${claim.status} to ${next}`);
    }

    const updated = await this.prisma.warrantyClaim.update({
      where: { id: claimId },
      data: {
        status: next,
        approvedAmount: input.approvedAmount ?? undefined,
        recoveredAmount: input.recoveredAmount ?? undefined,
        notes: input.notes !== undefined ? input.notes : undefined,
        submittedAt: next === "SUBMITTED" ? new Date() : undefined,
        responseAt: ["ACCEPTED", "REJECTED"].includes(next) ? new Date() : undefined,
        updatedById: actor.sub
      }
    });

    await this.recordHistory(actor, {
      entityType: "WarrantyClaim",
      entityId: claimId,
      action: "STATUS_CHANGE",
      reason: input.reason ?? `Claim ${claim.status} → ${next}`,
      beforeJson: claim,
      afterJson: updated
    });

    return updated;
  }

  private async nextClaimNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const prefix = `WC-${year}-`;
    const latest = await this.prisma.warrantyClaim.findFirst({
      where: { tenantId, claimNumber: { startsWith: prefix } },
      orderBy: { claimNumber: "desc" },
      select: { claimNumber: true }
    });
    const seq = latest ? Number(latest.claimNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
  }

  private async recordHistory(
    actor: Actor,
    input: {
      entityType: string;
      entityId: string;
      action: string;
      reason?: string;
      beforeJson?: unknown;
      afterJson?: unknown;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const priorCount = await this.prisma.configChangeHistory.count({
      where: {
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId
      }
    });
    await this.prisma.configChangeHistory.create({
      data: {
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        reason: input.reason,
        beforeJson: input.beforeJson != null ? JSON.stringify(input.beforeJson) : null,
        afterJson: input.afterJson != null ? JSON.stringify(input.afterJson) : null,
        version: priorCount + 1,
        actorId: actor.sub
      }
    });
  }
}
