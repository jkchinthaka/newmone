import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  EvidenceAttachmentStatus,
  EvidenceType,
  EvidenceVerificationStatus,
  QrVerificationStatus,
  RoleName,
  WorkOrderStatus
} from "@prisma/client";

import { EvidenceService } from "../src/modules/evidence/evidence.service";
import { EvidenceStorageProviderService } from "../src/modules/evidence/evidence-storage-provider.service";

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

describe("work order evidence controls", () => {
  const manager = { sub: "mgr-1", tenantId: "tenant-a", role: RoleName.MANAGER, email: "mgr@test.com" };
  const technician = { sub: "tech-1", tenantId: "tenant-a", role: RoleName.TECHNICIAN, email: "tech@test.com" };

  function buildService(overrides: Partial<Record<string, unknown>> = {}) {
    const provider = new EvidenceStorageProviderService(
      configService({
        NODE_ENV: "development",
        STORAGE_MODE: "mock",
        STORAGE_UPLOADS_ENABLED: true,
        ...overrides
      })
    );
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          tenantId: "tenant-a",
          type: "CORRECTIVE",
          status: WorkOrderStatus.IN_PROGRESS,
          assetId: "asset-1",
          vehicleId: null,
          qrVerificationStatus: QrVerificationStatus.PENDING,
          facilityIssue: null,
          technicianCompletionNote: null
        }),
        update: jest.fn().mockResolvedValue({
          id: "wo-1",
          qrVerificationStatus: QrVerificationStatus.VERIFIED,
          qrVerifiedAt: new Date(),
          qrVerifiedAssetId: "asset-1",
          qrVerifiedVehicleId: null,
          qrOverrideReason: null
        })
      },
      workOrderAssignee: {
        findFirst: jest.fn().mockResolvedValue({ id: "assignee-1" })
      },
      evidenceAttachment: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([])
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    } as unknown as ConstructorParameters<typeof EvidenceService>[0];
    return { service: new EvidenceService(prisma, provider), prisma };
  }

  it("blocks technician upload for unassigned work order", async () => {
    const { service, prisma } = buildService();
    (prisma.workOrderAssignee.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.createWorkOrderUploadRequest(
        "wo-1",
        { fileName: "before.jpg", mimeType: "image/jpeg", sizeBytes: 1200, evidenceType: EvidenceType.BEFORE_PHOTO },
        technician
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("verifies QR match successfully", async () => {
    const { service } = buildService();
    const result = await service.verifyWorkOrderQr("wo-1", { scannedAssetId: "asset-1" }, technician);
    expect(result.qrVerificationStatus).toBe(QrVerificationStatus.VERIFIED);
    expect(result.message).toContain("QR verification completed");
  });

  it("blocks QR mismatch without override", async () => {
    const { service } = buildService();
    await expect(
      service.verifyWorkOrderQr("wo-1", { scannedAssetId: "wrong-asset" }, technician)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("supervisor can accept evidence", async () => {
    const { service, prisma } = buildService();
    (prisma.evidenceAttachment.findFirst as jest.Mock).mockResolvedValue({
      id: "ev-1",
      fileName: "after.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1200,
      status: EvidenceAttachmentStatus.UPLOADED,
      evidenceType: EvidenceType.AFTER_PHOTO,
      verificationStatus: EvidenceVerificationStatus.PENDING,
      rejectedReason: null,
      note: null,
      isRequired: false,
      capturedAt: null,
      source: "WEB",
      clientGeneratedId: null,
      offlineCreatedAt: null,
      syncedAt: null,
      syncStatus: null,
      syncError: null,
      uploadedById: "tech-2",
      createdAt: new Date(),
      uploadedBy: { firstName: "Alex", lastName: "Tech" }
    });
    (prisma.evidenceAttachment.update as jest.Mock).mockResolvedValue({
      id: "ev-1",
      fileName: "after.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1200,
      status: EvidenceAttachmentStatus.UPLOADED,
      evidenceType: EvidenceType.AFTER_PHOTO,
      verificationStatus: EvidenceVerificationStatus.ACCEPTED,
      rejectedReason: null,
      note: null,
      isRequired: false,
      capturedAt: null,
      source: "WEB",
      clientGeneratedId: null,
      offlineCreatedAt: null,
      syncedAt: null,
      syncStatus: null,
      syncError: null,
      uploadedById: "tech-2",
      createdAt: new Date(),
      uploadedBy: { firstName: "Alex", lastName: "Tech" }
    });

    const result = await service.acceptWorkOrderEvidence("wo-1", "ev-1", manager);
    expect(result.verificationStatus).toBe("ACCEPTED");
  });

  it("presence of clientGeneratedId prevents duplicate offline sync", async () => {
    const { service, prisma } = buildService();
    (prisma.evidenceAttachment.findFirst as jest.Mock).mockResolvedValue({
      id: "ev-existing",
      fileName: "before.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1200,
      status: EvidenceAttachmentStatus.UPLOADED,
      evidenceType: EvidenceType.BEFORE_PHOTO,
      verificationStatus: EvidenceVerificationStatus.PENDING,
      rejectedReason: null,
      note: null,
      isRequired: false,
      capturedAt: null,
      source: "OFFLINE_SYNC",
      clientGeneratedId: "client-uuid-1",
      offlineCreatedAt: new Date(),
      syncedAt: new Date(),
      syncStatus: "SYNCED",
      syncError: null,
      uploadedById: technician.sub,
      createdAt: new Date(),
      uploadedBy: { firstName: "Taylor", lastName: "Tech" }
    });

    const result = await service.createWorkOrderUploadRequest(
      "wo-1",
      {
        fileName: "before.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1200,
        evidenceType: EvidenceType.BEFORE_PHOTO,
        clientGeneratedId: "client-uuid-1"
      },
      technician
    );

    expect(result.attachmentId).toBe("ev-existing");
    expect(prisma.evidenceAttachment.create).not.toHaveBeenCalled();
  });

  it("does not fake upload success when storage disabled", async () => {
    const provider = new EvidenceStorageProviderService(
      configService({ STORAGE_MODE: "mock", STORAGE_UPLOADS_ENABLED: false })
    );
    const prisma = {
      workOrder: { findFirst: jest.fn() },
      workOrderAssignee: { findFirst: jest.fn() },
      evidenceAttachment: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn() }
    } as unknown as ConstructorParameters<typeof EvidenceService>[0];
    const service = new EvidenceService(prisma, provider);

    const result = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 1200 },
      manager
    );

    expect(result.ok).toBe(false);
    expect(prisma.workOrder.findFirst).not.toHaveBeenCalled();
  });
});
