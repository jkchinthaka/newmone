import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EvidenceAttachmentStatus } from "@prisma/client";

import { EvidenceService } from "../src/modules/evidence/evidence.service";
import { EvidenceStorageProviderService } from "../src/modules/evidence/evidence-storage-provider.service";
import {
  publicEvidenceAttachmentHasSensitiveFields,
  sanitizeEvidenceFileName,
  validateEvidenceUploadInput
} from "../src/modules/evidence/evidence-storage.mapper";

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

describe("work order evidence storage", () => {
  const actor = { sub: "user-1", tenantId: "tenant-a", role: "MANAGER" as const, email: "mgr@test.com" };

  it("rejects invalid MIME types", () => {
    const result = validateEvidenceUploadInput({
      fileName: "photo.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 1024,
      maxFileSizeMb: 10,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    });

    expect(result.ok).toBe(false);
  });

  it("sanitizes dangerous file names", () => {
    expect(sanitizeEvidenceFileName("../../secret.pdf")).toBe("secret.pdf");
  });

  it("blocks upload request when storage uploads are disabled", async () => {
    const provider = new EvidenceStorageProviderService(
      configService({
        STORAGE_MODE: "mock",
        STORAGE_UPLOADS_ENABLED: false
      })
    );
    const prisma = {
      workOrder: { findFirst: jest.fn() },
      evidenceAttachment: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() }
    } as unknown as ConstructorParameters<typeof EvidenceService>[0];
    const service = new EvidenceService(prisma, provider);

    const result = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 1200 },
      actor
    );

    expect(result.ok).toBe(false);
    expect(prisma.workOrder.findFirst).not.toHaveBeenCalled();
  });

  it("blocks cross-tenant work order upload", async () => {
    const provider = new EvidenceStorageProviderService(
      configService({
        NODE_ENV: "development",
        STORAGE_MODE: "mock",
        STORAGE_UPLOADS_ENABLED: true
      })
    );
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      evidenceAttachment: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn()
      }
    } as unknown as ConstructorParameters<typeof EvidenceService>[0];
    const service = new EvidenceService(prisma, provider);

    await expect(
      service.createWorkOrderUploadRequest(
        "wo-other-tenant",
        { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 1200 },
        actor
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates metadata-only mock upload and confirm flow without storageKey in public DTO", async () => {
    const provider = new EvidenceStorageProviderService(
      configService({
        NODE_ENV: "development",
        STORAGE_MODE: "mock",
        STORAGE_UPLOADS_ENABLED: true
      })
    );
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          tenantId: "tenant-a",
          facilityIssue: null
        })
      },
      workOrderAssignee: { findFirst: jest.fn().mockResolvedValue({ id: "assignee-1" }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      evidenceAttachment: {
        create: jest.fn().mockResolvedValue({
          id: "ev-1",
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1200,
          status: EvidenceAttachmentStatus.PENDING,
          createdAt: new Date("2026-06-13T10:00:00.000Z"),
          uploadedBy: { firstName: "Taylor", lastName: "Tech" }
        }),
        update: jest.fn().mockResolvedValue({
          id: "ev-1",
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1200,
          status: EvidenceAttachmentStatus.UPLOADED,
          createdAt: new Date("2026-06-13T10:00:00.000Z"),
          uploadedBy: { firstName: "Taylor", lastName: "Tech" }
        }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([])
      }
    } as unknown as ConstructorParameters<typeof EvidenceService>[0];
    const service = new EvidenceService(prisma, provider);

    const upload = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 1200 },
      actor
    );

    expect(upload.ok).toBe(true);
    expect(upload.attachmentId).toBe("ev-1");
    expect(prisma.evidenceAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storageKey: expect.stringContaining("evidence/tenant-a/wo-1/"),
          status: EvidenceAttachmentStatus.PENDING
        })
      })
    );

    prisma.evidenceAttachment.findFirst = jest.fn().mockResolvedValue({
      id: "ev-1",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1200,
      status: EvidenceAttachmentStatus.PENDING,
      createdAt: new Date("2026-06-13T10:00:00.000Z"),
      uploadedBy: { firstName: "Taylor", lastName: "Tech" }
    });

    const confirm = await service.confirmWorkOrderUpload("wo-1", { attachmentId: "ev-1" }, actor);
    expect(confirm.ok).toBe(true);
    expect(confirm.attachment?.status).toBe("UPLOADED");
    expect(publicEvidenceAttachmentHasSensitiveFields(confirm.attachment)).toBe(false);
  });

  it("rejects oversized files before creating metadata", async () => {
    const provider = new EvidenceStorageProviderService(
      configService({
        NODE_ENV: "development",
        STORAGE_MODE: "mock",
        STORAGE_UPLOADS_ENABLED: true,
        STORAGE_MAX_FILE_SIZE_MB: 1
      })
    );
    const prisma = {
      workOrder: { findFirst: jest.fn() },
      workOrderAssignee: { findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
      evidenceAttachment: { create: jest.fn() }
    } as unknown as ConstructorParameters<typeof EvidenceService>[0];
    const service = new EvidenceService(prisma, provider);

    await expect(
      service.createWorkOrderUploadRequest(
        "wo-1",
        { fileName: "large.pdf", mimeType: "application/pdf", sizeBytes: 2 * 1024 * 1024 },
        actor
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
