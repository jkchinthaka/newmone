import { POStatus } from "@prisma/client";

import { shouldPromotePoStatusToOrdered } from "../src/modules/inventory/purchase-order-status.util";

describe("purchase order ERP status promotion", () => {
  it("promotes PENDING to ORDERED", () => {
    expect(shouldPromotePoStatusToOrdered(POStatus.PENDING)).toBe(true);
  });

  it("promotes blank legacy status to ORDERED", () => {
    expect(shouldPromotePoStatusToOrdered("")).toBe(true);
    expect(shouldPromotePoStatusToOrdered(null)).toBe(true);
    expect(shouldPromotePoStatusToOrdered(undefined)).toBe(true);
  });

  it("does not demote already ordered/received statuses", () => {
    expect(shouldPromotePoStatusToOrdered(POStatus.ORDERED)).toBe(false);
    expect(shouldPromotePoStatusToOrdered(POStatus.PARTIALLY_RECEIVED)).toBe(false);
    expect(shouldPromotePoStatusToOrdered(POStatus.RECEIVED)).toBe(false);
    expect(shouldPromotePoStatusToOrdered(POStatus.CANCELLED)).toBe(false);
  });
});
