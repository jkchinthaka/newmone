import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EvidenceAttachmentStatus, EvidenceSource, EvidenceType } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import {
  buildEvidenceStorageKey,
  evidenceBytesMatchMime,
  validateEvidenceUploadInput
} from "../evidence/evidence-storage.mapper";
import { EvidenceStorageProviderService } from "../evidence/evidence-storage-provider.service";
import { MaintenanceRequestsService } from "./maintenance-requests.service";

type Actor = { sub: string; email?: string; role: string; tenantId?: string | null; permissions?: string[] };

export const MAX_REQUEST_PHOTOS = 5;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FROZEN_STATUSES = new Set(["CANCELLED", "CLOSED"]);
/** Roles that may add or remove photos on someone else's request (the reviewers). */
const REVIEWER_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR"
]);

/**
 * Optional photos on a maintenance request: the person who reported the problem (or a reviewer)
 * can attach up to five pictures. One call stores the bytes and records them, so there is no
 * half-finished upload to clean up. Photos follow the request onto the job when it is converted.
 */
@Injectable()
export class RequestPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: EvidenceStorageProviderService,
    private readonly requests: MaintenanceRequestsService
  ) {}

  getLimits() {
    const readiness = this.storage.checkReadiness();
    return {
      enabled: readiness.state === "configured" && readiness.mode === "local",
      maxFileSizeMb: readiness.maxFileSizeMb,
      maxPhotos: MAX_REQUEST_PHOTOS
    };
  }

  /** Visible requests only (findOne enforces scope); only the reporter or a reviewer may change photos. */
  private async loadForChange(tenantId: string | null, requestId: string, actor: Actor) {
    const request = (await this.requests.findOne(tenantId, requestId, actor as never)) as {
      id: string;
      status: string;
      reportedById?: string | null;
    };
    if (request.reportedById !== actor.sub && !REVIEWER_ROLES.has(actor.role)) {
      throw new ForbiddenException("Only the person who reported this problem can add photos.");
    }
    if (FROZEN_STATUSES.has(request.status)) {
      throw new BadRequestException("Photos cannot be changed on a closed or cancelled request.");
    }
    return request;
  }

  async add(
    tenantId: string | null,
    requestId: string,
    input: { fileName: string; mimeType: string; bytes: Buffer },
    actor: Actor
  ) {
    const tid = requireTenantId(tenantId);
    await this.loadForChange(tenantId, requestId, actor);
    const readiness = this.storage.checkReadiness();
    if (readiness.state !== "configured" || readiness.mode !== "local") {
      throw new BadRequestException("Photo storage is not set up on this server.");
    }
    const mimeType = String(input.mimeType ?? "").trim().toLowerCase();
    if (!IMAGE_MIME_TYPES.has(mimeType)) throw new BadRequestException("Only JPEG, PNG or WebP pictures can be added.");
    if (!input.bytes.length) throw new BadRequestException("The picture is empty.");
    const validation = validateEvidenceUploadInput({
      fileName: input.fileName,
      mimeType,
      sizeBytes: input.bytes.length,
      maxFileSizeMb: readiness.maxFileSizeMb,
      allowedMimeTypes: readiness.allowedMimeTypes
    });
    if (!validation.ok) throw new BadRequestException(validation.message);
    if (!evidenceBytesMatchMime(input.bytes, mimeType)) {
      throw new BadRequestException("File contents do not match the declared type.");
    }

    const existing = await this.prisma.evidenceAttachment.count({
      where: { maintenanceRequestId: requestId, tenantId: tid, deletedAt: null, status: EvidenceAttachmentStatus.UPLOADED }
    });
    if (existing >= MAX_REQUEST_PHOTOS) {
      throw new BadRequestException(`A request can have up to ${MAX_REQUEST_PHOTOS} photos.`);
    }

    const storageKey = buildEvidenceStorageKey({
      tenantId: tid,
      workOrderId: requestId,
      fileName: validation.sanitizedFileName,
      mimeType
    });
    await this.storage.putObject(storageKey, input.bytes);
    try {
      const stored = await this.storage.readObject(storageKey);
      if (!stored.equals(input.bytes)) throw new Error("stored bytes diverged");
    } catch {
      await this.storage.deleteObject(storageKey).catch(() => undefined);
      throw new BadRequestException("The picture could not be stored. Try again.");
    }

    const created = await this.prisma.evidenceAttachment.create({
      data: {
        tenantId: tid,
        maintenanceRequestId: requestId,
        evidenceType: EvidenceType.DAMAGE_PHOTO,
        fileName: validation.sanitizedFileName,
        mimeType,
        sizeBytes: input.bytes.length,
        storageProvider: readiness.mode,
        storageKey,
        status: EvidenceAttachmentStatus.UPLOADED,
        source: EvidenceSource.WEB,
        uploadedById: actor.sub
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true }
    });
    return created;
  }

  async read(tenantId: string | null, requestId: string, photoId: string, actor: Actor) {
    const tid = requireTenantId(tenantId);
    await this.requests.findOne(tenantId, requestId, actor as never);
    const photo = await this.prisma.evidenceAttachment.findFirst({
      where: {
        id: photoId,
        maintenanceRequestId: requestId,
        tenantId: tid,
        deletedAt: null,
        status: EvidenceAttachmentStatus.UPLOADED
      }
    });
    if (!photo || photo.storageProvider !== "local") throw new NotFoundException("Photo not found.");
    let bytes: Buffer;
    try {
      bytes = await this.storage.readObject(photo.storageKey);
    } catch {
      throw new NotFoundException("Photo not found.");
    }
    if (bytes.length !== photo.sizeBytes || !evidenceBytesMatchMime(bytes, photo.mimeType)) {
      throw new NotFoundException("Photo not found.");
    }
    return { bytes, mimeType: photo.mimeType, fileName: photo.fileName };
  }

  async remove(tenantId: string | null, requestId: string, photoId: string, actor: Actor) {
    const tid = requireTenantId(tenantId);
    await this.loadForChange(tenantId, requestId, actor);
    const photo = await this.prisma.evidenceAttachment.findFirst({
      where: { id: photoId, maintenanceRequestId: requestId, tenantId: tid, deletedAt: null }
    });
    if (!photo) throw new NotFoundException("Photo not found.");
    if (photo.uploadedById !== actor.sub && !REVIEWER_ROLES.has(actor.role)) {
      throw new ForbiddenException("You can only remove photos you added.");
    }
    await this.prisma.evidenceAttachment.update({
      where: { id: photo.id },
      data: {
        deletedAt: new Date(),
        deletedById: actor.sub,
        deleteReason: "Removed from the request",
        status: EvidenceAttachmentStatus.DELETED
      }
    });
    await this.storage.deleteObject(photo.storageKey).catch(() => undefined);
    return { id: photo.id };
  }
}
