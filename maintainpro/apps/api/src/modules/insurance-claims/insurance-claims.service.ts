import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, InsuranceClaimStatus, Prisma } from "@prisma/client";

import { assertTenantEntityExists, requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import { Phase4Actor, assertActor, isValidObjectId, recordPhase4Audit } from "../_phase4/phase4-audit.helper";

export interface CreateInsuranceClaimInput {
  vehicleId: string;
  accidentId?: string;
  policyNumber: string;
  insurerName: string;
  claimAmount: number;
  documents?: string[];
  notes?: string;
}

@Injectable()
export class InsuranceClaimsService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextClaimNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.insuranceClaim.count({
      where: { createdAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59.999Z`) } }
    });
    return `INS-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  private async assertVehicleAccess(vehicleId: string, actor: Phase4Actor) {
    if (!isValidObjectId(vehicleId)) throw new BadRequestException("Invalid vehicleId");
    // Fail-closed + cross-tenant FK validation: resolve the vehicle by id AND tenant.
    const tenantId = requireTenantId(actor?.tenantId);
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    return vehicle;
  }

  private async assertAccess(id: string, actor: Phase4Actor) {
    const tenantId = requireTenantId(actor?.tenantId);
    const claim = await this.prisma.insuranceClaim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException("Insurance claim not found");
    return claim;
  }

  async list(actor: Phase4Actor, filters?: { vehicleId?: string; status?: InsuranceClaimStatus }) {
    const tenantId = requireTenantId(actor?.tenantId);
    const where: Prisma.InsuranceClaimWhereInput = {
      tenantId,
      ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters?.status ? { status: filters.status } : {})
    };
    return this.prisma.insuranceClaim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: { select: { id: true, registrationNo: true } },
        accident: { select: { id: true, reportNumber: true } }
      },
      take: 200
    });
  }

  async findOne(id: string, actor: Phase4Actor) {
    return this.assertAccess(id, actor);
  }

  async create(input: CreateInsuranceClaimInput, actor: Phase4Actor) {
    const a = assertActor(actor);
    const vehicle = await this.assertVehicleAccess(input.vehicleId, a);
    if (!input.policyNumber?.trim()) throw new BadRequestException("policyNumber is required");
    if (!input.insurerName?.trim()) throw new BadRequestException("insurerName is required");
    if (!(input.claimAmount > 0)) throw new BadRequestException("claimAmount must be > 0");
    if (input.accidentId && !isValidObjectId(input.accidentId)) throw new BadRequestException("Invalid accidentId");

    // Cross-tenant FK validation: a linked accident must belong to the tenant.
    if (input.accidentId) {
      await assertTenantEntityExists(this.prisma.accidentReport, input.accidentId, {
        tenantId: vehicle.tenantId,
        entityName: "Accident report"
      });
    }

    const claimNumber = await this.nextClaimNumber();
    const created = await this.prisma.insuranceClaim.create({
      data: {
        tenantId: vehicle.tenantId,
        claimNumber,
        vehicleId: vehicle.id,
        accidentId: input.accidentId,
        policyNumber: input.policyNumber,
        insurerName: input.insurerName,
        claimAmount: input.claimAmount,
        status: InsuranceClaimStatus.DRAFT,
        documents: input.documents ?? [],
        notes: input.notes,
        filedById: a.sub
      }
    });
    await recordPhase4Audit(this.prisma, {
      entity: "InsuranceClaim",
      entityId: created.id,
      action: AuditAction.CREATE,
      module: "insurance",
      actor: a,
      reason: `Insurance claim created (${claimNumber})`,
      metadata: { action: "create", claimNumber, vehicleId: vehicle.id, claimAmount: created.claimAmount },
      afterData: created as unknown as Prisma.InputJsonValue
    });
    return created;
  }

  async updateStatus(
    id: string,
    body: { status: InsuranceClaimStatus; approvedAmount?: number; notes?: string },
    actor: Phase4Actor
  ) {
    const a = assertActor(actor);
    const existing = await this.assertAccess(id, a);
    const data: Prisma.InsuranceClaimUpdateInput = {
      status: body.status,
      ...(body.approvedAmount !== undefined && { approvedAmount: body.approvedAmount }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.status === InsuranceClaimStatus.FILED && !existing.filedAt && { filedAt: new Date() }),
      ...(body.status === InsuranceClaimStatus.SETTLED && { settledAt: new Date() })
    };
    const updated = await this.prisma.insuranceClaim.update({ where: { id }, data });
    await recordPhase4Audit(this.prisma, {
      entity: "InsuranceClaim",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "insurance",
      actor: a,
      reason: `Claim status: ${existing.status} → ${body.status}`,
      metadata: { action: "status_change", previousStatus: existing.status, newStatus: body.status, approvedAmount: body.approvedAmount },
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async update(id: string, body: { policyNumber?: string; insurerName?: string; documents?: string[]; notes?: string }, actor: Phase4Actor) {
    const a = assertActor(actor);
    const existing = await this.assertAccess(id, a);
    const updated = await this.prisma.insuranceClaim.update({ where: { id }, data: body });
    await recordPhase4Audit(this.prisma, {
      entity: "InsuranceClaim",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "insurance",
      actor: a,
      reason: "Claim updated",
      metadata: { action: "update", changedKeys: Object.keys(body) },
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }
}
