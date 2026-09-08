import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  GateMovementStatus,
  GateMovementType,
  RoleName,
  VehicleServiceStatus,
  VehicleStatus
} from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { VehiclesService } from "../src/modules/vehicles/vehicles.service";

const createPrismaMock = () => {
  const tx = {
    vehicle: { update: jest.fn() },
    vehicleGateMovement: { create: jest.fn() },
    vehicleMeterLog: { create: jest.fn() }
  };

  const prisma = {
    vehicle: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    vehicleGateMovement: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    user: {
      findUnique: jest.fn()
    },
    driver: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    workOrder: {
      findMany: jest.fn().mockResolvedValue([])
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" })
    },
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (client: typeof tx) => Promise<unknown>)(tx);
      }
      return arg;
    })
  };

  prisma.vehicle.findFirst.mockImplementation((args: unknown) => prisma.vehicle.findUnique(args));

  return { prisma, tx };
};

const blockedVehicle = () => ({
  id: "veh-1",
  registrationNo: "KA-01-AA-1234",
  status: VehicleStatus.OUT_OF_SERVICE,
  currentMileage: 1000,
  nextServiceDate: null,
  nextServiceMileage: 5000,
  serviceStatus: VehicleServiceStatus.ON_SCHEDULE,
  serviceIntervalDays: null,
  serviceIntervalMileage: null,
  lastServiceDate: null,
  driverId: "drv-1",
  driver: {
    id: "drv-1",
    userId: "user-driver",
    licenseExpiry: new Date("2099-01-01T00:00:00.000Z"),
    user: { id: "user-driver", email: "d@example.com" }
  }
});

describe("gate override authorization", () => {
  let prisma: ReturnType<typeof createPrismaMock>["prisma"];
  let tx: ReturnType<typeof createPrismaMock>["tx"];
  let service: VehiclesService;

  const runAs = (actorId: string, fn: () => Promise<void>) =>
    requestContext.run(
      {
        actorId,
        actorEmail: "actor@example.com",
        actorRole: RoleName.SECURITY_OFFICER,
        tenantId: "tenant-1",
        module: null,
        ipAddress: null,
        userAgent: null,
        requestPath: null
      },
      fn
    );

  beforeEach(() => {
    const bundle = createPrismaMock();
    prisma = bundle.prisma;
    tx = bundle.tx;
    service = new VehiclesService(
      prisma as any,
      { updateGps: jest.fn() } as any,
      { evaluateForGateOut: jest.fn().mockResolvedValue([]) } as any
    );
    jest.spyOn(service, "findOne").mockResolvedValue(blockedVehicle() as any);
    prisma.vehicleGateMovement.findMany.mockResolvedValue([]);
  });

  it("forbids override when actor only has gate.out.create", async () => {
    await runAs("actor-gate", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "actor-gate",
        role: {
          name: RoleName.SECURITY_OFFICER,
          permissions: [{ key: "gate.out.create" }, { key: "vehicles.view" }]
        }
      });

      await expect(
        service.gateOut("veh-1", {
          meterReading: 1100,
          allowOverride: true,
          overrideReason: "Emergency",
          approvedByUserId: "mgr-forged"
        })
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(tx.vehicleGateMovement.create).not.toHaveBeenCalled();
    });
  });

  it("allows override when actor has gate.override.approve and sets approvedById to actor", async () => {
    await runAs("actor-approver", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "actor-approver",
        role: {
          name: RoleName.MANAGER,
          permissions: [{ key: "gate.override.approve" }, { key: "gate.out.create" }]
        }
      });
      tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
      tx.vehicleGateMovement.create.mockResolvedValue({
        id: "move-ov-1",
        status: GateMovementStatus.OVERRIDE_APPROVED
      });
      tx.vehicleMeterLog.create.mockResolvedValue({ id: "log-1" });

      const result = await service.gateOut("veh-1", {
        meterReading: 1100,
        allowOverride: true,
        overrideReason: "Emergency dispatch",
        approvedByUserId: "someone-else"
      });

      expect(result.allowed).toBe(true);
      expect(result.overrideUsed).toBe(true);
      expect(tx.vehicleGateMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: GateMovementStatus.OVERRIDE_APPROVED,
          approvedById: "actor-approver",
          overrideReason: "Emergency dispatch",
          metadata: expect.objectContaining({
            clientAttemptedApproverId: "someone-else"
          })
        })
      });
    });
  });

  it("ignores client forged approvedByUserId of another manager", async () => {
    await runAs("real-actor", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "real-actor",
        role: {
          name: RoleName.FLEET_MANAGER,
          permissions: [{ key: "gate.override.approve" }]
        }
      });
      tx.vehicle.update.mockResolvedValue({ id: "veh-1" });
      tx.vehicleGateMovement.create.mockResolvedValue({
        id: "move-ov-2",
        status: GateMovementStatus.OVERRIDE_APPROVED
      });
      tx.vehicleMeterLog.create.mockResolvedValue({ id: "log-2" });

      await service.gateOut("veh-1", {
        meterReading: 1100,
        allowOverride: true,
        overrideReason: "Authorized by me",
        approvedByUserId: "other-manager"
      });

      expect(tx.vehicleGateMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          approvedById: "real-actor"
        })
      });
      expect(tx.vehicleGateMovement.create.mock.calls[0][0].data.approvedById).not.toBe(
        "other-manager"
      );
    });
  });

  it("rejects override when overrideReason is missing", async () => {
    await runAs("actor-approver", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "actor-approver",
        role: {
          name: RoleName.MANAGER,
          permissions: [{ key: "gate.override.approve" }]
        }
      });

      await expect(
        service.gateOut("veh-1", {
          meterReading: 1100,
          allowOverride: true,
          overrideReason: "   ",
          approvedByUserId: "actor-approver"
        })
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.vehicle.update).not.toHaveBeenCalled();
    });
  });

  it("idempotency: second call with same key returns same movement id", async () => {
    await runAs("actor-approver", async () => {
      const existing = {
        id: "move-idem-1",
        status: GateMovementStatus.OVERRIDE_APPROVED,
        blockedReason: "Vehicle status is OUT OF SERVICE",
        movementType: GateMovementType.OUT,
        metadata: { idempotencyKey: "gate-out-key-1" }
      };
      prisma.vehicleGateMovement.findMany.mockResolvedValue([existing]);

      const result = await service.gateOut("veh-1", {
        meterReading: 1100,
        allowOverride: true,
        overrideReason: "Emergency",
        idempotencyKey: "gate-out-key-1"
      });

      expect(result.movement.id).toBe("move-idem-1");
      expect(result.idempotentReplay).toBe(true);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(tx.vehicleGateMovement.create).not.toHaveBeenCalled();
      expect(prisma.vehicleGateMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vehicleId: "veh-1",
            movementType: GateMovementType.OUT
          })
        })
      );
    });
  });
});
