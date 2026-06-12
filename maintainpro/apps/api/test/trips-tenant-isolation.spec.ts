import { requestContext } from "../src/common/context/request-context";
import { TripsService } from "../src/modules/trips/trips.service";

const createPrismaMock = () => ({
  tripLog: {
    findMany: jest.fn().mockResolvedValue([])
  }
});

describe("TripsService tenant isolation", () => {
  it("scopes trip list by tenant vehicle for tenant users", async () => {
    const prisma = createPrismaMock();
    const service = new TripsService(prisma as any);

    await requestContext.run(
      {
        actorId: "user-1",
        actorEmail: "u@example.com",
        actorRole: "ADMIN",
        tenantId: "tenant-a",
        module: "trips",
        ipAddress: null,
        userAgent: null,
        requestPath: "/trips"
      },
      () => service.allTrips()
    );

    expect(prisma.tripLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicle: {
            is: {
              tenantId: "tenant-a"
            }
          }
        }
      })
    );
  });

  it("does not apply tenant filter for super admin context", async () => {
    const prisma = createPrismaMock();
    const service = new TripsService(prisma as any);

    await requestContext.run(
      {
        actorId: "admin-1",
        actorEmail: "admin@example.com",
        actorRole: "SUPER_ADMIN",
        tenantId: null,
        module: "trips",
        ipAddress: null,
        userAgent: null,
        requestPath: "/trips"
      },
      () => service.allTrips()
    );

    expect(prisma.tripLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});
