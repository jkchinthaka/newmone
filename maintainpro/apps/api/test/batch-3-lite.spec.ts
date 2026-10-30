import { readFileSync } from "node:fs";
import { join } from "node:path";

import { vehicleServiceAfterClose } from "../src/modules/work-orders/vehicle-service-reset";

const read = (relative: string) => readFileSync(join(__dirname, "..", relative), "utf8");

describe("vehicle service due after a service job closes", () => {
  const closedAt = new Date("2026-10-23T06:00:00Z");

  it("moves next service forward from this service when intervals are set", () => {
    expect(
      vehicleServiceAfterClose({ closedAt, reading: 10_050, intervalDays: 90, intervalMileage: 5_000, nextServiceMileage: 10_000 })
    ).toEqual({
      lastServiceDate: closedAt,
      nextServiceDate: new Date("2027-01-21T06:00:00Z"),
      nextServiceMileage: 15_050,
      serviceStatus: "ON_SCHEDULE"
    });
  });

  it("clears a passed due target when no interval is configured", () => {
    const patch = vehicleServiceAfterClose({
      closedAt,
      reading: 10_050,
      nextServiceMileage: 10_000,
      nextServiceDate: new Date("2026-10-01T00:00:00Z")
    });
    expect(patch).toMatchObject({ nextServiceMileage: null, nextServiceDate: null, serviceStatus: "ON_SCHEDULE" });
  });

  it("keeps a future due target when no interval is configured", () => {
    const future = new Date("2026-12-01T00:00:00Z");
    expect(
      vehicleServiceAfterClose({ closedAt, reading: 10_050, nextServiceMileage: 12_000, nextServiceDate: future })
    ).toMatchObject({ nextServiceMileage: 12_000, nextServiceDate: future });
  });
});

describe("gate and repair wiring", () => {
  const vehicles = read("src/modules/vehicles/vehicles.service.ts");
  const domain = read("src/modules/work-orders/work-order-domain.service.ts");
  const service = read("src/modules/work-orders/work-orders.service.ts");

  it("starting work on a vehicle that is out keeps it IN_USE so it can gate back in", () => {
    expect(domain).toMatch(/if \(!raw \|\| vehicle\.status === VehicleStatus\.AVAILABLE\) \{/);
  });

  it("gate-in accepts a vehicle out for repair and parks it under maintenance while work is open", () => {
    expect(vehicles).toMatch(/where: \{ id, status: outForRepair \? VehicleStatus\.UNDER_MAINTENANCE : VehicleStatus\.IN_USE \}/);
    expect(vehicles).toMatch(/status: outForRepair \|\| openRepairs > 0 \? VehicleStatus\.UNDER_MAINTENANCE : VehicleStatus\.AVAILABLE/);
  });

  it("closing a service job resets the vehicle's service due", () => {
    expect(service).toMatch(/await this\.resetVehicleServiceDueAfterService\(current\);/);
  });
});
