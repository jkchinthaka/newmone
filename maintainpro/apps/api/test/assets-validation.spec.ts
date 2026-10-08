import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

import { CreateAssetDto, UpdateAssetDto } from "../src/modules/assets/dto/assets.dto";

describe("CreateAssetDto validation", () => {
  it("rejects negative meterReading", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      assetTag: "AST-1001",
      name: "Pump A",
      meterReading: -5
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "meterReading")).toBe(true);
  });

  it("rejects warranty expiry before purchase date", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      assetTag: "AST-1002",
      name: "Pump B",
      purchaseDate: "2026-06-01",
      warrantyExpiry: "2026-01-01"
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "warrantyExpiry")).toBe(true);
  });

  it("rejects next service date before last service date", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      assetTag: "AST-1003",
      name: "Pump C",
      lastServiceDate: "2026-08-01",
      nextServiceDate: "2026-07-01"
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "nextServiceDate")).toBe(true);
  });

  it("accepts valid service and warranty dates", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      assetTag: "AST-1004",
      name: "Pump D",
      purchaseDate: "2026-01-01",
      warrantyExpiry: "2027-01-01",
      lastServiceDate: "2026-06-01",
      nextServiceDate: "2026-12-01",
      meterReading: 0
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects an asset tag that does not match AST-XXXX", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      assetTag: "pump-1",
      name: "Pump E"
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "assetTag")).toBe(true);
  });

  it("accepts a lowercase AST tag after normalizing it", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      assetTag: "ast-1005",
      name: "Pump F"
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.assetTag).toBe("AST-1005");
  });

  it("allows an update payload to keep a legacy tag", async () => {
    const kept = plainToInstance(UpdateAssetDto, {
      assetTag: "VF-01",
      name: "Vacuum Filler"
    });
    expect(await validate(kept)).toHaveLength(0);
    expect(kept.assetTag).toBe("VF-01");
  });
});
