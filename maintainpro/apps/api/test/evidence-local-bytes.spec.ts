import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { EvidenceAttachmentStatus, RoleName } from "@prisma/client";

import { captureLocation, EvidenceService } from "../src/modules/evidence/evidence.service";
import { EvidenceStorageProviderService } from "../src/modules/evidence/evidence-storage-provider.service";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]);
const pdf = Buffer.from("%PDF-1.4\nhello");

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

function memoryPrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  let seq = 0;
  return {
    rows,
    workOrder: {
      findFirst: jest.fn().mockResolvedValue({
        id: "wo-1",
        tenantId: "tenant-a",
        status: "IN_PROGRESS",
        facilityIssue: null
      })
    },
    workOrderAssignee: { findFirst: jest.fn().mockResolvedValue({ id: "assignee-1" }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    evidenceAttachment: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `ev-${++seq}`,
          createdAt: new Date(),
          uploadedBy: null,
          verificationStatus: "PENDING",
          ...data
        };
        rows.set(String(row.id), row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.get(where.id);
        if (!row) throw new Error("missing");
        Object.assign(row, data);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id?: string | { not: string }; clientGeneratedId?: string; tenantId?: string; workOrderId?: string; contentSha256?: string } }) => {
        const matches = [...rows.values()].filter((row) => {
          if (typeof where.id === "object" && row.id === where.id.not) return false;
          if (typeof where.id === "string" && row.id !== where.id) return false;
          if (where.contentSha256 && row.contentSha256 !== where.contentSha256) return false;
          if (where.clientGeneratedId && row.clientGeneratedId !== where.clientGeneratedId) return false;
          if (where.tenantId && row.tenantId !== where.tenantId) return false;
          if (where.workOrderId && row.workOrderId !== where.workOrderId) return false;
          if (where.contentSha256 && row.status === "FAILED") return false;
          return true;
        });
        return matches[0] ?? null;
      }),
      findMany: jest.fn().mockResolvedValue([])
    }
  };
}

describe("local evidence bytes", () => {
  const actor = { sub: "user-1", tenantId: "tenant-a", role: RoleName.MANAGER, email: "mgr@test.com" };

  const temporaryPaths: string[] = [];
  afterAll(async () => { for (const temporaryPath of temporaryPaths) await rm(temporaryPath, { recursive: true, force: true }); });

  async function localService() {
    const root = await mkdtemp(path.join(tmpdir(), "mp-evidence-"));
    temporaryPaths.push(root);
    const provider = new EvidenceStorageProviderService(
      configService({
        NODE_ENV: "production",
        STORAGE_LOCAL_PRODUCTION: true,
        STORAGE_MODE: "local",
        STORAGE_UPLOADS_ENABLED: true,
        STORAGE_LOCAL_ROOT: root
      })
    );
    const prisma = memoryPrisma();
    return { root, provider, service: new EvidenceService(prisma as never, provider), prisma };
  }

  async function upload(service: EvidenceService, fileName: string, mimeType: string, bytes: Buffer) {
    const requested = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName, mimeType, sizeBytes: bytes.length, clientGeneratedId: `${fileName}-1` },
      actor
    );
    expect(requested.ok).toBe(true);
    expect(requested.uploadMethod).toBe("direct");
    await service.storeWorkOrderEvidenceBytes("wo-1", requested.attachmentId!, bytes, actor);
    const confirmed = await service.confirmWorkOrderUpload("wo-1", { attachmentId: requested.attachmentId! }, actor);
    return { requested, confirmed };
  }

  it("stores a JPEG, reads the same bytes, and survives a new provider instance", async () => {
    const { root, service, prisma } = await localService();
    const { confirmed } = await upload(service, "photo.jpg", "image/jpeg", jpeg);
    expect(confirmed.ok).toBe(true);
    expect(confirmed.attachment?.status).toBe(EvidenceAttachmentStatus.UPLOADED);
    const downloaded = await service.readWorkOrderEvidenceBytes("wo-1", confirmed.attachment!.id, actor);
    expect(Buffer.compare(downloaded.bytes, jpeg)).toBe(0);

    const restarted = new EvidenceStorageProviderService(
      configService({
        NODE_ENV: "development",
        STORAGE_MODE: "local",
        STORAGE_UPLOADS_ENABLED: true,
        STORAGE_LOCAL_ROOT: root
      })
    );
    const storedKey = [...prisma.rows.values()][0] as { storageKey: string };
    const again = await restarted.readObject(storedKey.storageKey);
    expect(Buffer.compare(again, jpeg)).toBe(0);
  });

  it("detects same-size, same-MIME corruption at confirmation and download using SHA-256", async () => {
    const { root, service, prisma } = await localService();
    const { requested } = await upload(service, "photo.jpg", "image/jpeg", jpeg);
    const row = prisma.rows.get(requested.attachmentId!)!;
    const changed = Buffer.from(jpeg);
    changed[changed.length - 1] ^= 1;
    await writeFile(path.join(root, String(row.storageKey)), changed);
    await expect(service.readWorkOrderEvidenceBytes("wo-1", requested.attachmentId!, actor)).rejects.toMatchObject({ status: 404 });
    row.status = EvidenceAttachmentStatus.PENDING;
    const confirmation = await service.confirmWorkOrderUpload("wo-1", { attachmentId: requested.attachmentId! }, actor);
    expect(confirmation.ok).toBe(false);
    expect(row.status).toBe(EvidenceAttachmentStatus.FAILED);
  });

  it("stores a PDF and rejects a MIME mismatch, an oversized file, and confirmation without bytes", async () => {
    const { service } = await localService();
    const pdfUpload = await upload(service, "invoice.pdf", "application/pdf", pdf);
    expect(pdfUpload.confirmed.attachment?.mimeType).toBe("application/pdf");

    const mismatch = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName: "fake.jpg", mimeType: "image/jpeg", sizeBytes: pdf.length },
      actor
    );
    await expect(service.storeWorkOrderEvidenceBytes("wo-1", mismatch.attachmentId!, pdf, actor)).rejects.toBeInstanceOf(
      BadRequestException
    );

    await expect(
      service.createWorkOrderUploadRequest(
        "wo-1",
        { fileName: "big.pdf", mimeType: "application/pdf", sizeBytes: 11 * 1024 * 1024 },
        actor
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    const pending = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName: "missing.pdf", mimeType: "application/pdf", sizeBytes: pdf.length },
      actor
    );
    const confirm = await service.confirmWorkOrderUpload("wo-1", { attachmentId: pending.attachmentId! }, actor);
    expect(confirm.ok).toBe(false);
    expect(confirm.attachment?.status).not.toBe(EvidenceAttachmentStatus.UPLOADED);
  });

  it("denies viewers, other tenants, and unassigned technicians", async () => {
    const { service, prisma } = await localService();
    await expect(
      service.createWorkOrderUploadRequest("wo-1", { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: jpeg.length }, {
        ...actor,
        role: RoleName.VIEWER
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.workOrder.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.createWorkOrderUploadRequest("wo-other", { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: jpeg.length }, actor)
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.workOrderAssignee.findFirst.mockResolvedValue(null);
    await expect(
      service.createWorkOrderUploadRequest("wo-1", { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: jpeg.length }, {
        ...actor,
        role: RoleName.TECHNICIAN
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns 404 for cross-tenant downloads and 400 for closed/cancelled uploads", async () => {
    const { service, prisma } = await localService();
    const { requested } = await upload(service, "photo.jpg", "image/jpeg", jpeg);
    prisma.workOrder.findFirst.mockResolvedValueOnce(null);
    await expect(service.readWorkOrderEvidenceBytes("wo-1", requested.attachmentId!, { ...actor, tenantId: "tenant-b" }))
      .rejects.toMatchObject({ status: 404 });
    for (const status of ["CLOSED", "CANCELLED"]) {
      prisma.workOrder.findFirst.mockResolvedValueOnce({ id: "wo-1", tenantId: "tenant-a", status, facilityIssue: null });
      await expect(service.createWorkOrderUploadRequest("wo-1", { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: jpeg.length }, actor))
        .rejects.toMatchObject({ status: 400 });
    }
  });

  it("reuses the same attachment for a repeated client id and does not mark a failed write uploaded", async () => {
    const { service, prisma } = await localService();
    const first = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: jpeg.length, clientGeneratedId: "same-client" },
      actor
    );
    const second = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: jpeg.length, clientGeneratedId: "same-client" },
      actor
    );
    expect(second.attachmentId).toBe(first.attachmentId);
    expect(prisma.evidenceAttachment.create).toHaveBeenCalledTimes(1);

    const blockedRoot = path.join(tmpdir(), `mp-evidence-file-${Date.now()}`);
    temporaryPaths.push(blockedRoot);
    await writeFile(blockedRoot, "not-a-directory");
    const failing = new EvidenceService(
      prisma as never,
      new EvidenceStorageProviderService(
        configService({
          NODE_ENV: "development",
          STORAGE_MODE: "local",
          STORAGE_UPLOADS_ENABLED: true,
          STORAGE_LOCAL_ROOT: blockedRoot
        })
      )
    );
    await expect(failing.storeWorkOrderEvidenceBytes("wo-1", first.attachmentId!, jpeg, actor)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.rows.get(first.attachmentId!)?.status).toBe(EvidenceAttachmentStatus.FAILED);
  });

  it("refuses the same photo bytes a second time and keeps the first upload", async () => {
    const { service, prisma } = await localService();
    const first = await upload(service, "before.jpg", "image/jpeg", jpeg);
    expect(first.confirmed.ok).toBe(true);
    const again = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName: "copy.jpg", mimeType: "image/jpeg", sizeBytes: jpeg.length, clientGeneratedId: "copy-1" },
      actor
    );
    await expect(service.storeWorkOrderEvidenceBytes("wo-1", again.attachmentId!, jpeg, actor)).rejects.toThrow(/already used/);
    expect(prisma.rows.get(again.attachmentId!)?.status).toBe(EvidenceAttachmentStatus.FAILED);
    expect(prisma.rows.get(first.requested.attachmentId!)?.status).toBe(EvidenceAttachmentStatus.UPLOADED);
  });

  it("stores the phone location only when it is a real coordinate", async () => {
    const { service, prisma } = await localService();
    const requested = await service.createWorkOrderUploadRequest(
      "wo-1",
      { fileName: "gps.jpg", mimeType: "image/jpeg", sizeBytes: jpeg.length, latitude: 6.84, longitude: 80.0, accuracyMeters: 12.4 } as never,
      actor
    );
    expect(prisma.rows.get(requested.attachmentId!)).toMatchObject({ captureLatitude: 6.84, captureLongitude: 80, captureAccuracyMeters: 12 });
    expect(captureLocation({ latitude: 200, longitude: 80 })).toEqual({ captureLatitude: null, captureLongitude: null, captureAccuracyMeters: null });
    expect(captureLocation({})).toEqual({ captureLatitude: null, captureLongitude: null, captureAccuracyMeters: null });
  });
});
