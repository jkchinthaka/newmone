import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateVehicleDto } from "../src/modules/vehicles/dto/create-vehicle.dto";

const VALID_PAYLOAD = {
  registrationNo: "WP-CAB-1234",
  make: "Toyota",
  vehicleModel: "Hiace",
  year: 2022,
  type: "VAN",
  fuelType: "DIESEL"
};

async function validatePayload(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateVehicleDto, payload, { enableImplicitConversion: true });
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe("CreateVehicleDto runtime validation (POST /vehicles)", () => {
  it("accepts a valid payload with zero errors", async () => {
    const errors = await validatePayload(VALID_PAYLOAD);
    expect(errors).toHaveLength(0);
  });

  it.each(["registrationNo", "make", "vehicleModel", "year", "type", "fuelType"])(
    "rejects a missing required field: %s",
    async (field) => {
      const { [field]: _omit, ...rest } = VALID_PAYLOAD as Record<string, unknown>;
      const errors = await validatePayload(rest);
      expect(errors.some((e) => e.property === field)).toBe(true);
    }
  );

  it.each(["registrationNo", "make", "vehicleModel"])(
    "rejects a whitespace-only value for: %s",
    async (field) => {
      const errors = await validatePayload({ ...VALID_PAYLOAD, [field]: "   " });
      expect(errors.some((e) => e.property === field)).toBe(true);
    }
  );

  it("rejects an invalid vehicle type enum value", async () => {
    const errors = await validatePayload({ ...VALID_PAYLOAD, type: "SPACESHIP" });
    expect(errors.some((e) => e.property === "type")).toBe(true);
  });

  it("rejects an invalid fuel type enum value", async () => {
    const errors = await validatePayload({ ...VALID_PAYLOAD, fuelType: "NUCLEAR" });
    expect(errors.some((e) => e.property === "fuelType")).toBe(true);
  });

  it("rejects an out-of-range year", async () => {
    const errors = await validatePayload({ ...VALID_PAYLOAD, year: 1500 });
    expect(errors.some((e) => e.property === "year")).toBe(true);
  });

  it("rejects a non-numeric year", async () => {
    const errors = await validatePayload({ ...VALID_PAYLOAD, year: "not-a-year" });
    expect(errors.some((e) => e.property === "year")).toBe(true);
  });

  it("rejects negative currentMileage", async () => {
    const errors = await validatePayload({ ...VALID_PAYLOAD, currentMileage: -5 });
    expect(errors.some((e) => e.property === "currentMileage")).toBe(true);
  });

  it("rejects an unrecognized/whitelisted-out field (forbidNonWhitelisted)", async () => {
    const errors = await validatePayload({ ...VALID_PAYLOAD, notARealField: "x" });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("accepts optional fields when provided validly", async () => {
    const errors = await validatePayload({
      ...VALID_PAYLOAD,
      assetTag: "AT-1",
      description: "Fleet van",
      location: "Colombo Depot",
      ownershipType: "OWNED",
      serviceStatus: "ON_SCHEDULE",
      currentMileage: 12000,
      acquisitionDate: "2022-01-15",
      warrantyExpiry: "2025-01-15"
    });
    expect(errors).toHaveLength(0);
  });
});
