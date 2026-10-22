import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { queueNextControl } from "../batch-3-presentation";

const modal = readFileSync(path.resolve(__dirname, "../../components/work-orders/work-order-editor-modal.tsx"), "utf8");
const page = readFileSync(path.resolve(__dirname, "../../components/work-orders/work-orders-page.tsx"), "utf8");

test("work order drawer footer shows the same next step as the list row", () => {
  assert.match(modal, /queueNextControl\(\{\s*status: workOrder\.status,\s*role: actorRole,\s*approvalStatus: workOrder\.approvalStatus/);
  assert.match(modal, /onClick=\{\(\) => onPrimaryAction\(workOrder, next\.actionId\)\}/);
  assert.match(page, /actorRole=\{currentUser\.role\}/);
  assert.match(page, /handleQueueAction\(workOrder, actionId\);/);
});

test("next step per role and status", () => {
  assert.deepEqual(queueNextControl({ status: "OPEN", role: "MANAGER", approvalStatus: "APPROVED" }), {
    kind: "action",
    actionId: "assign",
    label: "Assign technician"
  });
  assert.equal(queueNextControl({ status: "ASSIGNED", role: "TECHNICIAN" }).kind, "action");
  assert.equal(queueNextControl({ status: "IN_PROGRESS", role: "TECHNICIAN" }).kind, "action");
  assert.equal(queueNextControl({ status: "TECHNICIAN_COMPLETED", role: "ADMIN" }).kind, "action");
  assert.equal(queueNextControl({ status: "OPEN", role: "TECHNICIAN" }).kind, "view");
});
