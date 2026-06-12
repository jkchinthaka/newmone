import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { requestContext } from "../src/common/context/request-context";
import { FleetService } from "../src/modules/fleet/fleet.service";

const buildContext = (tenantId: string | null) => ({
  actorId: "actor-1",
  actorEmail: "actor@example.com",
  actorRole: "ADMIN",
  tenantId,
  module: "fleet",
  ipAddress: null,
  userAgent: null,
  requestPath: "/fleet"
});

describe("FleetService tenant isolation", () => {
  let service: FleetService;

  beforeEach(() => {
    service = new FleetService(
      {} as any,
      { broadcastAlertCreated: jest.fn() } as any,
      { get: jest.fn() } as unknown as ConfigService
    );

    (service as any).alerts.push(
      {
        id: "alert-a",
        type: "OVERSPEED",
        severity: "WARNING",
        vehicleId: "vehicle-a",
        registrationNo: "ABC-1234",
        message: "Tenant A alert",
        createdAt: new Date().toISOString()
      },
      {
        id: "alert-b",
        type: "OVERSPEED",
        severity: "WARNING",
        vehicleId: "vehicle-b",
        registrationNo: "XYZ-9999",
        message: "Tenant B alert",
        createdAt: new Date().toISOString()
      }
    );

    (service as any).runtimeStateByVehicle.set("vehicle-a", { tenantId: "tenant-a" });
    (service as any).runtimeStateByVehicle.set("vehicle-b", { tenantId: "tenant-b" });

    (service as any).geofences.set("gf-a", {
      id: "gf-a",
      tenantId: "tenant-a",
      name: "Depot A",
      type: "DEPOT",
      shape: "CIRCLE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    (service as any).geofences.set("gf-b", {
      id: "gf-b",
      tenantId: "tenant-b",
      name: "Depot B",
      type: "DEPOT",
      shape: "CIRCLE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it("listAlerts returns only alerts for vehicles in the caller tenant", () => {
    const alerts = requestContext.run(buildContext("tenant-a"), () => service.listAlerts(50));

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.vehicleId).toBe("vehicle-a");
  });

  it("listGeofences returns only geofences owned by the caller tenant", () => {
    const geofences = requestContext.run(buildContext("tenant-a"), () => service.listGeofences());

    expect(geofences).toHaveLength(1);
    expect(geofences[0]?.id).toBe("gf-a");
  });

  it("removeGeofence rejects cross-tenant geofence deletion", () => {
    expect(() =>
      requestContext.run(buildContext("tenant-a"), () => service.removeGeofence("gf-b"))
    ).toThrow(NotFoundException);
    expect((service as any).geofences.has("gf-b")).toBe(true);
  });
});
