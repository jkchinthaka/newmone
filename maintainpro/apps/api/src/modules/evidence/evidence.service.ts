import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  EvidenceAttachmentStatus,
  EvidenceSource,
  EvidenceSyncStatus,
  EvidenceType,
  EvidenceVerificationStatus,
  Prisma,
  QrVerificationStatus,
  RoleName,
  WorkOrderStatus,
  WorkOrderVerificationStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import {
  assertTechnicianAssignedToWorkOrder,
  canOverrideQrMismatch,
  canReviewEvidence,
  canUploadEvidence,
  evidenceDeleteBlockedAfterCompletion,
  isTechnicianFieldRole
} from "../../common/utils/work-order-evidence-rbac";
import {
  evaluateEvidenceRequirements,
  requiresQrVerification
} from "../../common/utils/work-order-evidence-governance";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import {
  buildEvidenceStorageKey,
  EvidenceAttachmentPublic,
  EvidenceConfirmUploadResult,
  EvidenceUploadRequestResult,
  mapEvidenceAttachmentPublic,
  validateEvidenceUploadInput
} from "./evidence-storage.mapper";
import { EvidenceStorageProviderService } from "./evidence-storage-provider.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

type UploadRequestBody = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  evidenceType?: EvidenceType;
  note?: string;
  capturedAt?: string;
  source?: EvidenceSource;
  clientGeneratedId?: string;
};

type CreateEvidenceBody = {
  evidenceType: EvidenceType;
  note?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  capturedAt?: string;
  source?: EvidenceSource;
  clientGeneratedId?: string;
  offlineCreatedAt?: string;
};

const EVIDENCE_SELECT = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  evidenceType: true,
  verificationStatus: true,
  rejectedReason: true,
  note: true,
  isRequired: true,
  capturedAt: true,
  source: true,
  clientGeneratedId: true,
  offlineCreatedAt: true,
  syncedAt: true,
  syncStatus: true,
  syncError: true,
  uploadedById: true,
  createdAt: true,
  uploadedBy: { select: { firstName: true, lastName: true } }
} as const;

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceStorageProvider: EvidenceStorageProviderService
  ) {}

  getReadiness() {
    return this.evidenceStorageProvider.checkReadiness();
  }

  async listWorkOrderEvidence(workOrderId: string, actor?: Actor) {
    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, {
      id: true,
      type: true,
      qrVerificationStatus: true,
      qrVerifiedAt: true,
      assetId: true,
      vehicleId: true,
      technicianCompletionNote: true,
      status: true
    });
    const tenantId = this.resolveTenantId(actor);

    const attachments = await this.prisma.evidenceAttachment.findMany({
      where: {
        workOrderId: workOrder.id,
        deletedAt: null,
        status: { not: EvidenceAttachmentStatus.DELETED },
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      select: EVIDENCE_SELECT,
      orderBy: { createdAt: "desc" }
    });

    const items = attachments.map((attachment) => this.toPublicAttachment(attachment));
    const requirements = evaluateEvidenceRequirements(
      workOrder.type,
      attachments.map((a) => ({
        evidenceType: a.evidenceType,
        status: a.status,
        verificationStatus: a.verificationStatus
      }))
    );

    return {
      workOrderId: workOrder.id,
      items,
      requirements: {
        ...requirements,
        completionNoteProvided: Boolean(workOrder.technicianCompletionNote?.trim()),
        qrVerificationStatus: workOrder.qrVerificationStatus,
        qrRequired: requiresQrVerification(workOrder.type, workOrder.assetId, workOrder.vehicleId)
      },
      checkedAt: new Date().toISOString()
    };
  }

  async createWorkOrderEvidence(workOrderId: string, body: CreateEvidenceBody, actor: Actor) {
    this.assertCanUpload(actor);
    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, {
      id: true,
      tenantId: true,
      status: true,
      facilityIssue: { select: { id: true } }
    });
    await assertTechnicianAssignedToWorkOrder({ actor, workOrderId: workOrder.id, prisma: this.prisma });

    if (body.clientGeneratedId?.trim()) {
      const existing = await this.prisma.evidenceAttachment.findFirst({
        where: {
          workOrderId: workOrder.id,
          clientGeneratedId: body.clientGeneratedId.trim(),
          deletedAt: null
        }
      });
      if (existing) {
        const withSelect = await this.prisma.evidenceAttachment.findFirst({
          where: { id: existing.id },
          select: EVIDENCE_SELECT
        });
        if (!withSelect) {
          throw new NotFoundException("Evidence attachment not found");
        }
        return {
          duplicate: true,
          attachment: this.toPublicAttachment(withSelect),
          message: "Evidence with this client ID was already synced."
        };
      }
    }

    const noteOnlyTypes = new Set<EvidenceType>([
      EvidenceType.TECHNICIAN_NOTE,
      EvidenceType.SUPERVISOR_NOTE
    ]);
    const readiness = this.evidenceStorageProvider.checkReadiness();
    const needsFile = !noteOnlyTypes.has(body.evidenceType);

    if (needsFile) {
      if (readiness.state !== "configured") {
        throw new BadRequestException("File upload storage is not configured.");
      }
      if (!body.fileName || !body.mimeType || !body.sizeBytes) {
        throw new BadRequestException("File metadata is required for this evidence type.");
      }
      return this.createWorkOrderUploadRequest(
        workOrderId,
        {
          fileName: body.fileName,
          mimeType: body.mimeType,
          sizeBytes: body.sizeBytes,
          evidenceType: body.evidenceType,
          note: body.note,
          capturedAt: body.capturedAt,
          source: body.source,
          clientGeneratedId: body.clientGeneratedId
        },
        actor
      );
    }

    const tenantId = workOrder.tenantId ?? actor.tenantId ?? null;
    const attachment = await this.prisma.evidenceAttachment.create({
      data: {
        tenantId,
        workOrderId: workOrder.id,
        facilityIssueId: workOrder.facilityIssue?.id ?? null,
        evidenceType: body.evidenceType,
        fileName: body.fileName?.trim() || `${body.evidenceType.toLowerCase()}.txt`,
        mimeType: body.mimeType?.trim() || "text/plain",
        sizeBytes: body.sizeBytes ?? 0,
        storageProvider: readiness.mode,
        storageKey: buildEvidenceStorageKey({
          tenantId,
          workOrderId: workOrder.id,
          fileName: "note-only"
        }),
        status: EvidenceAttachmentStatus.UPLOADED,
        note: body.note?.trim() || null,
        capturedAt: body.capturedAt ? new Date(body.capturedAt) : null,
        source: body.source ?? EvidenceSource.WEB,
        clientGeneratedId: body.clientGeneratedId?.trim() || null,
        offlineCreatedAt: body.offlineCreatedAt ? new Date(body.offlineCreatedAt) : null,
        syncStatus: body.source === EvidenceSource.OFFLINE_SYNC ? EvidenceSyncStatus.SYNCED : null,
        syncedAt: body.source === EvidenceSource.OFFLINE_SYNC ? new Date() : null,
        uploadedById: actor.sub
      },
      select: EVIDENCE_SELECT
    });

    await this.recordEvidenceAudit({
      event: "evidence_uploaded",
      actor,
      workOrderId: workOrder.id,
      evidenceId: attachment.id,
      evidenceType: attachment.evidenceType,
      source: attachment.source,
      note: attachment.note
    });

    return {
      ok: true,
      attachment: this.toPublicAttachment(attachment),
      message: "Evidence note recorded."
    };
  }

  async createWorkOrderUploadRequest(
    workOrderId: string,
    body: UploadRequestBody,
    actor: Actor
  ): Promise<EvidenceUploadRequestResult> {
    this.assertCanUpload(actor);
    const readiness = this.evidenceStorageProvider.checkReadiness();
    if (readiness.state !== "configured") {
      return this.evidenceStorageProvider.toBlockedUploadRequest(readiness);
    }

    const validation = validateEvidenceUploadInput({
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      maxFileSizeMb: readiness.maxFileSizeMb,
      allowedMimeTypes: readiness.allowedMimeTypes
    });

    if (!validation.ok) {
      throw new BadRequestException(validation.message);
    }

    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, {
      id: true,
      tenantId: true,
      status: true,
      facilityIssue: { select: { id: true } }
    });
    await assertTechnicianAssignedToWorkOrder({ actor, workOrderId: workOrder.id, prisma: this.prisma });

    if (body.clientGeneratedId?.trim()) {
      const existing = await this.prisma.evidenceAttachment.findFirst({
        where: {
          workOrderId: workOrder.id,
          clientGeneratedId: body.clientGeneratedId.trim(),
          deletedAt: null
        }
      });
      if (existing) {
        return {
          ok: true,
          status: "ready",
          mode: readiness.mode,
          attachmentId: existing.id,
          uploadMethod: "mock",
          message: "Evidence with this client ID was already synced."
        };
      }
    }

    const tenantId = workOrder.tenantId ?? actor.tenantId ?? null;
    const storageKey = buildEvidenceStorageKey({
      tenantId,
      workOrderId: workOrder.id,
      fileName: validation.sanitizedFileName
    });

    const attachment = await this.prisma.evidenceAttachment.create({
      data: {
        tenantId,
        workOrderId: workOrder.id,
        facilityIssueId: workOrder.facilityIssue?.id ?? null,
        evidenceType: body.evidenceType ?? EvidenceType.OTHER_DOCUMENT,
        fileName: validation.sanitizedFileName,
        mimeType: body.mimeType.trim().toLowerCase(),
        sizeBytes: Math.floor(body.sizeBytes),
        storageProvider: readiness.mode,
        storageKey,
        status: EvidenceAttachmentStatus.PENDING,
        note: body.note?.trim() || null,
        capturedAt: body.capturedAt ? new Date(body.capturedAt) : null,
        source: body.source ?? EvidenceSource.WEB,
        clientGeneratedId: body.clientGeneratedId?.trim() || null,
        uploadedById: actor.sub
      }
    });

    const providerResult = this.evidenceStorageProvider.createUploadRequest({
      attachmentId: attachment.id,
      storageKey,
      fileName: validation.sanitizedFileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes
    });

    if (!providerResult.ok) {
      await this.prisma.evidenceAttachment.update({
        where: { id: attachment.id },
        data: { status: EvidenceAttachmentStatus.FAILED, syncError: providerResult.message }
      });

      return {
        ok: false,
        status: "blocked",
        mode: readiness.mode,
        message: providerResult.message
      };
    }

    return {
      ok: true,
      status: "ready",
      mode: readiness.mode,
      attachmentId: attachment.id,
      uploadMethod: providerResult.uploadMethod,
      uploadUrl: providerResult.uploadUrl,
      expiresAt: providerResult.expiresAt,
      message: providerResult.message
    };
  }

  async confirmWorkOrderUpload(
    workOrderId: string,
    body: { attachmentId: string },
    actor: Actor
  ): Promise<EvidenceConfirmUploadResult> {
    const readiness = this.evidenceStorageProvider.checkReadiness();
    if (readiness.state !== "configured") {
      return { ok: false, status: "blocked", message: readiness.message };
    }

    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor);
    const tenantId = this.resolveTenantId(actor);

    const attachment = await this.prisma.evidenceAttachment.findFirst({
      where: {
        id: body.attachmentId,
        workOrderId: workOrder.id,
        deletedAt: null,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      select: EVIDENCE_SELECT
    });

    if (!attachment) {
      throw new NotFoundException("Evidence attachment not found");
    }

    if (attachment.status === EvidenceAttachmentStatus.UPLOADED) {
      return {
        ok: true,
        status: "completed",
        attachment: this.toPublicAttachment(attachment),
        message: "Evidence attachment is already confirmed."
      };
    }

    if (attachment.status !== EvidenceAttachmentStatus.PENDING) {
      return {
        ok: false,
        status: "failed",
        message: "Evidence attachment cannot be confirmed in its current state."
      };
    }

    const updated = await this.prisma.evidenceAttachment.update({
      where: { id: attachment.id },
      data: {
        status: EvidenceAttachmentStatus.UPLOADED,
        syncStatus: attachment.source === EvidenceSource.OFFLINE_SYNC ? EvidenceSyncStatus.SYNCED : undefined,
        syncedAt: attachment.source === EvidenceSource.OFFLINE_SYNC ? new Date() : undefined
      },
      select: EVIDENCE_SELECT
    });

    await this.recordEvidenceAudit({
      event: attachment.source === EvidenceSource.OFFLINE_SYNC ? "offline_evidence_synced" : "evidence_uploaded",
      actor,
      workOrderId: workOrder.id,
      evidenceId: updated.id,
      evidenceType: updated.evidenceType,
      source: updated.source
    });

    return {
      ok: true,
      status: "completed",
      attachment: this.toPublicAttachment(updated),
      message: "Evidence attachment confirmed without storing file bytes in MongoDB."
    };
  }

  async patchWorkOrderEvidence(
    workOrderId: string,
    evidenceId: string,
    body: { note?: string; evidenceType?: EvidenceType },
    actor: Actor
  ) {
    this.assertCanUpload(actor);
    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, { status: true });
    await assertTechnicianAssignedToWorkOrder({ actor, workOrderId, prisma: this.prisma });

    const attachment = await this.findEvidenceOrThrow(workOrderId, evidenceId, actor);
    if (attachment.uploadedById !== actor.sub && isTechnicianFieldRole(actor.role)) {
      throw new ForbiddenException("You can only edit evidence you uploaded.");
    }

    const updated = await this.prisma.evidenceAttachment.update({
      where: { id: evidenceId },
      data: {
        note: body.note !== undefined ? body.note.trim() || null : undefined,
        evidenceType: body.evidenceType
      },
      select: EVIDENCE_SELECT
    });

    return this.toPublicAttachment(updated);
  }

  async deleteWorkOrderEvidence(workOrderId: string, evidenceId: string, reason: string, actor: Actor) {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new BadRequestException("Delete reason is required.");
    }

    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, { status: true });
    const attachment = await this.findEvidenceOrThrow(workOrderId, evidenceId, actor);

    if (evidenceDeleteBlockedAfterCompletion(workOrder.status)) {
      const isAdmin = actor.role === RoleName.SUPER_ADMIN || actor.role === RoleName.ADMIN;
      if (!isAdmin) {
        throw new BadRequestException("Evidence cannot be deleted after technician completion.");
      }
    }

    if (isTechnicianFieldRole(actor.role) && attachment.uploadedById !== actor.sub) {
      throw new ForbiddenException("You can only delete evidence you uploaded.");
    }

    const updated = await this.prisma.evidenceAttachment.update({
      where: { id: evidenceId },
      data: {
        status: EvidenceAttachmentStatus.DELETED,
        deletedAt: new Date(),
        deletedById: actor.sub,
        deleteReason: trimmedReason
      },
      select: EVIDENCE_SELECT
    });

    await this.recordEvidenceAudit({
      event: "evidence_deleted",
      actor,
      workOrderId,
      evidenceId,
      evidenceType: attachment.evidenceType,
      reason: trimmedReason,
      beforeData: { status: attachment.status },
      afterData: { status: EvidenceAttachmentStatus.DELETED }
    });

    return this.toPublicAttachment(updated);
  }

  async acceptWorkOrderEvidence(workOrderId: string, evidenceId: string, actor: Actor, note?: string) {
    if (!canReviewEvidence(actor.role)) {
      throw new ForbiddenException("Supervisor permission required to accept evidence.");
    }

    const attachment = await this.findEvidenceOrThrow(workOrderId, evidenceId, actor);
    if (attachment.uploadedById === actor.sub && isTechnicianFieldRole(actor.role)) {
      throw new ForbiddenException("You cannot accept your own evidence.");
    }

    const updated = await this.prisma.evidenceAttachment.update({
      where: { id: evidenceId },
      data: {
        verificationStatus: EvidenceVerificationStatus.ACCEPTED,
        rejectedReason: null,
        note: note?.trim() ? note.trim() : attachment.note
      },
      select: EVIDENCE_SELECT
    });

    await this.recordEvidenceAudit({
      event: "evidence_accepted",
      actor,
      workOrderId,
      evidenceId,
      evidenceType: attachment.evidenceType,
      note
    });

    return this.toPublicAttachment(updated);
  }

  async rejectWorkOrderEvidence(workOrderId: string, evidenceId: string, reason: string, actor: Actor) {
    if (!canReviewEvidence(actor.role)) {
      throw new ForbiddenException("Supervisor permission required to reject evidence.");
    }

    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new BadRequestException("Rejection reason is required.");
    }

    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, { status: true, woNumber: true });
    const attachment = await this.findEvidenceOrThrow(workOrderId, evidenceId, actor);

    const updated = await this.prisma.evidenceAttachment.update({
      where: { id: evidenceId },
      data: {
        verificationStatus: EvidenceVerificationStatus.REJECTED,
        rejectedReason: trimmedReason
      },
      select: EVIDENCE_SELECT
    });

    if (workOrder.status === WorkOrderStatus.TECHNICIAN_COMPLETED) {
      await this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: WorkOrderStatus.REWORK_REQUIRED,
          verificationStatus: WorkOrderVerificationStatus.REJECTED
        }
      });
    }

    await this.recordEvidenceAudit({
      event: "evidence_rejected",
      actor,
      workOrderId,
      evidenceId,
      evidenceType: attachment.evidenceType,
      reason: trimmedReason
    });

    return this.toPublicAttachment(updated);
  }

  async verifyWorkOrderQr(
    workOrderId: string,
    body: { scannedAssetId?: string; scannedVehicleId?: string; overrideReason?: string },
    actor: Actor
  ) {
    this.assertCanUpload(actor);
    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, {
      id: true,
      assetId: true,
      vehicleId: true,
      type: true,
      qrVerificationStatus: true
    });
    await assertTechnicianAssignedToWorkOrder({ actor, workOrderId, prisma: this.prisma });

    if (!workOrder.assetId && !workOrder.vehicleId) {
      throw new BadRequestException("This work order has no asset or vehicle to verify.");
    }

    const scannedAssetId = body.scannedAssetId?.trim() || null;
    const scannedVehicleId = body.scannedVehicleId?.trim() || null;

    if (!scannedAssetId && !scannedVehicleId) {
      throw new BadRequestException("Scanned asset or vehicle ID is required.");
    }

    let qrStatus: QrVerificationStatus = QrVerificationStatus.VERIFIED;
    let auditEvent = "qr_verified";

    const assetMatch = workOrder.assetId && scannedAssetId === workOrder.assetId;
    const vehicleMatch = workOrder.vehicleId && scannedVehicleId === workOrder.vehicleId;

    if (!assetMatch && !vehicleMatch) {
      if (body.overrideReason?.trim() && canOverrideQrMismatch(actor.role)) {
        qrStatus = QrVerificationStatus.OVERRIDDEN;
        auditEvent = "qr_override";
      } else {
        qrStatus = QrVerificationStatus.MISMATCH;
        auditEvent = "qr_mismatch";

        await this.recordEvidenceAudit({
          event: auditEvent,
          actor,
          workOrderId,
          reason: "Scanned asset does not match this work order.",
          metadata: { scannedAssetId, scannedVehicleId, expectedAssetId: workOrder.assetId, expectedVehicleId: workOrder.vehicleId }
        });

        throw new BadRequestException("Scanned asset does not match this work order.");
      }
    }

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        qrVerificationStatus: qrStatus,
        qrVerifiedAt: new Date(),
        qrVerifiedById: actor.sub,
        qrVerifiedAssetId: scannedAssetId,
        qrVerifiedVehicleId: scannedVehicleId,
        qrOverrideReason: qrStatus === QrVerificationStatus.OVERRIDDEN ? body.overrideReason?.trim() || null : null
      },
      select: {
        id: true,
        qrVerificationStatus: true,
        qrVerifiedAt: true,
        qrVerifiedAssetId: true,
        qrVerifiedVehicleId: true,
        qrOverrideReason: true
      }
    });

    await this.recordEvidenceAudit({
      event: auditEvent,
      actor,
      workOrderId,
      reason: body.overrideReason,
      metadata: {
        scannedAssetId,
        scannedVehicleId,
        qrVerificationStatus: updated.qrVerificationStatus
      }
    });

    return {
      ...updated,
      qrVerifiedAt: updated.qrVerifiedAt?.toISOString() ?? null,
      message: qrStatus === QrVerificationStatus.OVERRIDDEN ? "QR verification overridden." : "QR verification completed."
    };
  }

  private assertCanUpload(actor: Actor) {
    if (!canUploadEvidence(actor.role)) {
      throw new ForbiddenException("You do not have permission to upload evidence.");
    }
  }

  private async findEvidenceOrThrow(workOrderId: string, evidenceId: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const attachment = await this.prisma.evidenceAttachment.findFirst({
      where: {
        id: evidenceId,
        workOrderId,
        deletedAt: null,
        status: { not: EvidenceAttachmentStatus.DELETED },
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      select: EVIDENCE_SELECT
    });

    if (!attachment) {
      throw new NotFoundException("Evidence attachment not found");
    }

    return attachment;
  }

  private toPublicAttachment(
    input: Prisma.EvidenceAttachmentGetPayload<{ select: typeof EVIDENCE_SELECT }>
  ): EvidenceAttachmentPublic {
    return mapEvidenceAttachmentPublic({
      ...input,
      downloadAvailable: input.status === EvidenceAttachmentStatus.UPLOADED
    });
  }

  private async recordEvidenceAudit(payload: {
    event: string;
    actor?: Actor;
    workOrderId: string;
    evidenceId?: string;
    evidenceType?: EvidenceType;
    source?: EvidenceSource;
    reason?: string;
    note?: string | null;
    metadata?: Prisma.InputJsonValue;
    beforeData?: Prisma.InputJsonValue;
    afterData?: Prisma.InputJsonValue;
  }) {
    const ctx = requestContext.get();
    const actorId = payload.actor?.sub ?? ctx?.actorId ?? null;

    await this.prisma.auditLog.create({
      data: {
        tenantId: payload.actor?.tenantId ?? ctx?.tenantId ?? null,
        actorId,
        module: "maintenance",
        entity: "WorkOrderEvidence",
        entityId: payload.evidenceId ?? payload.workOrderId,
        action: AuditAction.UPDATE,
        reason: payload.reason ?? payload.note ?? undefined,
        ipAddress: ctx?.ipAddress ?? undefined,
        userAgent: ctx?.userAgent ?? undefined,
        requestPath: ctx?.requestPath ?? undefined,
        actorSnapshot: payload.actor
          ? ({
              id: payload.actor.sub,
              email: payload.actor.email,
              role: payload.actor.role
            } as Prisma.InputJsonValue)
          : undefined,
        metadata: {
          event: payload.event,
          workOrderId: payload.workOrderId,
          evidenceId: payload.evidenceId ?? null,
          evidenceType: payload.evidenceType ?? null,
          source: payload.source ?? null,
          ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {})
        } as Prisma.InputJsonValue,
        beforeData: payload.beforeData,
        afterData: payload.afterData
      }
    });
  }

  private async findTenantScopedWorkOrder<T extends Prisma.WorkOrderSelect>(
    workOrderId: string,
    actor?: Actor,
    select?: T
  ) {
    const tenantId = this.resolveTenantId(actor);
    const where: { id: string; tenantId?: string | null } = { id: workOrderId };

    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where,
      select: (select ?? {
        id: true,
        tenantId: true,
        facilityIssue: { select: { id: true, tenantId: true } }
      }) as T
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }

    return workOrder;
  }

  private resolveTenantId(actor?: Actor): string | null | undefined {
    if (!actor) {
      return undefined;
    }

    return actor.tenantId ?? null;
  }
}
