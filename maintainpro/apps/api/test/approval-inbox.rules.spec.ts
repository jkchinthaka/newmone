import { ConflictException, ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import {
  ageLabel,
  assertAmountWithinRole,
  assertExpectedVersion,
  assertKindPermission,
  assertNotOwnRequest,
  assertSameBulkKind,
  inboxTab,
  resetApprovalIdempotency,
  slaTone,
  withApprovalIdempotency
} from "../src/modules/approvals/approval-inbox.rules";

describe("approval inbox rules", () => {
  afterEach(() => resetApprovalIdempotency());

  it("maps only the approval types that exist onto inbox tabs", () => {
    expect(inboxTab({ kind: "approval", processType: "CRITICAL_WORK_ORDER" })).toBe("work_orders");
    expect(inboxTab({ kind: "approval", processType: "ASSET_RETIREMENT" })).toBe("requests");
    expect(inboxTab({ kind: "part" })).toBe("parts");
    expect(inboxTab({ kind: "vendor_quotation" })).toBe("vendor_quotations");
    expect(inboxTab({ kind: "vendor_invoice" })).toBe("vendor_invoices");
    expect(inboxTab({ kind: "approval", status: "EMERGENCY_OVERRIDE_PENDING_REVIEW" })).toBe("emergency");
  });

  it("blocks approving your own request", () => {
    expect(() => assertNotOwnRequest("user-1", "user-1")).toThrow(ForbiddenException);
    expect(() => assertNotOwnRequest("user-2", "user-1")).not.toThrow();
  });

  it("enforces the role amount limit and the type permission", () => {
    expect(() => assertAmountWithinRole(RoleName.SUPERVISOR, 500_000)).toThrow(ForbiddenException);
    expect(() => assertAmountWithinRole(RoleName.ADMIN, 500_000)).not.toThrow();
    expect(() => assertKindPermission({ permissions: ["part_requests.approve_operational"] }, "part", "FINANCE")).toThrow(
      ForbiddenException
    );
    expect(() => assertKindPermission({ permissions: ["approvals.decide"] }, "vendor_invoice")).not.toThrow();
  });

  it("returns 409 when the version is missing or stale", () => {
    expect(() => assertExpectedVersion(10, 11)).toThrow(ConflictException);
    expect(() => assertExpectedVersion(10, undefined)).toThrow(/Refresh/);
    expect(() => assertExpectedVersion(10, 10)).not.toThrow();
  });

  it("approves once for the same idempotency key and rejects a different payload", async () => {
    let calls = 0;
    const first = await withApprovalIdempotency("key-1", "approve", async () => {
      calls += 1;
      return { ok: true };
    });
    const second = await withApprovalIdempotency("key-1", "approve", async () => {
      calls += 1;
      return { ok: false };
    });
    expect(first).toEqual(second);
    expect(calls).toBe(1);
    await expect(withApprovalIdempotency("key-1", "reject", async () => ({ ok: true }))).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("rejects mixed bulk types and colours SLA age", () => {
    expect(() => assertSameBulkKind(["part", "vendor_invoice"])).toThrow(/one type/);
    const start = new Date("2026-10-14T00:00:00.000Z");
    expect(slaTone(start, new Date("2026-10-15T00:00:00.000Z"), new Date("2026-10-16T00:00:00.000Z").getTime())).toBe("red");
    expect(ageLabel(new Date(Date.now() - 3 * 60 * 60 * 1000))).toBe("3h");
  });
});
