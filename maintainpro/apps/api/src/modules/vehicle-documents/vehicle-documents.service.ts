import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, VehicleDocumentStatus, VehicleDocumentType } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { ComplianceService } from "../compliance/compliance.service";
import { Phase4Actor, assertActor, isValidObjectId, recordPhase4Audit, resolveTenantId } from "../_phase4/phase4-audit.helper";

export interface CreateVehicleDocumentInput {
  vehicleId: string;
  documentType: VehicleDocumentType;
  documentNumber?: string;
  issuedDate?: string;
  expiryDate: string;
  issuingAuthority?: string;
  fileUrl?: string;
  notes?: string;
}

export interface UpdateVehicleDocumentInput {
  documentNumber?: string;
  issuedDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  fileUrl?: string;
  notes?: string;
}

@Injectable()
export class VehicleDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly compliance: ComplianceService
  ) {}

  private async assertVehicleAccess(vehicleId: string, actor: Phase4Actor) {
    if (!isValidObjectId(vehicleId)) throw new BadRequestException("Invalid vehicleId");
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    const tenantId = resolveTenantId(actor);
    if (tenantId !== undefined && vehicle.tenantId !== tenantId) {
      throw new ForbiddenException("Vehicle not in your tenant");
    }
    return vehicle;
  }

  async list(vehicleId: string, actor: Phase4Actor) {
    await this.assertVehicleAccess(vehicleId, actor);
    return this.prisma.vehicleDocument.findMany({
      where: { vehicleId },
      orderBy: [{ documentType: "asc" }, { expiryDate: "desc" }],
      include: {
        verifiedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } }
      }
    });
  }

  async findOne(id: string, actor: Phase4Actor) {
    const doc = await this.prisma.vehicleDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");
    const tenantId = resolveTenantId(actor);
    if (tenantId !== undefined && doc.tenantId !== tenantId) {
      throw new ForbiddenException("Document not in your tenant");
    }
    return doc;
  }

  async create(input: CreateVehicleDocumentInput, actor: Phase4Actor) {
    const a = assertActor(actor);
    const vehicle = await this.assertVehicleAccess(input.vehicleId, a);
    if (!input.expiryDate) throw new BadRequestException("expiryDate is required");
    const expiry = new Date(input.expiryDate);
    if (isNaN(expiry.getTime())) throw new BadRequestException("Invalid expiryDate");

    const created = await this.prisma.vehicleDocument.create({
      data: {
        tenantId: vehicle.tenantId,
        vehicleId: vehicle.id,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        issuedDate: input.issuedDate ? new Date(input.issuedDate) : undefined,
        expiryDate: expiry,
        issuingAuthority: input.issuingAuthority,
        fileUrl: input.fileUrl,
        notes: input.notes,
        status: VehicleDocumentStatus.PENDING_VERIFICATION,
        uploadedById: a.sub
      }
    });

    await recordPhase4Audit(this.prisma, {
      entity: "VehicleDocument",
      entityId: created.id,
      action: AuditAction.CREATE,
      module: "compliance",
      actor: a,
      reason: `Uploaded ${input.documentType} document`,
      metadata: { action: "upload", documentType: input.documentType, vehicleId: vehicle.id },
      afterData: created as unknown as Prisma.InputJsonValue
    });

    await this.compliance.refreshAndPersist(vehicle.id);
    return created;
  }

  async update(id: string, input: UpdateVehicleDocumentInput, actor: Phase4Actor) {
    const a = assertActor(actor);
    const existing = await this.findOne(id, a);

    const data: Prisma.VehicleDocumentUpdateInput = {
      ...(input.documentNumber !== undefined && { documentNumber: input.documentNumber }),
      ...(input.issuedDate !== undefined && { issuedDate: new Date(input.issuedDate) }),
      ...(input.expiryDate !== undefined && { expiryDate: new Date(input.expiryDate) }),
      ...(input.issuingAuthority !== undefined && { issuingAuthority: input.issuingAuthority }),
      ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl }),
      ...(input.notes !== undefined && { notes: input.notes })
    };

    const updated = await this.prisma.vehicleDocument.update({ where: { id }, data });

    await recordPhase4Audit(this.prisma, {
      entity: "VehicleDocument",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "compliance",
      actor: a,
      reason: "Updated document fields",
      metadata: { action: "update" },
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });

    await this.compliance.refreshAndPersist(existing.vehicleId);
    return updated;
  }

  async verify(id: string, actor: Phase4Actor) {
    const a = assertActor(actor);
    const existing = await this.findOne(id, a);
    if (existing.status === VehicleDocumentStatus.VERIFIED) {
      return existing;
    }
    const updated = await this.prisma.vehicleDocument.update({
      where: { id },
      data: {
        status: VehicleDocumentStatus.VERIFIED,
        verifiedById: a.sub,
        verifiedAt: new Date(),
        rejectionReason: null
      }
    });
    await recordPhase4Audit(this.prisma, {
      entity: "VehicleDocument",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "compliance",
      actor: a,
      reason: "Document verified",
      metadata: { action: "verify", previousStatus: existing.status }
    });
    await this.compliance.refreshAndPersist(existing.vehicleId);
    return updated;
  }

  async reject(id: string, reason: string, actor: Phase4Actor) {
    const a = assertActor(actor);
    if (!reason?.trim()) throw new BadRequestException("Rejection reason is required");
    const existing = await this.findOne(id, a);
    const updated = await this.prisma.vehicleDocument.update({
      where: { id },
      data: {
        status: VehicleDocumentStatus.REJECTED,
        rejectionReason: reason,
        verifiedById: a.sub,
        verifiedAt: new Date()
      }
    });
    await recordPhase4Audit(this.prisma, {
      entity: "VehicleDocument",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "compliance",
      actor: a,
      reason: `Document rejected: ${reason}`,
      metadata: { action: "reject", rejectionReason: reason, previousStatus: existing.status }
    });
    await this.compliance.refreshAndPersist(existing.vehicleId);
    return updated;
  }

  async remove(id: string, actor: Phase4Actor) {
    const a = assertActor(actor);
    const existing = await this.findOne(id, a);
    await this.prisma.vehicleDocument.delete({ where: { id } });
    await recordPhase4Audit(this.prisma, {
      entity: "VehicleDocument",
      entityId: id,
      action: AuditAction.DELETE,
      module: "compliance",
      actor: a,
      reason: "Document deleted",
      beforeData: existing as unknown as Prisma.InputJsonValue
    });
    await this.compliance.refreshAndPersist(existing.vehicleId);
    return { deleted: true };
  }

  /** Look up the document of `type` that was valid on `onDate` for a vehicle. */
  async findValidOnDate(vehicleId: string, type: VehicleDocumentType, onDate: Date) {
    return this.prisma.vehicleDocument.findFirst({
      where: {
        vehicleId,
        documentType: type,
        status: VehicleDocumentStatus.VERIFIED,
        expiryDate: { gte: onDate }
      },
      orderBy: { expiryDate: "desc" }
    });
  }
}
