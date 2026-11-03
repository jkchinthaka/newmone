import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relative: string) => readFileSync(path.resolve(__dirname, "../..", relative), "utf8");

test("Cancel is offered only to roles the API lets cancel, through the governed status change", () => {
  const page = read("components/work-orders/work-orders-page.tsx");
  assert.match(page, /const CANCEL_ROLES = new Set\(\["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"\]\);/);
  assert.match(page, /onDelete=\{canCancelWorkOrders \? /);
  assert.match(page, /status: "CANCELLED",\s*cancelReason: reason\.trim\(\),\s*expectedVersion: workOrder\.version/);
  assert.match(read("components/work-orders/work-order-table.tsx"), /\{onDelete && getValidWorkOrderActions/);
  assert.match(read("components/work-orders/work-order-card.tsx"), /\{onDelete \? \(/);
});

test("meter readings and bills default to today's date in Sri Lanka, not UTC", () => {
  for (const file of ["components/utilities/utilities-dashboard.tsx", "components/utilities/meter-readings-page.tsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/, file);
    assert.match(source, /colomboTodayYmd\(\)/, file);
  }
});

test("approval screens no longer present multi-level chains", () => {
  assert.doesNotMatch(read("app/(dashboard)/admin/approval-rules/page.tsx"), /multi-level/i);
  assert.doesNotMatch(read("app/(dashboard)/approvals/[id]/page.tsx"), /Level \{String\(step\.level\)\}/);
});
