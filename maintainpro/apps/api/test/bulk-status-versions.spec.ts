import { BadRequestException, ConflictException } from "@nestjs/common";
import { RoleName, WorkOrderStatus } from "@prisma/client";

import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

/** H-2: bulk status passes each row's version and reports a per-row outcome. */
describe("bulk status with per-row versions", () => {
  const manager = { sub: "mgr-1", email: "m@maintainpro.local", role: RoleName.MANAGER, tenantId: "tenant-a" };

  function build() {
    const service = new WorkOrdersService(
      { workOrder: { findFirst: jest.fn() } } as never,
      { createNotification: jest.fn() } as never,
      {} as never,
      {} as never,
      { addAssignee: jest.fn() } as never
    );
    const updateStatus = jest.spyOn(service, "updateStatus");
    return { service, updateStatus };
  }

  it("passes each row's expectedVersion and reports ok / conflict / error", async () => {
    const { service, updateStatus } = build();
    updateStatus.mockImplementation(async (id: string) => {
      if (id === "wo-2") throw new ConflictException("Work order was updated by someone else. Refresh and retry.");
      if (id === "wo-3") throw new BadRequestException("Cannot move from CLOSED to ON_HOLD");
      return {} as never;
    });

    const result = await service.bulkStatus(
      {
        items: [
          { id: "wo-1", expectedVersion: 3 },
          { id: "wo-2", expectedVersion: 5 },
          { id: "wo-3", expectedVersion: 1 }
        ],
        targetStatus: WorkOrderStatus.ON_HOLD,
        reason: "Waiting for parts"
      },
      manager
    );

    expect(updateStatus).toHaveBeenNthCalledWith(1, "wo-1", expect.objectContaining({ expectedVersion: 3 }), manager);
    expect(updateStatus).toHaveBeenNthCalledWith(2, "wo-2", expect.objectContaining({ expectedVersion: 5 }), manager);
    expect(result.results).toEqual([
      { id: "wo-1", outcome: "ok" },
      { id: "wo-2", outcome: "conflict", message: "Work order was updated by someone else. Refresh and retry." },
      { id: "wo-3", outcome: "error", message: "Cannot move from CLOSED to ON_HOLD" }
    ]);
    expect(result.success).toEqual(["wo-1"]);
    expect(result.failed.map((row) => row.workOrderId)).toEqual(["wo-2", "wo-3"]);
  });

  it("rejects a request without items", async () => {
    const { service, updateStatus } = build();
    await expect(
      service.bulkStatus({ items: [], targetStatus: WorkOrderStatus.ON_HOLD } as never, manager)
    ).rejects.toThrow("items with id and expectedVersion are required");
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("rejects the legacy id-only shape instead of failing every row", async () => {
    const { service, updateStatus } = build();
    await expect(
      service.bulkStatus({ workOrderIds: ["wo-1"], targetStatus: WorkOrderStatus.ON_HOLD } as never, manager)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("rejects an item without a numeric expectedVersion", async () => {
    const { service, updateStatus } = build();
    await expect(
      service.bulkStatus({ items: [{ id: "wo-1" }], targetStatus: WorkOrderStatus.ON_HOLD } as never, manager)
    ).rejects.toThrow("items with id and expectedVersion are required");
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
