import "reflect-metadata";

import { INestApplication, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory, Reflector } from "@nestjs/core";
import {
  AuditAction,
  GateMovementStatus,
  RoleName,
  TripStatus,
  VehicleMeterReadingType,
  VehicleServiceStatus,
  VehicleStatus
} from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";

import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../src/common/guards/permissions.guard";
import { PrismaService } from "../src/database/prisma.service";
import { FleetService } from "../src/modules/fleet/fleet.service";
import { ComplianceService } from "../src/modules/compliance/compliance.service";
import { VehiclesController } from "../src/modules/vehicles/vehicles.controller";
import { VehiclesService } from "../src/modules/vehicles/vehicles.service";

type PrismaMockBundle = {
  prisma: any;
  tx: any;
};

const createPrismaMockBundle = (): PrismaMockBundle => {
  const tx = {
    vehicle: {
      update: jest.fn(),
      findUnique: jest.fn()
    },
    vehicleGateMovement: {
      create: jest.fn()
    },
    vehicleMeterLog: {
      create: jest.fn()
    },
    tripLog: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn()
    },
    driver: {
      findUnique: jest.fn()
    }
  };

  const prisma = {
    vehicle: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    },
    vehicleGateMovement: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    vehicleMeterLog: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    tripLog: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn()
    },
    driver: {
      findUnique: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    fuelLog: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    gpsLocation: {
      findMany: jest.fn()
    },
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (client: typeof tx) => Promise<unknown>)(tx);
      }

      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }

      return arg;
    })
  };

  return {
    prisma,
    tx
  };
};

const mockBundle = createPrismaMockBundle();
const prisma = mockBundle.prisma;
const tx = mockBundle.tx;
const fleetService = {
  updateGps: jest.fn()
};

const buildVehicle = (overrides: Record<string, unknown> = {}) => ({
  id: "veh-1",
  registrationNo: "KA-01-AA-1234",
  status: VehicleStatus.AVAILABLE,
  currentMileage: 1000,
  nextServiceDate: null,
  nextServiceMileage: 2000,
  serviceStatus: VehicleServiceStatus.ON_SCHEDULE,
  serviceIntervalDays: null,
  serviceIntervalMileage: null,
  lastServiceDate: null,
  driverId: "drv-1",
  driver: {
    id: "drv-1",
    userId: "user-driver",
    licenseExpiry: new Date("2099-01-01T00:00:00.000Z"),
    user: {
      id: "user-driver",
      email: "driver@example.com",
      firstName: "Drive",
      lastName: "R"
    }
  },
  fuelLogs: [],
  tripLogs: [],
  ...overrides
});

@Module({
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    Reflector,
    {
      provide: PrismaService,
      useValue: prisma
    },
    {
      provide: FleetService,
      useValue: fleetService
    },
    {
      provide: ComplianceService,
      useValue: { evaluateForGateOut: jest.fn().mockResolvedValue([]) }
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard
    }
  ]
})
class VehiclesPhase2HttpE2eModule {}

describe("Vehicles Phase 2 HTTP e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, VehiclesController);

    app = await NestFactory.create(VehiclesPhase2HttpE2eModule, {
      logger: false
    });

    app.use((req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
      const permissionsHeader = req.headers["x-test-permissions"];
      const permissions =
        typeof permissionsHeader === "string" && permissionsHeader.trim().length > 0
          ? permissionsHeader
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];

      req.user = {
        sub: req.headers["x-test-user-id"] ?? "user-actor",
        email: req.headers["x-test-email"] ?? "actor@example.com",
        role: req.headers["x-test-role"] ?? "ADMIN",
        tenantId: req.headers["x-tenant-id"] ?? "tenant-1",
        permissions
      };

      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (client: typeof tx) => Promise<unknown>)(tx);
      }

      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }

      return arg;
    });

    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    tx.tripLog.findFirst.mockResolvedValue(null);
  });

  it("allows gate-out for authorized user when there are no blocking issues", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(buildVehicle());
    tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
    tx.vehicleGateMovement.create.mockResolvedValue({ id: "move-1", status: GateMovementStatus.ALLOWED });
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "log-1" });

    const response = await request(app.getHttpServer())
      .post("/vehicles/veh-1/gate-out")
      .set("x-test-permissions", "vehicles.operate")
      .send({ meterReading: 1125, notes: "Dispatch" })
      .expect(201);

    expect(response.body.message).toBe("Gate-out recorded");
    expect(response.body.data.allowed).toBe(true);
    expect(response.body.data.blocked).toBe(false);
    expect(tx.vehicleGateMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: "veh-1",
        status: GateMovementStatus.ALLOWED,
        meterReading: 1125
      })
    });
    expect(tx.vehicleMeterLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        readingType: VehicleMeterReadingType.GATE_OUT,
        reading: 1125
      })
    });
  });

  it("allows security officer gate-out with the fine-grained gate permission", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(buildVehicle());
    tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
    tx.vehicleGateMovement.create.mockResolvedValue({ id: "move-1", status: GateMovementStatus.ALLOWED });
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "log-1" });

    const response = await request(app.getHttpServer())
      .post("/vehicles/veh-1/gate-out")
      .set("x-test-role", "SECURITY_OFFICER")
      .set("x-test-permissions", "gate.out.create")
      .send({ meterReading: 1125, notes: "Security dispatch" })
      .expect(201);

    expect(response.body.message).toBe("Gate-out recorded");
    expect(response.body.data.allowed).toBe(true);
  });

  it("blocks gate-out when vehicle service is overdue", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(
      buildVehicle({
        currentMileage: 2000,
        nextServiceMileage: 2000,
        status: VehicleStatus.AVAILABLE
      })
    );
    prisma.vehicleGateMovement.create.mockResolvedValueOnce({ id: "blocked-1" });

    const response = await request(app.getHttpServer())
      .post("/vehicles/veh-1/gate-out")
      .set("x-test-permissions", "vehicles.operate")
      .send({ meterReading: 2005 })
      .expect(201);

    expect(response.body.message).toBe("Gate-out blocked");
    expect(response.body.data.allowed).toBe(false);
    expect(response.body.data.blocked).toBe(true);
    expect(response.body.data.blockedReason).toContain("Vehicle service is overdue");
    expect(prisma.vehicleGateMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: GateMovementStatus.BLOCKED
      })
    });
  });

  it("blocks gate-out when vehicle has a critical restriction status", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(
      buildVehicle({
        status: VehicleStatus.OUT_OF_SERVICE,
        currentMileage: 1500,
        nextServiceMileage: 9000
      })
    );
    prisma.vehicleGateMovement.create.mockResolvedValueOnce({ id: "blocked-critical-1" });

    const response = await request(app.getHttpServer())
      .post("/vehicles/veh-1/gate-out")
      .set("x-test-permissions", "vehicles.operate")
      .send({ meterReading: 1510 })
      .expect(201);

    expect(response.body.message).toBe("Gate-out blocked");
    expect(response.body.data.allowed).toBe(false);
    expect(response.body.data.blocked).toBe(true);
    expect(response.body.data.blockedReason).toContain("Vehicle status is OUT OF SERVICE");
    expect(prisma.vehicleGateMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: GateMovementStatus.BLOCKED
      })
    });
  });

  it("allows gate-out override only when approved by authorized role and records centralized audit", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(
      buildVehicle({
        status: VehicleStatus.OUT_OF_SERVICE,
        currentMileage: 3100,
        nextServiceMileage: 9000
      })
    );
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "mgr-1",
      role: {
        name: RoleName.FLEET_MANAGER
      }
    });
    tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
    tx.vehicleGateMovement.create.mockResolvedValue({
      id: "move-override-1",
      status: GateMovementStatus.OVERRIDE_APPROVED
    });
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "meter-override-1" });

    const response = await request(app.getHttpServer())
      .post("/vehicles/veh-1/gate-out")
      .set("x-test-permissions", "vehicles.operate")
      .send({
        meterReading: 3200,
        allowOverride: true,
        overrideReason: "Emergency move",
        approvedByUserId: "mgr-1"
      })
      .expect(201);

    expect(response.body.message).toBe("Gate-out recorded");
    expect(response.body.data.allowed).toBe(true);
    expect(response.body.data.overrideUsed).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: "VEHICLE_GATE_MOVEMENT",
        action: AuditAction.UPDATE,
        reason: "Emergency move"
      })
    });
  });

  it("rejects gate-out override for unauthorized approver role", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(
      buildVehicle({
        status: VehicleStatus.OUT_OF_SERVICE,
        currentMileage: 1100,
        nextServiceMileage: 5000
      })
    );
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "driver-approver",
      role: {
        name: RoleName.DRIVER
      }
    });

    const response = await request(app.getHttpServer())
      .post("/vehicles/veh-1/gate-out")
      .set("x-test-permissions", "vehicles.operate")
      .send({
        meterReading: 1110,
        allowOverride: true,
        overrideReason: "Try bypass",
        approvedByUserId: "driver-approver"
      })
      .expect(400);

    expect(response.body.message).toBe("Override approver does not have authority for gate release");
  });

  it("records gate-in movement and meter log", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(
      buildVehicle({
        status: VehicleStatus.IN_USE,
        currentMileage: 5000,
        driverId: "drv-1"
      })
    );
    tx.tripLog.findFirst.mockResolvedValue({
      id: "trip-1",
      startMileage: 4800,
      status: TripStatus.IN_PROGRESS
    });
    tx.tripLog.update.mockResolvedValue({ id: "trip-1" });
    tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
    tx.vehicleGateMovement.create.mockResolvedValue({ id: "in-1" });
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "in-meter-1" });

    const response = await request(app.getHttpServer())
      .post("/vehicles/veh-1/gate-in")
      .set("x-test-permissions", "vehicles.operate")
      .send({ meterReading: 5250, notes: "Returned" })
      .expect(201);

    expect(response.body.message).toBe("Gate-in recorded");
    expect(response.body.data.allowed).toBe(true);
    expect(tx.vehicleGateMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        meterReading: 5250,
        previousMileage: 5000
      })
    });
    expect(tx.vehicleMeterLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        readingType: VehicleMeterReadingType.GATE_IN,
        reading: 5250
      })
    });
  });

  it("returns correct error response for invalid gate-in meter reading", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(
      buildVehicle({
        status: VehicleStatus.IN_USE,
        currentMileage: 2100
      })
    );

    const response = await request(app.getHttpServer())
      .post("/vehicles/veh-1/gate-in")
      .set("x-test-permissions", "vehicles.operate")
      .send({ meterReading: 2090 })
      .expect(400);

    expect(response.body.message).toBe("Mileage entries must be monotonically increasing");
    expect(response.body.error).toBe("Bad Request");
  });

  it("returns recalculated service status and remaining KM on service-rule endpoint and records audit", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(
      buildVehicle({
        currentMileage: 10000,
        serviceStatus: VehicleServiceStatus.ON_SCHEDULE,
        nextServiceDate: null,
        nextServiceMileage: 13000,
        serviceIntervalMileage: 1000
      })
    );
    tx.vehicle.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "veh-1",
      registrationNo: "KA-01-AA-1234",
      currentMileage: 10000,
      nextServiceDate: data.nextServiceDate ?? null,
      nextServiceMileage: data.nextServiceMileage,
      serviceIntervalMileage: data.serviceIntervalMileage,
      serviceIntervalDays: data.serviceIntervalDays ?? null,
      lastServiceDate: data.lastServiceDate ?? null,
      serviceStatus: data.serviceStatus,
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    }));
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "svc-log-1" });

    const response = await request(app.getHttpServer())
      .patch("/vehicles/veh-1/service-rule")
      .set("x-test-permissions", "vehicles.edit")
      .send({
        serviceIntervalMileage: 300,
        resetFromCurrentMileage: true,
        notes: "Tighten interval"
      })
      .expect(200);

    expect(response.body.message).toBe("Service rule updated");
    expect(response.body.data.vehicle.serviceStatus).toBe(VehicleServiceStatus.DUE_SOON);
    expect(response.body.data.evaluation.remainingMileage).toBe(300);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: "VEHICLE",
        action: AuditAction.UPDATE,
        reason: "Tighten interval"
      })
    });
  });

  it("returns 403 for unauthorized access to gate, meter, and service-rule endpoints", async () => {
    await request(app.getHttpServer())
      .post("/vehicles/veh-1/gate-out")
      .set("x-test-permissions", "vehicles.view")
      .send({ meterReading: 1200 })
      .expect(403);

    await request(app.getHttpServer())
      .post("/vehicles/veh-1/meter-reading")
      .set("x-test-permissions", "vehicles.view")
      .send({ reading: 1200 })
      .expect(403);

    await request(app.getHttpServer())
      .patch("/vehicles/veh-1/service-rule")
      .set("x-test-permissions", "vehicles.view")
      .send({ serviceIntervalMileage: 500 })
      .expect(403);
  });

  it("records centralized audit for manual meter correction endpoint", async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(
      buildVehicle({
        currentMileage: 7100,
        nextServiceMileage: 7800,
        serviceStatus: VehicleServiceStatus.ON_SCHEDULE
      })
    );
    tx.vehicle.update.mockResolvedValue({
      id: "veh-1",
      currentMileage: 7250,
      nextServiceDate: null,
      nextServiceMileage: 7800,
      serviceStatus: VehicleServiceStatus.ON_SCHEDULE
    });
    tx.vehicleMeterLog.create.mockResolvedValue({
      id: "meter-manual-1"
    });

    const response = await request(app.getHttpServer())
      .post("/vehicles/veh-1/meter-reading")
      .set("x-test-permissions", "vehicles.operate")
      .send({
        reading: 7250,
        source: "manual-calibration",
        notes: "Corrected odometer"
      })
      .expect(201);

    expect(response.body.message).toBe("Meter reading recorded");
    expect(response.body.data.vehicle.currentMileage).toBe(7250);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: "VEHICLE",
        action: AuditAction.UPDATE,
        reason: "Corrected odometer",
        metadata: expect.objectContaining({
          event: "MANUAL_METER_READING"
        })
      })
    });
  });
});
