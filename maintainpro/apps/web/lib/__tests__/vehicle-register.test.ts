import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { buildRegisterVehiclePayload, FUEL_TYPE_OPTIONS, FuelType, VEHICLE_TYPE_OPTIONS, VehicleType } from "../vehicle-register";

const pageSource = fs.readFileSync(
  path.resolve(__dirname, "../../app/(dashboard)/admin/vehicles/new/page.tsx"),
  "utf8"
);
const payloadSource = fs.readFileSync(path.resolve(__dirname, "../vehicle-register.ts"), "utf8");

describe("register vehicle payload", () => {
  it("sends the selected type and fuelType and does not hardcode CAR", () => {
    const payload = buildRegisterVehiclePayload({
      registrationNo: " cp abc-1234 ",
      type: VehicleType.TRUCK,
      fuelType: FuelType.DIESEL,
      make: " Tata ",
      vehicleModel: " Ace ",
      year: "2024",
      ownershipType: "",
      currentMileage: "",
      assetTag: ""
    });

    assert.equal(payload.registrationNo, "CP ABC-1234");
    assert.equal(payload.type, VehicleType.TRUCK);
    assert.equal(payload.fuelType, FuelType.DIESEL);
    assert.equal(payload.make, "Tata");
    assert.equal(payload.vehicleModel, "Ace");
    assert.equal(payload.year, 2024);
    assert.equal(Object.hasOwn(payload, "ownershipType"), false);
    assert.equal(Object.hasOwn(payload, "currentMileage"), false);
    assert.equal(Object.hasOwn(payload, "assetTag"), false);
    assert.notEqual(payload.type, "CAR");
    assert.equal(VEHICLE_TYPE_OPTIONS.includes(VehicleType.TRUCK), true);
    assert.equal(FUEL_TYPE_OPTIONS.includes(FuelType.DIESEL), true);
    assert.doesNotMatch(pageSource, /type:\s*["']CAR["']/);
    assert.doesNotMatch(payloadSource, /type:\s*["']CAR["']/);
    assert.match(pageSource, /buildRegisterVehiclePayload/);
  });

  it("includes optional fields only when they are filled", () => {
    const payload = buildRegisterVehiclePayload({
      registrationNo: "CP XYZ-9",
      type: VehicleType.VAN,
      fuelType: FuelType.PETROL,
      make: "Nissan",
      vehicleModel: "Caravan",
      year: "2025",
      ownershipType: "LEASED",
      currentMileage: "1200",
      assetTag: " AST-9 "
    });

    assert.equal(payload.type, VehicleType.VAN);
    assert.equal(payload.fuelType, FuelType.PETROL);
    assert.equal(payload.ownershipType, "LEASED");
    assert.equal(payload.currentMileage, 1200);
    assert.equal(payload.assetTag, "AST-9");
  });
});
