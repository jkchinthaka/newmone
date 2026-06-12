import { requestContext } from "../src/common/context/request-context";
import { VehiclesService } from "../src/modules/vehicles/vehicles.service";

const createPrismaMock = () => ({
  vehicle: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({
      id: "vehicle-1",
      registrationNo: "ABC-1234",
      currentMileage: 0,
      serviceStatus: "ON_SCHEDULE",
      nextServiceDate: null,
      nextServiceMileage: null,
      status: "AVAILABLE",
      driver: null,
      fuelLogs: [],
      tripLogs: []
    }),
    create: jest.fn().mockResolvedValue({ id: "vehicle-1" }),
    update: jest.fn(),
    delete: jest.fn()
  },
  driver: {
    findFirst: jest.fn(),
    findUnique: jest.fn()
  },
  tripLog: {
    findMany: jest.fn()
  },
  fuelLog: {
    findMany: jest.fn()
  },
  vehicleMeterLog: {
    findMany: jest.fn()
  },
  vehicleGateMovement: {
    findMany: jest.fn()
  },
  gpsLocation: {
    findMany: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  },
  $transaction: jest.fn(async (ops: any) => (Array.isArray(ops) ? Promise.all(ops) : ops))
});

describe("VehiclesService tenant isolation", () => {
  it("findAll scopes vehicle queries by tenant context", async () => {
    const prisma = createPrismaMock();
    const service = new VehiclesService(prisma as any, { updateGps: jest.fn() } as any, {} as any);

    await requestContext.run(
      {
        actorId: "actor-1",
        actorEmail: "actor@example.com",
        actorRole: "ADMIN",
        tenantId: "tenant-a",
        module: "vehicles",
        ipAddress: null,
        userAgent: null,
        requestPath: "/vehicles"
      },
      () => service.findAll()
    );

    expect(prisma.vehicle.count).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-a" } }));
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-a" } }));
  });

  it("findOne applies tenant filter for tenant context", async () => {
    const prisma = createPrismaMock();
    const service = new VehiclesService(prisma as any, { updateGps: jest.fn() } as any, {} as any);

    await requestContext.run(
      {
        actorId: "actor-1",
        actorEmail: "actor@example.com",
        actorRole: "ADMIN",
        tenantId: "tenant-a",
        module: "vehicles",
        ipAddress: null,
        userAgent: null,
        requestPath: "/vehicles/vehicle-1"
      },
      () => service.findOne("vehicle-1")
    );

    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vehicle-1", tenantId: "tenant-a" }
      })
    );
  });

  it("remove verifies tenant ownership before delete", async () => {
    const prisma = createPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue(null);
    const service = new VehiclesService(prisma as any, { updateGps: jest.fn() } as any, {} as any);

    await expect(
      requestContext.run(
        {
          actorId: "actor-1",
          actorEmail: "actor@example.com",
          actorRole: "ADMIN",
          tenantId: "tenant-a",
          module: "vehicles",
          ipAddress: null,
          userAgent: null,
          requestPath: "/vehicles/vehicle-1"
        },
        () => service.remove("vehicle-1")
      )
    ).rejects.toThrow("Vehicle not found");

    expect(prisma.vehicle.delete).not.toHaveBeenCalled();
  });
});
