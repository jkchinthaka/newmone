import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { BadRequestException, NotFoundException } from "@nestjs/common";

import { AssetsService } from "../src/modules/assets/assets.service";
import { persistEvidenceFileBytes } from "../src/modules/evidence/evidence-storage.mapper";
import { EvidenceStorageProviderService } from "../src/modules/evidence/evidence-storage-provider.service";
import { PlanningService } from "../src/modules/planning/planning.service";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]);
const actor = { sub: "user-1", tenantId: "tenant-a", role: "MANAGER", email: "manager@example.com", permissions: ["planning.manage"] };

function config(values: Record<string, unknown> = {}) {
  return {
    get: (key: string, fallback?: unknown) => (Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback)
  } as never;
}

function localProvider(root: string, extra: Record<string, unknown> = {}) {
  return new EvidenceStorageProviderService(
    config({
      NODE_ENV: "development",
      STORAGE_MODE: "local",
      STORAGE_UPLOADS_ENABLED: true,
      STORAGE_LOCAL_ROOT: root,
      ...extra
    })
  );
}

function assetFile(bytes: Buffer, name: string, mime: string) {
  return { buffer: bytes, originalname: name, mimetype: mime, size: bytes.length } as Express.Multer.File;
}

function assetHarness() {
  const rows = new Map<string, Record<string, unknown>>();
  rows.set("asset-1", {
    id: "asset-1",
    tenantId: "tenant-a",
    documents: "[]",
    functionalLocationId: null,
    archivedAt: null,
    category: "OTHER",
    location: null
  });
  const prisma = {
    asset: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) => {
        const row = rows.get(where.id);
        if (!row || row.tenantId !== where.tenantId) return null;
        return { ...row };
      }),
      findMany: jest.fn(async () => []),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.get(where.id);
        if (!row) throw new Error("missing asset");
        Object.assign(row, data);
        return { ...row };
      })
    },
    workOrder: { count: jest.fn(async () => 0) },
    maintenanceLog: { aggregate: jest.fn(async () => ({ _sum: { cost: 0 } })) },
    auditLog: { findMany: jest.fn(async () => []), create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : ops))
  };
  return { rows, prisma };
}

function assetsService(prisma: object, provider?: EvidenceStorageProviderService) {
  return new AssetsService(
    prisma as never,
    config() as never,
    {} as never,
    { resolveLocationPath: async () => [] } as never,
    provider
  );
}

function inspectionHarness() {
  const evidence = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const prisma = {
    inspection: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === "insp-1" && where.tenantId === "tenant-a"
          ? { id: "insp-1", status: "IN_PROGRESS", tenantId: "tenant-a" }
          : null
      )
    },
    evidenceAttachment: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `ev-${++seq}`, status: "READY", deletedAt: null, ...data };
        evidence.set(String(row.id), row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId?: string; inspectionId?: string } }) => {
        const row = evidence.get(where.id);
        if (!row) return null;
        if (where.tenantId && row.tenantId !== where.tenantId) return null;
        if (where.inspectionId && row.inspectionId !== where.inspectionId) return null;
        return row;
      })
    }
  };
  return { evidence, prisma };
}

function planningService(prisma: object, provider?: EvidenceStorageProviderService) {
  return new PlanningService(prisma as never, {} as never, undefined, undefined, undefined, provider);
}

describe("asset and inspection private disk storage", () => {
  let root = "";

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "mp-asset-insp-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(path.join(process.cwd(), "var", "evidence"), { recursive: true, force: true });
    await rm(path.join(process.cwd(), "uploads", "asset-documents"), { recursive: true, force: true });
  });

  it("stores an asset document on the private disk and downloads the same bytes", async () => {
    const { prisma } = assetHarness();
    const service = assetsService(prisma, localProvider(root));
    const uploaded = await service.uploadDocument("asset-1", "tenant-a", "user-1", assetFile(jpeg, "plant photo.jpg", "image/jpeg"));
    expect(JSON.stringify(uploaded)).not.toMatch(/storageKey|storageProvider/);
    expect(uploaded[0]?.downloadUrl).toBe(`/assets/asset-1/documents/${uploaded[0]?.id}`);
    const downloaded = await service.downloadDocument("asset-1", "tenant-a", uploaded[0]!.id);
    expect(downloaded.buffer.equals(jpeg)).toBe(true);
    expect(downloaded.filename).toBe("plant-photo.jpg");
  });

  it("rejects a disallowed asset type and an oversized asset file", async () => {
    const { prisma } = assetHarness();
    const service = assetsService(prisma, localProvider(root, { STORAGE_MAX_FILE_SIZE_MB: 0.001 }));
    await expect(
      service.uploadDocument("asset-1", "tenant-a", "user-1", assetFile(Buffer.from("MZ"), "payload.exe", "application/x-msdownload"))
    ).rejects.toBeInstanceOf(BadRequestException);
    const oversized = Buffer.concat([jpeg, Buffer.alloc(2000, 1)]);
    await expect(
      service.uploadDocument("asset-1", "tenant-a", "user-1", assetFile(oversized, "big.jpg", "image/jpeg"))
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns not found when an asset document is requested from another tenant", async () => {
    const { prisma } = assetHarness();
    const service = assetsService(prisma, localProvider(root));
    const uploaded = await service.uploadDocument("asset-1", "tenant-a", "user-1", assetFile(jpeg, "plant.jpg", "image/jpeg"));
    await expect(service.downloadDocument("asset-1", "tenant-b", uploaded[0]!.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("keeps the cwd asset-document fallback when storage is not local", async () => {
    const { prisma } = assetHarness();
    const remote = new EvidenceStorageProviderService(
      config({ NODE_ENV: "development", STORAGE_MODE: "cloudinary", STORAGE_UPLOADS_ENABLED: false })
    );
    const service = assetsService(prisma, remote);
    const uploaded = await service.uploadDocument("asset-1", "tenant-a", "user-1", assetFile(jpeg, "manual.pdf", "application/pdf"));
    expect(uploaded[0]?.storedName).toMatch(/^asset-1-/);
    expect(uploaded[0]?.externalUrl).toBeUndefined();
    const downloaded = await service.downloadDocument("asset-1", "tenant-a", uploaded[0]!.id);
    expect(downloaded.buffer.equals(jpeg)).toBe(true);
  });

  it("stores inspection evidence under a server-generated name and downloads it for the same tenant", async () => {
    const { prisma } = inspectionHarness();
    const service = planningService(prisma, localProvider(root));
    const created = await service.attachInspectionEvidence(actor, "insp-1", {
      checklistItemKey: "../photo",
      fileName: "site photo.jpg",
      mimeType: "image/jpeg",
      contentBase64: jpeg.toString("base64")
    });
    const stored = prisma.evidenceAttachment.create.mock.calls[0][0].data as { storageKey: string };
    expect(stored.storageKey).toMatch(/\/photo\/[0-9a-f-]{36}\.jpg$/);
    expect(stored.storageKey).not.toContain("..");
    expect(stored.storageKey).not.toContain("site photo");
    const downloaded = await service.readInspectionEvidence(actor, "insp-1", created.id);
    expect(downloaded.bytes.equals(jpeg)).toBe(true);
  });

  it("rejects a bad inspection type and an oversized inspection file", async () => {
    const { prisma } = inspectionHarness();
    const service = planningService(prisma, localProvider(root, { STORAGE_MAX_FILE_SIZE_MB: 0.001 }));
    await expect(
      service.attachInspectionEvidence(actor, "insp-1", {
        checklistItemKey: "photo",
        fileName: "payload.exe",
        mimeType: "application/x-msdownload",
        contentBase64: Buffer.from("MZ").toString("base64")
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.attachInspectionEvidence(actor, "insp-1", {
        checklistItemKey: "photo",
        fileName: "big.jpg",
        mimeType: "image/jpeg",
        contentBase64: Buffer.concat([jpeg, Buffer.alloc(2000, 1)]).toString("base64")
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("hides inspection evidence from another tenant", async () => {
    const { prisma } = inspectionHarness();
    const service = planningService(prisma, localProvider(root));
    const created = await service.attachInspectionEvidence(actor, "insp-1", {
      checklistItemKey: "photo",
      fileName: "site.jpg",
      mimeType: "image/jpeg",
      contentBase64: jpeg.toString("base64")
    });
    await expect(
      service.readInspectionEvidence({ ...actor, tenantId: "tenant-b" }, "insp-1", created.id)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("keeps the legacy inspection writer and still reads those bytes when local storage is configured", async () => {
    const legacy = await persistEvidenceFileBytes({
      tenantId: "tenant-a",
      inspectionId: "insp-1",
      checklistItemKey: "photo",
      fileName: "old photo.jpg",
      mimeType: "image/jpeg",
      contentBase64: jpeg.toString("base64")
    });
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;
    expect(legacy.storageKey).toContain("old photo.jpg");

    const { evidence, prisma } = inspectionHarness();
    evidence.set("ev-old", {
      id: "ev-old",
      tenantId: "tenant-a",
      inspectionId: "insp-1",
      storageKey: legacy.storageKey,
      fileName: legacy.fileName,
      mimeType: "image/jpeg",
      status: "READY",
      deletedAt: null
    });
    const plain = planningService(prisma);
    const created = await plain.attachInspectionEvidence(actor, "insp-1", {
      checklistItemKey: "photo",
      fileName: "another.jpg",
      mimeType: "image/jpeg",
      contentBase64: jpeg.toString("base64")
    });
    const stored = prisma.evidenceAttachment.create.mock.calls[0][0].data as { storageKey: string };
    expect(stored.storageKey).toContain("another.jpg");
    const legacyRead = await planningService(prisma, localProvider(root)).readInspectionEvidence(actor, "insp-1", "ev-old");
    expect(legacyRead.bytes.equals(jpeg)).toBe(true);
    const currentRead = await plain.readInspectionEvidence(actor, "insp-1", created.id);
    expect(currentRead.bytes.equals(jpeg)).toBe(true);
  });
});
