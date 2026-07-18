import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  FinePaymentStatus,
  FineResponsibility,
  Prisma,
  VehicleDocumentType,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { assertTenantEntityExists, requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import { VehicleDocumentsService } from "../vehicle-documents/vehicle-documents.service";
import { Phase4Actor, assertActor, isValidObjectId, recordPhase4Audit } from "../_phase4/phase4-audit.helper";

const DOC_DEPENDENT_OFFENSES: VehicleDocumentType[] = [
  VehicleDocumentType.INSURANCE,
  VehicleDocumentType.FITNESS,
  VehicleDocumentType.POLLUTION,
  VehicleDocumentType.ROAD_TAX,
  VehicleDocumentType.REGISTRATION,
  VehicleDocumentType.PERMIT
];

export interface CreateTrafficFineInput {
  vehicleId: string;
  driverId?: string;
  fineDate: string;
  dueDate?: string;
  offense: string;
  violationCode?: string;
  location?: string;
  fineAmount: number;
  responsibility?: FineResponsibility;
  documentRelated?: boolean;
  relatedDocumentType?: VehicleDocumentType;
  issuingAuthority?: string;
  evidenceUrls?: string[];
  notes?: string;
}

@Injectable()
export class TrafficFinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicleDocuments: VehicleDocumentsService
  ) {}

  private async nextFineNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.trafficFine.count({
      where: { createdAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59.999Z`) } }
    });
    return `FIN-${year}-${String(count + 1).padStart(5, "0")}`;
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
    const fine = await this.prisma.trafficFine.findFirst({ where: { id, tenantId }, include: { workOrders: true } });
    if (!fine) throw new NotFoundException("Traffic fine not found");
    return this.withPrimaryWorkOrder(fine);
  }

  private withPrimaryWorkOrder<T extends { workOrders?: unknown[] }>(record: T) {
    const { workOrders, ...rest } = record;
    return {
      ...rest,
      workOrder: workOrders?.[0] ?? null
    };
  }

  async list(
    actor: Phase4Actor,
    filters?: { vehicleId?: string; driverId?: string; paymentStatus?: FinePaymentStatus; responsibility?: FineResponsibility }
  ) {
    const tenantId = requireTenantId(actor?.tenantId);
    const where: Prisma.TrafficFineWhereInput = {
      tenantId,
      ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters?.driverId ? { driverId: filters.driverId } : {}),
      ...(filters?.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
      ...(filters?.responsibility ? { responsibility: filters.responsibility } : {})
    };
    return this.prisma.trafficFine.findMany({
      where,
      orderBy: { fineDate: "desc" },
      include: {
        vehicle: { select: { id: true, registrationNo: true } },
        driver: { select: { id: true, licenseNumber: true } },
        workOrders: { select: { id: true, woNumber: true, status: true } }
      },
      take: 200
    }).then((rows) => rows.map((row) => this.withPrimaryWorkOrder(row)));
  }

  async findOne(id: string, actor: Phase4Actor) {
    return this.assertAccess(id, actor);
  }

  async create(input: CreateTrafficFineInput, actor: Phase4Actor) {
    const a = assertActor(actor);
    const vehicle = await this.assertVehicleAccess(input.vehicleId, a);
    if (!input.fineDate) throw new BadRequestException("fineDate is required");
    if (!input.offense?.trim()) throw new BadRequestException("offense is required");
    if (!(input.fineAmount >= 0)) throw new BadRequestException("fineAmount must be >= 0");

    const fineDate = new Date(input.fineDate);
    if (isNaN(fineDate.getTime())) throw new BadRequestException("Invalid fineDate");

    // Cross-tenant FK validation: an assigned driver must belong to the tenant.
    if (input.driverId) {
      await assertTenantEntityExists(this.prisma.driver, input.driverId, {
        tenantId: vehicle.tenantId,
        entityName: "Driver"
      });
    }

    let documentRelated = !!input.documentRelated;
    let responsibility: FineResponsibility = input.responsibility ?? FineResponsibility.UNDETERMINED;
    let docCheckResult: { type: VehicleDocumentType; valid: boolean; documentId?: string } | null = null;

    if (input.relatedDocumentType && DOC_DEPENDENT_OFFENSES.includes(input.relatedDocumentType)) {
      const validDoc = await this.vehicleDocuments.findValidOnDate(vehicle.id, input.relatedDocumentType, fineDate);
      docCheckResult = { type: input.relatedDocumentType, valid: !!validDoc, documentId: validDoc?.id };
      if (!validDoc) {
        documentRelated = true;
        responsibility = FineResponsibility.ORGANIZATION;
      }
    }

    const fineNumber = await this.nextFineNumber();
    const created = await this.prisma.trafficFine.create({
      data: {
        tenantId: vehicle.tenantId,
        fineNumber,
        vehicleId: vehicle.id,
        driverId: input.driverId,
        reportedById: a.sub,
        fineDate,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        description: input.offense,
        violationCode: input.violationCode,
        location: input.location,
        fineAmount: input.fineAmount,
        issuingAuthority: input.issuingAuthority,
        responsibility,
        documentRelated,
        evidenceUrls: input.evidenceUrls ?? [],
        notes: input.notes,
        paymentStatus: FinePaymentStatus.PENDING
      }
    });

    await recordPhase4Audit(this.prisma, {
      entity: "TrafficFine",
      entityId: created.id,
      action: AuditAction.CREATE,
      module: "fines",
      actor: a,
      reason: `Traffic fine recorded (${fineNumber})`,
      metadata: {
        action: "create",
        fineNumber,
        vehicleId: vehicle.id,
        documentRelated,
        responsibility,
        relatedDocumentType: input.relatedDocumentType,
        docValidityCheck: docCheckResult
      },
      afterData: created as unknown as Prisma.InputJsonValue
    });

    return created;
  }

  async updateResponsibility(id: string, body: { responsibility: FineResponsibility; reason?: string }, actor: Phase4Actor) {
    const a = assertActor(actor);
    const existing = await this.assertAccess(id, a);
    const updated = await this.prisma.trafficFine.update({
      where: { id },
      data: { responsibility: body.responsibility }
    });
    await recordPhase4Audit(this.prisma, {
      entity: "TrafficFine",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "fines",
      actor: a,
      reason: body.reason ?? "Responsibility updated",
      metadata: { action: "responsibility_change", previousResponsibility: existing.responsibility, newResponsibility: body.responsibility }
    });
    return updated;
  }

  async updatePayment(
    id: string,
    body: { status: FinePaymentStatus; paidAmount?: number; paidAt?: string; paymentReference?: string },
    actor: Phase4Actor
  ) {
    const a = assertActor(actor);
    const existing = await this.assertAccess(id, a);
    const updated = await this.prisma.trafficFine.update({
      where: { id },
      data: {
        paymentStatus: body.status,
        ...(body.paidAmount !== undefined && { paidAmount: body.paidAmount }),
        ...(body.paidAt !== undefined && { paidAt: new Date(body.paidAt) }),
        ...(body.status === FinePaymentStatus.PAID && !body.paidAt && { paidAt: new Date() }),
        ...(body.paymentReference !== undefined && { paymentReference: body.paymentReference })
      }
    });
    await recordPhase4Audit(this.prisma, {
      entity: "TrafficFine",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "fines",
      actor: a,
      reason: `Payment: ${existing.paymentStatus} → ${body.status}`,
      metadata: { action: "payment_update", previousStatus: existing.paymentStatus, newStatus: body.status, paidAmount: body.paidAmount }
    });
    return updated;
  }

  async linkWorkOrder(id: string, body: { technicianId?: string; estimatedCost?: number }, actor: Phase4Actor) {
    const a = assertActor(actor);
    const fine = await this.assertAccess(id, a);
    if (fine.responsibility !== FineResponsibility.VEHICLE_DEFECT) {
      throw new BadRequestException("Work order can only be linked when responsibility is VEHICLE_DEFECT");
    }
    if (fine.workOrder) {
      return fine.workOrder;
    }
    // Cross-tenant FK validation: an assigned technician must belong to the tenant.
    if (body.technicianId) {
      await assertTenantEntityExists(this.prisma.user, body.technicianId, {
        tenantId: fine.tenantId,
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
        tenantId: fine.tenantId,
        woNumber,
        title: `Defect repair from fine ${fine.fineNumber}`,
        description: `Traffic fine ${fine.fineNumber} indicates vehicle defect. Offense: ${fine.description}.`,
        priority: "HIGH",
        status: WorkOrderStatus.OPEN,
        type: WorkOrderType.CORRECTIVE,
        vehicleId: fine.vehicleId,
        createdById: a.sub,
        technicianId: body.technicianId,
        estimatedCost: body.estimatedCost,
        trafficFineId: fine.id
      }
    });
    await recordPhase4Audit(this.prisma, {
      entity: "TrafficFine",
      entityId: fine.id,
      action: AuditAction.UPDATE,
      module: "fines",
      actor: a,
      reason: `Work order ${wo.woNumber} created from fine`,
      metadata: { action: "link_work_order", workOrderId: wo.id, woNumber: wo.woNumber }
    });
    return wo;
  }
}
