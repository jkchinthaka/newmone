import { requestContext, type AuditRequestContext } from "../src/common/context/request-context";
import { VehiclesService } from "../src/modules/vehicles/vehicles.service";

function context(tenantId: string): AuditRequestContext {
  return {
    actorId: "user-1",
    actorEmail: null,
    actorRole: "SECURITY_OFFICER",
    tenantId,
    module: null,
    ipAddress: null,
    userAgent: null,
    requestPath: null
  };
}

describe("gate check history", () => {
  const prisma = {
    vehicle: {
      findFirst: jest.fn().mockResolvedValue({
        id: "veh-1",
        status: "AVAILABLE",
        gateBlocked: false,
        currentMileage: 10,
        nextServiceDate: null,
        nextServiceMileage: null,
        serviceStatus: null
      })
    },
    workOrder: { findMany: jest.fn().mockResolvedValue([]) },
    gateCheck: {
      create: jest.fn().mockResolvedValue({ id: "check-1" }),
      findMany: jest.fn().mockResolvedValue([])
    }
  };
  const compliance = { evaluateForGateOut: jest.fn().mockResolvedValue([]) };
  const service = new VehiclesService(prisma as never, {} as never, compliance as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.vehicle.findFirst.mockResolvedValue({
      id: "veh-1",
      status: "AVAILABLE",
      gateBlocked: false,
      currentMileage: 10,
      nextServiceDate: null,
      nextServiceMileage: null,
      serviceStatus: null
    });
    prisma.workOrder.findMany.mockResolvedValue([]);
    compliance.evaluateForGateOut.mockResolvedValue([]);
    prisma.gateCheck.create.mockResolvedValue({ id: "check-1" });
    prisma.gateCheck.findMany.mockResolvedValue([]);
  });

  it("records the check for the caller's tenant and does not list another tenant", async () => {
    await requestContext.run(context("tenant-a"), () => service.gateBlockReasons("veh-1"));
    expect(prisma.gateCheck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-a", vehicleId: "veh-1", result: "READY" })
      })
    );

    await requestContext.run(context("tenant-b"), () => service.listGateChecks("2026-10-22"));
    expect(prisma.gateCheck.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-b" })
      })
    );
    const where = prisma.gateCheck.findMany.mock.calls.at(-1)?.[0].where;
    expect(JSON.stringify(where)).not.toContain("tenant-a");
  });
});
