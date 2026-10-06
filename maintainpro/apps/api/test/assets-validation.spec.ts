import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

import { CreateAssetDto } from "../src/modules/assets/dto/assets.dto";

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
});
