import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EvidenceAttachmentStatus } from "@prisma/client";

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

type Actor = Pick<JwtPayload, "sub" | "tenantId">;

type UploadRequestBody = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

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
    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor);
    const tenantId = this.resolveTenantId(actor);

    const attachments = await this.prisma.evidenceAttachment.findMany({
      where: {
        workOrderId: workOrder.id,
        status: { not: EvidenceAttachmentStatus.DELETED },
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        createdAt: true,
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      workOrderId: workOrder.id,
      items: attachments.map((attachment) =>
        mapEvidenceAttachmentPublic({
          ...attachment,
          status: attachment.status,
          downloadAvailable: attachment.status === EvidenceAttachmentStatus.UPLOADED
        })
      ),
      checkedAt: new Date().toISOString()
    };
  }

  async createWorkOrderUploadRequest(
    workOrderId: string,
    body: UploadRequestBody,
    actor: Actor
  ): Promise<EvidenceUploadRequestResult> {
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

    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor);
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
        fileName: validation.sanitizedFileName,
        mimeType: body.mimeType.trim().toLowerCase(),
        sizeBytes: Math.floor(body.sizeBytes),
        storageProvider: readiness.mode,
        storageKey,
        status: EvidenceAttachmentStatus.PENDING,
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
        data: {
          status: EvidenceAttachmentStatus.FAILED
        }
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
      return {
        ok: false,
        status: "blocked",
        message: readiness.message
      };
    }

    const workOrder = await this.findTenantScopedWorkOrder(workOrderId, actor);
    const tenantId = this.resolveTenantId(actor);

    const attachment = await this.prisma.evidenceAttachment.findFirst({
      where: {
        id: body.attachmentId,
        workOrderId: workOrder.id,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      include: {
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
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
        status: EvidenceAttachmentStatus.UPLOADED
      },
      include: {
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return {
      ok: true,
      status: "completed",
      attachment: this.toPublicAttachment(updated),
      message: "Evidence attachment confirmed without storing file bytes in MongoDB."
    };
  }

  private toPublicAttachment(input: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    status: EvidenceAttachmentStatus;
    createdAt: Date;
    uploadedBy?: { firstName: string; lastName: string } | null;
  }): EvidenceAttachmentPublic {
    return mapEvidenceAttachmentPublic({
      ...input,
      status: input.status,
      downloadAvailable: input.status === EvidenceAttachmentStatus.UPLOADED
    });
  }

  private async findTenantScopedWorkOrder(workOrderId: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const where: { id: string; tenantId?: string | null } = { id: workOrderId };

    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where,
      select: {
        id: true,
        tenantId: true,
        facilityIssue: {
          select: {
            id: true,
            tenantId: true
          }
        }
      }
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
