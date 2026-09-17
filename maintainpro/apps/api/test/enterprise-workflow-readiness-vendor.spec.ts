import { canTransition } from "../src/modules/policies/state-machines";
import { WorkflowEngineService } from "../src/modules/workflow-engine/workflow-engine.service";
import { JobReadinessService } from "../src/modules/job-readiness/job-readiness.service";
import { NumberingService } from "../src/modules/numbering/numbering.service";
import { VendorPortalService } from "../src/modules/vendor-portal/vendor-portal.service";
import { WorkOrderStatus } from "@prisma/client";

describe("workflow engine", () => {
  it("rejects invalid code-machine transitions", async () => {
    const service = new WorkflowEngineService({} as never);
    await expect(
      service.assertTransition({
        tenantId: "t1",
        entityType: "WORK_ORDER",
        fromStatus: WorkOrderStatus.CLOSED,
        toStatus: WorkOrderStatus.IN_PROGRESS
      })
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: "INVALID_TRANSITION" }) });
  });

  it("allows valid OPEN → PLANNED via code machine", async () => {
    const decision = canTransition("WORK_ORDER", WorkOrderStatus.OPEN, WorkOrderStatus.PLANNED);
    expect(decision.allowed).toBe(true);
  });
});

describe("job readiness", () => {
  it("returns structured blockers not only NOT_READY", async () => {
    const reliability = {
      assertPermitReadyForStart: jest.fn().mockRejectedValue({
        response: { code: "SAFETY_BLOCK", reasons: ["No permit"] }
      }),
      assertLotoReadyForStart: jest.fn().mockResolvedValue({ required: false, reasons: [] })
    };
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          assetId: "a-1",
          approvalStatus: "PENDING",
          technicianId: null,
          assignees: [],
          parts: [],
          temporaryRepair: false,
          temporaryRepairExpiry: null
        })
      }
    } as never;
    const service = new JobReadinessService(prisma, reliability as never);
    const result = await service.evaluate(
      { sub: "u1", tenantId: "t1", role: "ADMIN" },
      "wo-1"
    );
    expect(result.status).toBe("NOT_READY");
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers.some((b) => b.code === "APPROVAL_REQUIRED")).toBe(true);
    expect(result.blockers.some((b) => b.code === "ASSIGNMENT_REQUIRED")).toBe(true);
    expect(result.blockers.some((b) => b.code === "PERMIT_REQUIRED")).toBe(true);
  });
});

describe("numbering sequences", () => {
  it("increments under transaction", async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          numberingSequence: {
            findUnique: jest.fn().mockResolvedValue({
              id: "seq-1",
              nextValue: 7,
              prefix: "WO-",
              padLength: 6
            }),
            create: jest.fn(),
            update
          }
        })
      )
    } as never;
    const service = new NumberingService(prisma);
    const next = await service.next({ sub: "u1", tenantId: "t1" }, "WORK_ORDER");
    expect(next).toBe("WO-000007");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nextValue: 8 } })
    );
  });
});

describe("vendor portal isolation", () => {
  it("denies jobs when user has no portal access", async () => {
    const prisma = {
      vendorPortalAccess: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as never;
    const service = new VendorPortalService(prisma);
    await expect(
      service.listAssignedJobs({ sub: "vendor-user", tenantId: "t1", role: "VENDOR" })
    ).rejects.toMatchObject({ message: expect.stringMatching(/No vendor portal access/i) });
  });

  it("scopes jobs to linked suppliers only", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      vendorPortalAccess: {
        findMany: jest.fn().mockResolvedValue([{ supplierId: "sup-1" }])
      },
      vendorRepairCase: { findMany }
    } as never;
    const service = new VendorPortalService(prisma);
    await service.listAssignedJobs({ sub: "vendor-user", tenantId: "t1", role: "VENDOR" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ supplierId: { in: ["sup-1"] } })
      })
    );
  });
});
