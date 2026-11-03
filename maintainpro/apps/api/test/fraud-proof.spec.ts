import { BadRequestException } from "@nestjs/common";

import { ProofPhotoService, proofPhotoKeyBelongsTo } from "../src/modules/evidence/proof-photo.service";
import { GoodsInService } from "../src/modules/inventory/goods-in.service";
import { fuelEntryProblem, median } from "../src/modules/vehicles/fuel-checks";

describe("fuel entry checks", () => {
  it("refuses more litres than the tank holds", () => {
    expect(fuelEntryProblem({ liters: 300, costPerLiter: 350, tankCapacity: 60, recentPrices: [] })?.message).toMatch(/tank holds \(60 L\)/);
    expect(fuelEntryProblem({ liters: 62, costPerLiter: 350, tankCapacity: 60, recentPrices: [] })).toBeNull();
  });

  it("asks for a reason when the price is far from the usual price, once there is history", () => {
    const usual = [350, 352, 348, 351];
    expect(median(usual)).toBe(350.5);
    expect(fuelEntryProblem({ liters: 40, costPerLiter: 450, recentPrices: usual })).toMatchObject({ needsPriceReason: true });
    expect(fuelEntryProblem({ liters: 40, costPerLiter: 450, recentPrices: usual, priceReason: "Fuel price increased today" })).toBeNull();
    expect(fuelEntryProblem({ liters: 40, costPerLiter: 360, recentPrices: usual })).toBeNull();
    expect(fuelEntryProblem({ liters: 40, costPerLiter: 999, recentPrices: [350, 351] })).toBeNull();
  });
});

describe("proof photos", () => {
  const tenant = "tenant_1";
  const key = `proof/${tenant}/fuel/2026-10/0f8fad5b-d9cb-469f-a165-70867728950e.jpg`;

  it("only opens keys of the caller's own company and never paths outside proof/", () => {
    expect(proofPhotoKeyBelongsTo(key, tenant)).toBe(true);
    expect(proofPhotoKeyBelongsTo(key, "other")).toBe(false);
    expect(proofPhotoKeyBelongsTo(`proof/${tenant}/fuel/2026-10/../../secret.jpg`, tenant)).toBe(false);
    expect(proofPhotoKeyBelongsTo("evidence/x.jpg", tenant)).toBe(false);
  });

  function service(ready: boolean) {
    const storage = {
      checkReadiness: () => ({ mode: "local", state: ready ? "configured" : "disabled", uploadsEnabled: ready }),
      putObject: jest.fn().mockResolvedValue(undefined)
    };
    return { photos: new ProofPhotoService(storage as never), storage };
  }

  it("requires a photo when storage works and stores it under the company", async () => {
    const { photos, storage } = service(true);
    await expect(photos.requireAndSave(tenant, "meter", undefined, "meter")).rejects.toThrow("Add a photo of the meter.");
    await expect(photos.requireAndSave(tenant, "meter", { buffer: Buffer.from("x"), mimetype: "text/plain" }, "meter")).rejects.toThrow(/JPG/);
    const saved = await photos.requireAndSave(tenant, "meter", { buffer: Buffer.from("x"), mimetype: "image/jpeg" }, "meter");
    expect(saved).toMatch(new RegExp(`^proof/${tenant}/meter/\\d{4}-\\d{2}/[0-9a-f-]{36}\\.jpg$`));
    expect(storage.putObject).toHaveBeenCalledWith(saved, expect.any(Buffer));
  });

  it("blocks saving in production when storage is down, allows it elsewhere", async () => {
    const { photos } = service(false);
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      await expect(photos.requireAndSave(tenant, "fuel", undefined, "fuel receipt")).rejects.toBeInstanceOf(BadRequestException);
      process.env.NODE_ENV = "development";
      await expect(photos.requireAndSave(tenant, "fuel", undefined, "fuel receipt")).resolves.toBeNull();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

describe("goods in limits", () => {
  const part = { id: "p-1", partNumber: "BRG-6204", erpCode: null, name: "Bearing", category: "Bearings", unit: "pcs", quantityInStock: 0 };
  const prisma = () => ({
    sparePart: { findMany: jest.fn().mockResolvedValue([part]), findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    warehouse: { findFirst: jest.fn().mockResolvedValue({ id: "wh", name: "Store" }), create: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) }
  });

  it("needs the GRN / invoice number", async () => {
    const service = new GoodsInService(prisma() as never, { receive: jest.fn() } as never, {} as never);
    await expect(
      service.receive({ sub: "u", tenantId: "t", role: "ADMIN" } as never, { lines: [{ partNumber: "BRG-6204", quantity: 1 }], idempotencyKey: "k" })
    ).rejects.toThrow("Enter the GRN / invoice number of this delivery.");
  });

  it("sends a large delivery from a store keeper to an Admin, and stores the photo only after the checks", async () => {
    const engine = { receive: jest.fn() };
    const savePhoto = jest.fn().mockResolvedValue("proof/t/goods-in/2026-10/x.jpg");
    const keeper = { sub: "u", tenantId: "t", role: "INVENTORY_KEEPER" };
    const service = new GoodsInService(prisma() as never, engine as never, {} as never);
    await expect(
      service.receive(keeper as never, { lines: [{ partNumber: "BRG-6204", quantity: 100, unitCost: 6000 }], referenceNo: "GRN-1", idempotencyKey: "k" }, savePhoto)
    ).rejects.toThrow(/Ask an Admin/);
    expect(savePhoto).not.toHaveBeenCalled();
    await service.receive(keeper as never, { lines: [{ partNumber: "BRG-6204", quantity: 10, unitCost: 850 }], referenceNo: "GRN-2", idempotencyKey: "k2" }, savePhoto);
    expect(savePhoto).toHaveBeenCalledTimes(1);
    expect(engine.receive).toHaveBeenCalledTimes(1);
    const admin = new GoodsInService(prisma() as never, { receive: jest.fn() } as never, {} as never);
    await expect(
      admin.receive({ ...keeper, role: "ADMIN" } as never, { lines: [{ partNumber: "BRG-6204", quantity: 100, unitCost: 6000 }], referenceNo: "GRN-3", idempotencyKey: "k3" })
    ).resolves.toMatchObject({ totalValue: 600000 });
  });
});
