import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AccidentEvidenceType,
  AccidentSeverity,
  AccidentStatus,
  AuditAction,
  Prisma,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { Phase4Actor, assertActor, isValidObjectId, recordPhase4Audit, resolveTenantId } from "../_phase4/phase4-audit.helper";

export interface CreateAccidentInput {
  vehicleId: string;
  driverId?: string;
  occurredAt: string;
  location: string;
  description: string;
  severity?: AccidentSeverity;
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
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    const tenantId = resolveTenantId(actor);
    if (tenantId !== undefined && vehicle.tenantId && vehicle.tenantId !== tenantId) {
      throw new ForbiddenException("Vehicle not in your tenant");
    }
    return vehicle;
  }

  private async assertAccess(id: string, actor: Phase4Actor) {
    const acc = await this.prisma.accidentReport.findUnique({ where: { id }, include: { evidence: true, workOrder: true } });
    if (!acc) throw new NotFoundException("Accident report not found");
    const tenantId = resolveTenantId(actor);
    if (tenantId !== undefined && acc.tenantId && acc.tenantId !== tenantId) {
      throw new ForbiddenException("Accident not in your tenant");
    }
    return acc;
  }

  async list(actor: Phase4Actor, filters?: { vehicleId?: string; status?: AccidentStatus }) {
    const tenantId = resolveTenantId(actor);
    const where: Prisma.AccidentReportWhereInput = {
      ...(tenantId !== undefined ? { tenantId } : {}),
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
        workOrder: { select: { id: true, woNumber: true, status: true } }
      },
      take: 200
    });
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
      metadata: { action: "create", reportNumber, severity: created.severity, vehicleId: vehicle.id },
      afterData: created as unknown as Prisma.InputJsonValue
    });

    return created;
  }

  async update(
    id: string,
    input: Partial<{
      severity: AccidentSeverity;
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
