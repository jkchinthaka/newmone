import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AccidentEvidenceType,
  AccidentResponsibility,
  AccidentSeverity,
  AccidentStatus,
  AuditAction,
  Prisma,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { assertTenantEntityExists, requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import { Phase4Actor, assertActor, isValidObjectId, recordPhase4Audit } from "../_phase4/phase4-audit.helper";

export interface CreateAccidentInput {
  vehicleId: string;
  driverId?: string;
  occurredAt: string;
  location: string;
  description: string;
  severity?: AccidentSeverity;
  responsibility?: AccidentResponsibility;
  thirdPartyInvolved?: boolean;
  thirdPartyDetails?: string;
  policeReportNo?: string;
  estimatedDamageCost?: number;
  notes?: string;
}

@Injectable()
export class AccidentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextReportNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.accidentReport.count({
      where: { createdAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59.999Z`) } }
    });
    return `ACC-${year}-${String(count + 1).padStart(5, "0")}`;
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
    const acc = await this.prisma.accidentReport.findFirst({
      where: { id, tenantId },
      include: { evidence: true, workOrders: true }
    });
    if (!acc) throw new NotFoundException("Accident report not found");
    return this.withPrimaryWorkOrder(acc);
  }

  private withPrimaryWorkOrder<T extends { workOrders?: unknown[] }>(record: T) {
    const { workOrders, ...rest } = record;
    return {
      ...rest,
      workOrder: workOrders?.[0] ?? null
    };
  }

  async list(actor: Phase4Actor, filters?: { vehicleId?: string; status?: AccidentStatus }) {
    const tenantId = requireTenantId(actor?.tenantId);
    const where: Prisma.AccidentReportWhereInput = {
      tenantId,
      ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters?.status ? { status: filters.status } : {})
    };
    return this.prisma.accidentReport.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      include: {
        vehicle: { select: { id: true, registrationNo: true } },
        driver: { select: { id: true, licenseNumber: true } },
        evidence: true,
        workOrders: { select: { id: true, woNumber: true, status: true } }
      },
      take: 200
    }).then((rows) => rows.map((row) => this.withPrimaryWorkOrder(row)));
  }

  async findOne(id: string, actor: Phase4Actor) {
    return this.assertAccess(id, actor);
  }

  async create(input: CreateAccidentInput, actor: Phase4Actor) {
    const a = assertActor(actor);
    const vehicle = await this.assertVehicleAccess(input.vehicleId, a);
    if (!input.occurredAt) throw new BadRequestException("occurredAt is required");
    if (!input.location?.trim()) throw new BadRequestException("location is required");
    if (!input.description?.trim()) throw new BadRequestException("description is required");

    // Cross-tenant FK validation: an assigned driver must belong to the tenant.
    if (input.driverId) {
      await assertTenantEntityExists(this.prisma.driver, input.driverId, {
        tenantId: vehicle.tenantId,
        entityName: "Driver"
      });
    }

    const reportNumber = await this.nextReportNumber();
    const created = await this.prisma.accidentReport.create({
      data: {
        tenantId: vehicle.tenantId,
        reportNumber,
        vehicleId: vehicle.id,
        driverId: input.driverId,
        reportedById: a.sub,
        occurredAt: new Date(input.occurredAt),
        location: input.location,
        description: input.description,
        severity: input.severity ?? AccidentSeverity.MINOR,
        responsibility: input.responsibility ?? (input.driverId ? AccidentResponsibility.DRIVER : AccidentResponsibility.UNDETERMINED),
        thirdPartyInvolved: input.thirdPartyInvolved ?? false,
        thirdPartyDetails: input.thirdPartyDetails,
        policeReportNo: input.policeReportNo,
        estimatedDamageCost: input.estimatedDamageCost,
        notes: input.notes
      }
    });

    await recordPhase4Audit(this.prisma, {
      entity: "AccidentReport",
      entityId: created.id,
      action: AuditAction.CREATE,
      module: "accidents",
      actor: a,
      reason: `Accident reported (${reportNumber})`,
      metadata: {
        action: "create",
        reportNumber,
        severity: created.severity,
        responsibility: created.responsibility,
        vehicleId: vehicle.id
      },
      afterData: created as unknown as Prisma.InputJsonValue
    });

    return created;
  }

  async update(
    id: string,
    input: Partial<{
      severity: AccidentSeverity;
      responsibility: AccidentResponsibility;
      status: AccidentStatus;
      thirdPartyDetails: string;
      policeReportNo: string;
      estimatedDamageCost: number;
      actualDamageCost: number;
      notes: string;
    }>,
    actor: Phase4Actor
  ) {
    const a = assertActor(actor);
    const existing = await this.assertAccess(id, a);
    const updated = await this.prisma.accidentReport.update({ where: { id }, data: input });
    await recordPhase4Audit(this.prisma, {
      entity: "AccidentReport",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "accidents",
      actor: a,
      reason: "Accident updated",
      metadata: { action: "update", changedKeys: Object.keys(input) },
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async addEvidence(
    accidentId: string,
    body: { evidenceType: AccidentEvidenceType; fileUrl: string; description?: string },
    actor: Phase4Actor
  ) {
    const a = assertActor(actor);
    const acc = await this.assertAccess(accidentId, a);
    if (!body?.fileUrl?.trim()) throw new BadRequestException("fileUrl is required");
    const created = await this.prisma.accidentEvidence.create({
      data: {
        accidentId: acc.id,
        evidenceType: body.evidenceType,
        fileUrl: body.fileUrl,
        description: body.description,
        uploadedById: a.sub
      }
    });
    await recordPhase4Audit(this.prisma, {
      entity: "AccidentEvidence",
      entityId: created.id,
      action: AuditAction.CREATE,
      module: "accidents",
      actor: a,
      reason: `Evidence uploaded for accident ${acc.reportNumber}`,
      metadata: { action: "add_evidence", accidentId: acc.id, evidenceType: created.evidenceType }
    });
    return created;
  }

  async linkWorkOrder(
    accidentId: string,
    body: { technicianId?: string; estimatedCost?: number; priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" },
    actor: Phase4Actor
  ) {
    const a = assertActor(actor);
    const acc = await this.assertAccess(accidentId, a);
    if (acc.workOrder) {
      return acc.workOrder;
    }
    // Cross-tenant FK validation: an assigned technician must belong to the tenant.
    if (body.technicianId) {
      await assertTenantEntityExists(this.prisma.user, body.technicianId, {
        tenantId: acc.tenantId,
        entityName: "Technician"
      });
    }
    const year = new Date().getFullYear();
    const count = await this.prisma.workOrder.count({
      where: { createdAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59.999Z`) } }
    });
    const woNumber = `WO-${year}-${String(count + 1).padStart(5, "0")}`;
    const wo = await this.prisma.workOrder.create({
      data: {
        tenantId: acc.tenantId,
        woNumber,
        title: `Accident repair: ${acc.reportNumber}`,
        description: `Repair following accident on ${acc.occurredAt.toISOString().slice(0, 10)} at ${acc.location}. ${acc.description}`,
        priority: body.priority ?? "HIGH",
        status: WorkOrderStatus.OPEN,
        type: WorkOrderType.ACCIDENT_REPAIR,
        vehicleId: acc.vehicleId,
        createdById: a.sub,
        technicianId: body.technicianId,
        estimatedCost: body.estimatedCost,
        accidentId: acc.id
      }
    });
    await recordPhase4Audit(this.prisma, {
      entity: "AccidentReport",
      entityId: acc.id,
      action: AuditAction.UPDATE,
      module: "accidents",
      actor: a,
      reason: `Work order ${wo.woNumber} created and linked`,
      metadata: { action: "link_work_order", workOrderId: wo.id, woNumber: wo.woNumber }
    });
    return wo;
  }
}
