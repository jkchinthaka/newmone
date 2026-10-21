import assert from "node:assert/strict";
import test from "node:test";

import { canVerifyWorkOrder, canVerifyWorkOrderRole, getLifecycleStageLabel } from "../work-order-governance";
import { erpReconciliationLabel } from "../erp-reconciliation-label";

test("only manager and admin roles can verify work orders", () => {
  assert.equal(canVerifyWorkOrderRole("ADMIN"), true);
  assert.equal(canVerifyWorkOrderRole("MANAGER"), true);
  assert.equal(canVerifyWorkOrderRole("SUPER_ADMIN"), true);
  assert.equal(canVerifyWorkOrderRole("OPERATIONS_MANAGER"), true);
  assert.equal(canVerifyWorkOrderRole("ASSET_MANAGER"), true);
  assert.equal(canVerifyWorkOrderRole("SUPERVISOR"), false);
  assert.equal(canVerifyWorkOrderRole("TECHNICIAN"), false);
  assert.equal(canVerifyWorkOrderRole("MECHANIC"), false);
  assert.equal(canVerifyWorkOrderRole(null), false);
});

test("SV-19 Verify is shown only to the shared verifier roles", () => {
  assert.equal(canVerifyWorkOrder({ role: "SUPERVISOR", permissions: ["work_orders.verify"] }), false);
  assert.equal(canVerifyWorkOrder({ role: "SUPERVISOR", permissions: ["work_orders.manage"] }), false);
  assert.equal(canVerifyWorkOrder({ role: "SUPERVISOR", permissions: [] }), false);
  assert.equal(canVerifyWorkOrder({ role: "MANAGER", permissions: [] }), true);
  assert.equal(canVerifyWorkOrder({ role: "TECHNICIAN", permissions: ["work_orders.verify"] }), false);
  assert.equal(getLifecycleStageLabel("VERIFIED"), "Verified — ready to close");
  assert.notEqual(getLifecycleStageLabel("VERIFIED"), "Closed");
});

test("ST-27 pending ERP outbox is not labeled posted", () => {
  assert.equal(erpReconciliationLabel("PENDING"), "ERP reconciliation pending");
  assert.equal(erpReconciliationLabel(null), "ERP reconciliation pending");
  assert.equal(erpReconciliationLabel("POSTED"), "ERP posted");
});

test("verification labels do not call pending or rework work closed", () => {
  assert.equal(getLifecycleStageLabel("TECHNICIAN_COMPLETED"), "Technician completed — awaiting supervisor");
  assert.equal(getLifecycleStageLabel("VERIFIED"), "Verified — ready to close");
  assert.equal(getLifecycleStageLabel("REWORK_REQUIRED"), "Rework required");
  assert.equal(getLifecycleStageLabel("CLOSED"), "Closed");
  assert.equal(getLifecycleStageLabel("COMPLETED"), "Closed (legacy)");
});
