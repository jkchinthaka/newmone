import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { MAX_REQUEST_PHOTOS, RequestPhotosService } from "../src/modules/maintenance-requests/request-photos.service";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

function build(overrides: { status?: string; reportedById?: string; count?: number } = {}) {
  const created: unknown[] = [];
  const prisma = {
    evidenceAttachment: {
      count: jest.fn().mockResolvedValue(overrides.count ?? 0),
      create: jest.fn().mockImplementation(async (args: { data: unknown }) => {
        created.push(args.data);
        return { id: "p1", fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: JPEG.length, createdAt: new Date() };
      })
    }
  };
  const store = new Map<string, Buffer>();
  const storage = {
    checkReadiness: () => ({ state: "configured", mode: "local", maxFileSizeMb: 5, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] }),
    putObject: async (key: string, bytes: Buffer) => void store.set(key, bytes),
    readObject: async (key: string) => store.get(key) as Buffer,
    deleteObject: async (key: string) => void store.delete(key)
  };
  const requests = {
    findOne: jest.fn().mockResolvedValue({ id: "r1", status: overrides.status ?? "NEW", reportedById: overrides.reportedById ?? "u1" })
  };
  const service = new RequestPhotosService(prisma as never, storage as never, requests as never);
  return { service, prisma, created, store };
}

const reporter = { sub: "u1", role: "TECHNICIAN", tenantId: "t1" };

describe("request photos", () => {
  it("stores a picture for the reporter and links it to the request", async () => {
    const { service, created, store } = build();
    await service.add("t1", "r1", { fileName: "photo.jpg", mimeType: "image/jpeg", bytes: JPEG }, reporter);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ maintenanceRequestId: "r1", tenantId: "t1", status: "UPLOADED", uploadedById: "u1" });
    expect(store.size).toBe(1);
  });

  it("refuses someone who is not the reporter or a reviewer", async () => {
    const { service } = build({ reportedById: "someone-else" });
    await expect(service.add("t1", "r1", { fileName: "a.jpg", mimeType: "image/jpeg", bytes: JPEG }, reporter)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a reviewer add a picture to another person's request", async () => {
    const { service } = build({ reportedById: "someone-else" });
    await expect(service.add("t1", "r1", { fileName: "a.jpg", mimeType: "image/jpeg", bytes: JPEG }, { ...reporter, sub: "m1", role: "MANAGER" })).resolves.toBeTruthy();
  });

  it("refuses closed requests, non-pictures and a sixth photo", async () => {
    await expect(build({ status: "CLOSED" }).service.add("t1", "r1", { fileName: "a.jpg", mimeType: "image/jpeg", bytes: JPEG }, reporter)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build().service.add("t1", "r1", { fileName: "a.pdf", mimeType: "application/pdf", bytes: JPEG }, reporter)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ count: MAX_REQUEST_PHOTOS }).service.add("t1", "r1", { fileName: "a.jpg", mimeType: "image/jpeg", bytes: JPEG }, reporter)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses bytes that are not the declared picture type", async () => {
    await expect(build().service.add("t1", "r1", { fileName: "a.jpg", mimeType: "image/jpeg", bytes: Buffer.from("not a picture at all") }, reporter)).rejects.toBeInstanceOf(BadRequestException);
  });
});
