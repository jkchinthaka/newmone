import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { WorkOrderStatus } from "@prisma/client";

import { assertCostSnapshotValues } from "../src/common/utils/cost-snapshot-values";
import { assertClosedRecordContentEditable } from "../src/common/utils/work-order-governance";
import {
  assertSuppliedTechnicianId,
  assertSuppliedWorkOrderStatus
} from "../src/common/utils/work-order-validation";
import { docsJsonAllowed, healthBodyForEnvironment, minimalLiveness } from "../src/bootstrap/production-surface";
import { whitelistPmPlanPatch } from "../src/modules/planning/pm-plan-revise";
import { roleCanAccessQueue } from "../src/common/utils/work-order-queues";
import { assertRequestWithinVerifiedStock } from "../src/modules/inventory/verified-stock-availability";
import { roleCanPartRequest, stagePartReturn } from "../src/modules/work-orders/part-request-access";
import { PART_REQUEST_VIEW_ROLES } from "../src/modules/work-orders/part-request-access";

describe("tier 1 defect rules", () => {
  it("QA-FRESH-MAINT-045 keeps production health minimal and disables unauthenticated docs", () => {
    expect(healthBodyForEnvironment(true, { database: { latencyMs: 12 } })).toEqual(minimalLiveness());
    expect(minimalLiveness()).toEqual({ status: "ok" });
    expect(docsJsonAllowed(true, false)).toBe(false);
    expect(docsJsonAllowed(true, true)).toBe(true);
    expect(healthBodyForEnvironment(false, { database: { status: "healthy" } })).toEqual({
      database: { status: "healthy" }
    });
  });

  it("QA-FRESH-MAINT-005 and 037 reject unknown and protected PM revise fields", () => {
    expect(whitelistPmPlanPatch({ name: "Pump PM" })).toEqual({ name: "Pump PM" });
    expect(() => whitelistPmPlanPatch({ tenantId: "other" })).toThrow(BadRequestException);
    expect(() => whitelistPmPlanPatch({ notAField: true })).toThrow(/Unknown or protected field/);
  });

  it("QA-FRESH-MAINT-014 blocks content edits on closed and cancelled work orders", () => {
    expect(() => assertClosedRecordContentEditable(WorkOrderStatus.CLOSED)).toThrow(ForbiddenException);
    expect(() => assertClosedRecordContentEditable(WorkOrderStatus.CANCELLED)).toThrow(ForbiddenException);
    expect(() =>
      assertClosedRecordContentEditable(WorkOrderStatus.CLOSED, {
        overrideReason: "verifier correction",
        actorRole: "ADMIN"
      })
    ).not.toThrow();
  });

  it("QA-FRESH-MAINT-013 and 051 reject a blank status and a bad technician id", () => {
    expect(() => assertSuppliedWorkOrderStatus("NOT_A_STATUS")).toThrow(/Invalid status/);
    expect(() => assertSuppliedTechnicianId("")).toThrow(/Invalid technicianId/);
    expect(() => assertSuppliedTechnicianId("bad id")).toThrow(BadRequestException);
    expect(() => assertSuppliedWorkOrderStatus(WorkOrderStatus.OPEN)).not.toThrow();
  });

  it("QA-FRESH-MAINT-030 rejects an invalid cost snapshot value", () => {
    expect(() => assertCostSnapshotValues({ partsCost: -1 })).toThrow(BadRequestException);
    expect(() => assertCostSnapshotValues({ transportCost: "nope" })).toThrow(/transportCost/);
    expect(() => assertCostSnapshotValues({ partsCost: 10 })).not.toThrow();
  });

  it("QA-FRESH-MAINT-027 keeps part-request roles aligned and stages a return for confirmation", () => {
    expect(roleCanPartRequest("INVENTORY_KEEPER", "reject")).toBe(false);
    expect(roleCanPartRequest("INVENTORY_KEEPER", "issue")).toBe(true);
    expect(roleCanPartRequest("INVENTORY_KEEPER", "confirm_return")).toBe(true);
    expect(roleCanPartRequest("MANAGER", "create")).toBe(true);
    expect(roleCanPartRequest("TECHNICIAN", "approve_finance")).toBe(false);
    expect(PART_REQUEST_VIEW_ROLES).toContain("SUPERVISOR");
    expect(stagePartReturn({ pendingReturnQuantity: 1, returnedQuantity: 2 }, 3)).toEqual({
      pendingReturnQuantity: 4,
      returnedQuantity: 2
    });
  });

  it("QA-FRESH-MAINT-038 rejects a part request above verified stock and allows a request when no snapshot exists", async () => {
    const verifiedAt = new Date("2026-10-01T00:00:00.000Z");
    const missing = {
      warehouse: { findFirst: async () => null, findMany: async () => [] },
      warehouseItemBalance: { findFirst: async () => null },
      domainEventOutbox: { findMany: async () => [] }
    };
    await expect(
      assertRequestWithinVerifiedStock(missing as never, { tenantId: "t", partId: "p", quantity: 2 })
    ).resolves.toBeNull();
    const short = {
      warehouse: {
        findFirst: async () => null,
        findMany: async () => [{ id: "w", erpWarehouseCode: "E", lastErpValidatedAt: verifiedAt, isDefault: true }]
      },
      warehouseItemBalance: { findFirst: async () => ({ id: "b", onHand: 1, reserved: 0, available: 1 }) },
      domainEventOutbox: { findMany: async () => [] }
    };
    await expect(
      assertRequestWithinVerifiedStock(short as never, { tenantId: "t", partId: "p", quantity: 5 })
    ).rejects.toThrow(/Available: 1, Requested: 5/);
  });

  it("removes SECURITY_OFFICER from queue access so the decorator and the service agree", () => {
    expect(roleCanAccessQueue("SECURITY_OFFICER", "action-required")).toBe(false);
  });
});
