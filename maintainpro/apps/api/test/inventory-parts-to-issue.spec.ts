import "reflect-metadata";
import { RoleName } from "@prisma/client";

import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { InventoryController } from "../src/modules/inventory/inventory.controller";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { PART_REQUEST_ISSUE_ROLES } from "../src/modules/work-orders/part-request-access";

describe("GET /inventory/parts-to-issue", () => {
  const actor = { sub: "keeper-1", email: "k@x.com", role: RoleName.INVENTORY_KEEPER, tenantId: "tenant-a" };

  function build(rows: unknown[] = [], total = rows.length) {
    const prisma = {
      partRequest: {
        findMany: jest.fn().mockResolvedValue(rows),
        count: jest.fn().mockResolvedValue(total)
      }
    };
    const service = new InventoryService(prisma as never, { createNotification: jest.fn() } as never, {} as never);
    return { service, prisma };
  }

  it("is read-only for stores roles with part_requests.view", () => {
    const handler = InventoryController.prototype.partsToIssue;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([...PART_REQUEST_ISSUE_ROLES]);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toContain("INVENTORY_KEEPER");
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(["part_requests.view"]);
  });

  it("lists approved requests still to issue, scoped to the caller's tenant", async () => {
    const { service, prisma } = build([
      {
        id: "pr-1",
        status: "PARTIALLY_ISSUED",
        requestedQuantity: 5,
        approvedQuantity: 4,
        issuedQuantity: 1,
        createdAt: new Date("2026-10-20T08:00:00Z"),
        part: { id: "p-1", name: "Filter", partNumber: "F-1", availableQuantity: 7 },
        workOrder: { id: "wo-1", woNumber: "WO-2026-00001", title: "Pump leak", priority: "HIGH" },
        requestedBy: { firstName: "Nimal", lastName: "Perera" }
      }
    ]);

    const result = await service.partsToIssue(actor, 500);

    const args = prisma.partRequest.findMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe("tenant-a");
    expect(args.where.workOrder.tenantId).toBe("tenant-a");
    expect(args.where.status).toEqual({ in: ["APPROVED", "PARTIALLY_ISSUED"] });
    expect(args.take).toBe(50);
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: "pr-1", quantityToIssue: 3, requestedBy: "Nimal Perera" })
    );
    expect(result.items[0].workOrder.id).toBe("wo-1");
  });

  it("refuses a call without a tenant", async () => {
    const { service } = build();
    await expect(service.partsToIssue({ ...actor, tenantId: undefined as never })).rejects.toThrow();
  });
});
