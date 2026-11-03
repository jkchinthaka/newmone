import { createHash } from "node:crypto";
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
import { assertWorkOrderAcceptsFieldMutation } from "../../common/utils/work-order-terminal-lock";
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
import { scannedValueMatchesAsset, scannedValueMatchesVehicle } from "./scanned-identifier";
import type { JwtPayload } from "../auth/auth.types";
import {
  buildEvidenceStorageKey,
  EvidenceAttachmentPublic,
  EvidenceConfirmUploadResult,
  EvidenceUploadRequestResult,
  evidenceBytesMatchMime,
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
  /** Optional phone location at capture time (only sent when the user allowed it). */
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
};

/** Accepts a location only when it is a real coordinate; anything else is dropped, not rejected. */
export function captureLocation(body: Pick<UploadRequestBody, "latitude" | "longitude" | "accuracyMeters">) {
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    return { captureLatitude: null, captureLongitude: null, captureAccuracyMeters: null };
  }
  const accuracy = Number(body.accuracyMeters);
  return {
    captureLatitude: lat,
    captureLongitude: lng,
    captureAccuracyMeters: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null
  };
}

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
  storageProvider: true,
  storageKey: true,
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
    assertWorkOrderAcceptsFieldMutation(workOrder.status, "upload evidence");
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
    assertWorkOrderAcceptsFieldMutation(workOrder.status, "upload evidence");
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
          uploadMethod: readiness.mode === "local" ? "direct" : "mock",
          message: "Evidence with this client ID was already synced."
        };
      }
    }

    const tenantId = workOrder.tenantId ?? actor.tenantId ?? null;
    const storageKey = buildEvidenceStorageKey({
      tenantId,
      workOrderId: workOrder.id,
      fileName: validation.sanitizedFileName,
      mimeType: body.mimeType
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
        ...captureLocation(body),
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

    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, {
      id: true,
      tenantId: true,
      status: true,
      facilityIssue: { select: { id: true, tenantId: true } }
    });
    assertWorkOrderAcceptsFieldMutation(workOrder.status, "upload evidence");
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

    if (readiness.mode !== "local") {
      return {
        ok: false,
        status: "failed",
        message: "Upload confirmation without stored file bytes is rejected."
      };
    }

    let stored: Buffer;
    try {
      stored = await this.evidenceStorageProvider.readObject(attachment.storageKey);
    } catch {
      await this.prisma.evidenceAttachment.update({
        where: { id: attachment.id },
        data: { status: EvidenceAttachmentStatus.FAILED, syncError: "Stored evidence file was not found." }
      });
      return { ok: false, status: "failed", message: "Stored evidence file was not found." };
    }

    if (stored.length !== attachment.sizeBytes || !evidenceBytesMatchMime(stored, attachment.mimeType)) {
      await this.evidenceStorageProvider.deleteObject(attachment.storageKey).catch(() => undefined);
      await this.prisma.evidenceAttachment.update({
        where: { id: attachment.id },
        data: { status: EvidenceAttachmentStatus.FAILED, syncError: "Stored evidence failed integrity checks." }
      });
      return { ok: false, status: "failed", message: "Stored evidence failed integrity checks." };
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
      message: "Evidence file stored and verified."
    };
  }

  async storeWorkOrderEvidenceBytes(workOrderId: string, evidenceId: string, bytes: Buffer, actor: Actor) {
    this.assertCanUpload(actor);
    const readiness = this.evidenceStorageProvider.checkReadiness();
    if (readiness.mode !== "local" || readiness.state !== "configured") {
      throw new BadRequestException("File upload storage is not configured.");
    }
    if (!bytes.length) {
      throw new BadRequestException("Evidence file bytes are required.");
    }

    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, {
      id: true,
      tenantId: true,
      status: true,
      facilityIssue: { select: { id: true } }
    });
    assertWorkOrderAcceptsFieldMutation(workOrder.status, "upload evidence");
    await assertTechnicianAssignedToWorkOrder({ actor, workOrderId: workOrder.id, prisma: this.prisma });
    const attachment = await this.findEvidenceOrThrow(workOrderId, evidenceId, actor);
    if (attachment.status !== EvidenceAttachmentStatus.PENDING) {
      throw new BadRequestException("Evidence attachment cannot accept file bytes in its current state.");
    }
    if (bytes.length > readiness.maxFileSizeMb * 1024 * 1024 || !readiness.allowedMimeTypes.includes(attachment.mimeType)) {
      throw new BadRequestException("Evidence exceeds the configured size or MIME policy.");
    }
    if (bytes.length !== attachment.sizeBytes) {
      throw new BadRequestException("Uploaded file size does not match the declared size.");
    }
    if (!evidenceBytesMatchMime(bytes, attachment.mimeType)) {
      throw new BadRequestException("File contents do not match the declared type.");
    }

    // The same photo file cannot prove two jobs (or the same job twice).
    const contentSha256 = createHash("sha256").update(bytes).digest("hex");
    const reused = await this.prisma.evidenceAttachment.findFirst({
      where: {
        tenantId: workOrder.tenantId ?? actor.tenantId ?? null,
        contentSha256,
        deletedAt: null,
        id: { not: attachment.id },
        status: { not: EvidenceAttachmentStatus.FAILED }
      },
      select: { id: true, workOrder: { select: { woNumber: true } } }
    });
    if (reused) {
      await this.prisma.evidenceAttachment.update({
        where: { id: attachment.id },
        data: { status: EvidenceAttachmentStatus.FAILED, syncError: "Duplicate photo" }
      });
      await this.recordEvidenceAudit({
        event: "duplicate_evidence_rejected",
        actor,
        workOrderId: workOrder.id,
        evidenceId: attachment.id,
        evidenceType: attachment.evidenceType,
        source: attachment.source
      });
      throw new BadRequestException({
        message: reused.workOrder?.woNumber
          ? `This photo was already used on job ${reused.workOrder.woNumber}. Take a new photo with the camera.`
          : "This photo was already used. Take a new photo with the camera.",
        code: "DUPLICATE_EVIDENCE"
      });
    }

    try {
      await this.evidenceStorageProvider.putObject(attachment.storageKey, bytes);
      const stored = await this.evidenceStorageProvider.readObject(attachment.storageKey);
      if (!stored.equals(bytes)) {
        throw new Error("stored bytes diverged");
      }
      await this.prisma.evidenceAttachment.update({ where: { id: attachment.id }, data: { contentSha256 } });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      await this.evidenceStorageProvider.deleteObject(attachment.storageKey).catch(() => undefined);
      await this.prisma.evidenceAttachment.update({
        where: { id: attachment.id },
        data: { status: EvidenceAttachmentStatus.FAILED, syncError: "Evidence file could not be stored." }
      });
      throw new BadRequestException("Evidence file could not be stored.");
    }

    return { ok: true, attachmentId: attachment.id, status: attachment.status, message: "Evidence bytes stored. Confirm to finish." };
  }

  async readWorkOrderEvidenceBytes(workOrderId: string, evidenceId: string, actor: Actor) {
    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor);
    await assertTechnicianAssignedToWorkOrder({ actor, workOrderId: workOrder.id, prisma: this.prisma });
    const attachment = await this.findEvidenceOrThrow(workOrderId, evidenceId, actor);
    if (attachment.status !== EvidenceAttachmentStatus.UPLOADED || attachment.storageProvider !== "local") {
      throw new NotFoundException("Evidence file is not available.");
    }
    let bytes: Buffer;
    try {
      bytes = await this.evidenceStorageProvider.readObject(attachment.storageKey);
    } catch {
      throw new NotFoundException("Evidence file is not available.");
    }
    if (bytes.length !== attachment.sizeBytes || !evidenceBytesMatchMime(bytes, attachment.mimeType)) {
      throw new NotFoundException("Evidence file is not available.");
    }
    return { bytes, mimeType: attachment.mimeType, fileName: attachment.fileName };
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

  private scannedValueMatchesAsset(tenantId: string | null | undefined, assetId: string | null, scanned: string | null) {
    return scannedValueMatchesAsset(this.prisma as never, tenantId, assetId, scanned);
  }

  private scannedValueMatchesVehicle(tenantId: string | null | undefined, vehicleId: string | null, scanned: string | null) {
    return scannedValueMatchesVehicle(this.prisma as never, tenantId, vehicleId, scanned);
  }

  async verifyWorkOrderQr(
    workOrderId: string,
    body: { scannedAssetId?: string; scannedVehicleId?: string; overrideReason?: string },
    actor: Actor
  ) {
    this.assertCanUpload(actor);
    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor, {
      id: true,
      tenantId: true,
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

    const assetMatch = await this.scannedValueMatchesAsset(workOrder.tenantId, workOrder.assetId, scannedAssetId);
    const vehicleMatch = await this.scannedValueMatchesVehicle(workOrder.tenantId, workOrder.vehicleId, scannedVehicleId);

    if (!assetMatch && !vehicleMatch) {
      if (body.overrideReason?.trim() && canOverrideQrMismatch(actor.role)) {
        qrStatus = QrVerificationStatus.OVERRIDDEN;
        auditEvent = "qr_override";
      } else {
        qrStatus = QrVerificationStatus.MISMATCH;
        auditEvent = "qr_mismatch";

        // Persist the failed scan so the job shows MISMATCH instead of looking unscanned.
        await this.prisma.workOrder.update({
          where: { id: workOrderId },
          data: {
            qrVerificationStatus: QrVerificationStatus.MISMATCH,
            qrVerifiedAt: null,
            qrVerifiedById: actor.sub,
            qrVerifiedAssetId: scannedAssetId,
            qrVerifiedVehicleId: scannedVehicleId,
            qrOverrideReason: null
          },
          select: { id: true }
        });

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
    // MP-003: WorkOrder.tenantId is now required, so the where-filter value can no longer be
    // `null` — an actor with no tenant membership (tenantId === null) must still resolve to "no
    // match" rather than an unfiltered/type-invalid query. See tenantFilterValue() pattern used
    // elsewhere for this migration (e.g. driver-intelligence.service.ts).
    const where: Prisma.WorkOrderWhereInput = { id: workOrderId };

    if (tenantId !== undefined) {
      where.tenantId = tenantId ?? "__mp003_no_tenant_match__";
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
