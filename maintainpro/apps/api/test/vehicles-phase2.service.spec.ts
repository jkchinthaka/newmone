import { BadRequestException } from "@nestjs/common";
import {
  GateMovementStatus,
  GateMovementType,
  RoleName,
  TripStatus,
  VehicleMeterReadingType,
  VehicleServiceStatus,
  VehicleStatus
} from "@prisma/client";

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
    workOrder: {
      findMany: jest.fn().mockResolvedValue([])
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

const buildVehicle = (overrides: Record<string, unknown> = {}) => {
  return {
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
  };
};

describe("VehiclesService Phase 2 critical flows", () => {
  let prisma: any;
  let tx: any;
  let service: VehiclesService;

  beforeEach(() => {
    const bundle = createPrismaMockBundle();
    prisma = bundle.prisma;
    tx = bundle.tx;
    prisma.workOrder.findMany.mockResolvedValue([]);

    const fleetService = {
      updateGps: jest.fn()
    };

    const complianceService = {
      evaluateForGateOut: jest.fn().mockResolvedValue([])
    };

    service = new VehiclesService(prisma, fleetService as any, complianceService as any);
  });

  it("allows gate-out when vehicle has no blocking issues", async () => {
    jest.spyOn(service, "findOne").mockResolvedValue(buildVehicle() as any);

    tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
    tx.vehicleGateMovement.create.mockResolvedValue({ id: "move-1", status: GateMovementStatus.ALLOWED });
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "log-1" });

    const result = await service.gateOut("veh-1", {
      meterReading: 1150,
      notes: "Routine dispatch"
    });

    expect(result.allowed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.overrideUsed).toBe(false);
    expect(tx.vehicle.update).toHaveBeenCalledWith({
      where: { id: "veh-1" },
      data: expect.objectContaining({
        status: VehicleStatus.IN_USE,
        currentMileage: 1150
      })
    });
    expect(tx.vehicleGateMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: "veh-1",
        movementType: GateMovementType.OUT,
        status: GateMovementStatus.ALLOWED,
        meterReading: 1150,
        previousMileage: 1000
      })
    });
    expect(tx.vehicleMeterLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: "veh-1",
        reading: 1150,
        readingType: VehicleMeterReadingType.GATE_OUT,
        source: "gate-out"
      })
    });
  });

  it("blocks gate-out when service is overdue and writes a blocked movement audit log", async () => {
    jest.spyOn(service, "findOne").mockResolvedValue(
      buildVehicle({
        status: VehicleStatus.AVAILABLE,
        currentMileage: 1200,
        nextServiceMileage: 1200,
        serviceStatus: VehicleServiceStatus.ON_SCHEDULE
      }) as any
    );

    prisma.vehicleGateMovement.create.mockResolvedValue({ id: "blocked-move-1" });

    const result = await service.gateOut("veh-1", {
      meterReading: 1210
    });

    expect(result.allowed).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.blockedReason).toContain("Vehicle service is overdue");
    expect(prisma.vehicleGateMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: "veh-1",
        movementType: GateMovementType.OUT,
        status: GateMovementStatus.BLOCKED,
        meterReading: 1210
      })
    });
    expect(tx.vehicle.update).not.toHaveBeenCalled();
    expect(tx.vehicleMeterLog.create).not.toHaveBeenCalled();
  });

  it("blocks gate-out when vehicle has a critical restriction", async () => {
    jest.spyOn(service, "findOne").mockResolvedValue(
      buildVehicle({
        status: VehicleStatus.OUT_OF_SERVICE,
        currentMileage: 900,
        nextServiceMileage: 5000
      }) as any
    );

    prisma.vehicleGateMovement.create.mockResolvedValue({ id: "blocked-move-2" });

    const result = await service.gateOut("veh-1", {
      meterReading: 920
    });

    expect(result.allowed).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.blockedReason).toContain("Vehicle status is OUT OF SERVICE");
    expect(prisma.vehicleGateMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: GateMovementStatus.BLOCKED
      })
    });
  });

  it("blocks gate-out when vehicle has critical open work orders", async () => {
    jest.spyOn(service, "findOne").mockResolvedValue(buildVehicle() as any);
    prisma.workOrder.findMany.mockResolvedValue([
      { woNumber: "WO-9001", type: "EMERGENCY", status: "IN_PROGRESS", priority: "CRITICAL" }
    ]);
    prisma.vehicleGateMovement.create.mockResolvedValue({ id: "blocked-move-wo" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-gate" });

    const result = await service.gateOut("veh-1", { meterReading: 1100 });

    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toContain("WO-9001");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("allows override only for authorized approver roles and records override audit data", async () => {
    jest.spyOn(service, "findOne").mockResolvedValue(
      buildVehicle({
        status: VehicleStatus.OUT_OF_SERVICE,
        currentMileage: 1800,
        nextServiceMileage: 4000
      }) as any
    );

    prisma.user.findUnique.mockResolvedValue({
      id: "mgr-1",
      role: {
        name: RoleName.FLEET_MANAGER
      }
    });

    tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
    tx.vehicleGateMovement.create.mockResolvedValue({ id: "move-override-1", status: GateMovementStatus.OVERRIDE_APPROVED });
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "log-override-1" });

    const result = await service.gateOut("veh-1", {
      meterReading: 1850,
      allowOverride: true,
      overrideReason: "Emergency response dispatch",
      approvedByUserId: "mgr-1",
      notes: "Approved override"
    });

    expect(result.allowed).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.overrideUsed).toBe(true);
    expect(tx.vehicleGateMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: GateMovementStatus.OVERRIDE_APPROVED,
        approvedById: "mgr-1",
        overrideReason: "Emergency response dispatch"
      })
    });
    expect(tx.vehicleMeterLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        readingType: VehicleMeterReadingType.GATE_OUT,
        reading: 1850
      })
    });
  });

  it("rejects override attempts from unauthorized users", async () => {
    jest.spyOn(service, "findOne").mockResolvedValue(
      buildVehicle({
        status: VehicleStatus.OUT_OF_SERVICE,
        currentMileage: 1400
      }) as any
    );

    prisma.user.findUnique.mockResolvedValue({
      id: "drv-1",
      role: {
        name: RoleName.DRIVER
      }
    });

    await expect(
      service.gateOut("veh-1", {
        meterReading: 1410,
        allowOverride: true,
        overrideReason: "Need to move quickly",
        approvedByUserId: "drv-1"
      })
    ).rejects.toThrow("Override approver does not have authority for gate release");

    expect(tx.vehicle.update).not.toHaveBeenCalled();
    expect(tx.vehicleGateMovement.create).not.toHaveBeenCalled();
  });

  it("records gate-in movement and return meter reading", async () => {
    jest.spyOn(service, "findOne").mockResolvedValue(
      buildVehicle({
        status: VehicleStatus.IN_USE,
        currentMileage: 1500,
        driverId: "drv-1"
      }) as any
    );

    tx.tripLog.findFirst.mockResolvedValue({
      id: "trip-1",
      startMileage: 1200,
      status: TripStatus.IN_PROGRESS
    });
    tx.tripLog.update.mockResolvedValue({ id: "trip-1" });
    tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
    tx.vehicleGateMovement.create.mockResolvedValue({ id: "gate-in-1" });
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "meter-log-1" });

    const result = await service.gateIn("veh-1", {
      meterReading: 1650,
      notes: "Returned to yard"
    });

    expect(result.allowed).toBe(true);
    expect(tx.tripLog.update).toHaveBeenCalledWith({
      where: { id: "trip-1" },
      data: expect.objectContaining({
        endMileage: 1650,
        distance: 450,
        status: TripStatus.COMPLETED
      })
    });
    expect(tx.vehicleGateMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        movementType: GateMovementType.IN,
        status: GateMovementStatus.ALLOWED,
        meterReading: 1650,
        previousMileage: 1500
      })
    });
    expect(tx.vehicleMeterLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reading: 1650,
        readingType: VehicleMeterReadingType.GATE_IN,
        source: "gate-in"
      })
    });
  });

  it("rejects gate-in readings below the last known/out mileage", async () => {
    jest.spyOn(service, "findOne").mockResolvedValue(
      buildVehicle({
        status: VehicleStatus.IN_USE,
        currentMileage: 1650
      }) as any
    );

    await expect(
      service.gateIn("veh-1", {
        meterReading: 1600
      })
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("calculates trip KM correctly on trip end", async () => {
    prisma.tripLog.findUnique.mockResolvedValue({
      id: "trip-1",
      vehicleId: "veh-1",
      driverId: "drv-1",
      startMileage: 1000
    });

    tx.tripLog.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "trip-1",
      distance: data.distance,
      status: data.status
    }));
    tx.vehicle.findUnique.mockResolvedValue({
      currentMileage: 1000,
      nextServiceDate: null,
      nextServiceMileage: 3000,
      serviceStatus: VehicleServiceStatus.ON_SCHEDULE
    });
    tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
    tx.driver.findUnique.mockResolvedValue({ userId: "user-driver" });
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "trip-end-log-1" });

    const result = await service.tripEnd("veh-1", {
      tripId: "trip-1",
      endMileage: 1485,
      notes: "Trip completed"
    });

    expect(tx.tripLog.update).toHaveBeenCalledWith({
      where: { id: "trip-1" },
      data: expect.objectContaining({
        endMileage: 1485,
        distance: 485,
        status: TripStatus.COMPLETED
      })
    });
    expect(tx.vehicleMeterLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reading: 1485,
        readingType: VehicleMeterReadingType.TRIP_END,
        source: "trip-end"
      })
    });
    expect(result.distance).toBe(485);
  });

  it("recalculates service rule remaining KM and service status", async () => {
    jest.spyOn(service, "findOne").mockResolvedValue(
      buildVehicle({
        currentMileage: 10000,
        serviceStatus: VehicleServiceStatus.ON_SCHEDULE,
        nextServiceDate: null,
        nextServiceMileage: 12000,
        serviceIntervalMileage: 1000
      }) as any
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
    tx.vehicleMeterLog.create.mockResolvedValue({ id: "service-update-log-1" });

    const result = await service.updateServiceRule("veh-1", {
      serviceIntervalMileage: 300,
      resetFromCurrentMileage: true,
      notes: "Set tighter service cycle"
    });

    expect(tx.vehicle.update).toHaveBeenCalledWith({
      where: { id: "veh-1" },
      data: expect.objectContaining({
        serviceIntervalMileage: 300,
        nextServiceMileage: 10300,
        serviceStatus: VehicleServiceStatus.DUE_SOON
      })
    });
    expect(result.evaluation.dueSoon).toBe(true);
    expect(result.evaluation.overdue).toBe(false);
    expect(result.evaluation.remainingMileage).toBe(300);
    expect(result.vehicle.serviceStatus).toBe(VehicleServiceStatus.DUE_SOON);
  });

  it("triggers due and overdue statuses at expected mileage/date thresholds", async () => {
    prisma.vehicle.count.mockResolvedValue(4);
    prisma.vehicle.groupBy.mockResolvedValue([
      { status: VehicleStatus.AVAILABLE, _count: { _all: 3 } },
      { status: VehicleStatus.IN_USE, _count: { _all: 1 } }
    ]);
    prisma.vehicle.findMany.mockResolvedValue([
      {
        currentMileage: 1600,
        nextServiceDate: null,
        nextServiceMileage: 2000,
        serviceStatus: VehicleServiceStatus.ON_SCHEDULE
      },
      {
        currentMileage: 2500,
        nextServiceDate: null,
        nextServiceMileage: 2500,
        serviceStatus: VehicleServiceStatus.ON_SCHEDULE
      },
      {
        currentMileage: 800,
        nextServiceDate: new Date("2025-01-01T00:00:00.000Z"),
        nextServiceMileage: 5000,
        serviceStatus: VehicleServiceStatus.ON_SCHEDULE
      },
      {
        currentMileage: 100,
        nextServiceDate: null,
        nextServiceMileage: 3000,
        serviceStatus: VehicleServiceStatus.ON_SCHEDULE
      }
    ]);

    const summary = await service.summary(14);

    expect(summary.totalVehicles).toBe(4);
    expect(summary.upcomingServices).toBe(1);
    expect(summary.overdueMaintenance).toBe(2);
  });
});
