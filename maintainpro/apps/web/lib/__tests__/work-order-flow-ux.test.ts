import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { primaryWorkOrderAction } from "../work-order-next-action";

const read = (relative: string) => readFileSync(path.resolve(__dirname, "../..", relative), "utf8");
const page = read("components/work-orders/work-orders-page.tsx");
const table = read("components/work-orders/work-order-table.tsx");

test("a held job offers Resume to the technician", () => {
  assert.deepEqual(primaryWorkOrderAction({ status: "ON_HOLD", role: "TECHNICIAN" }), { id: "resume", label: "Resume job" });
  assert.match(page, /selected === "start" \|\| selected === "resume"/);
});

test("send back and reassignment ask for a reason first", () => {
  assert.match(page, /label: "What needs to be fixed\?"/);
  assert.match(page, /label: "Reason for the change"/);
  assert.doesNotMatch(page, /reason: "Sent back for rework"/);
});

test("close checks pending part returns before verifying, with a link to Parts", () => {
  assert.match(page, /selected === "close" \|\| selected === "verify-close"\) && !\(await partsReturnsSettled\(workOrder\)\)/);
  assert.match(page, /label: "Open Parts"/);
});

test("the creator does not get Approve & assign, and block reasons are visible text", () => {
  assert.match(table, /!\(currentUserId && workOrder\.createdById === currentUserId\)/);
  assert.doesNotMatch(table, /title=\{next\.disabledReason\}/);
  assert.match(table, /\{next\.disabledReason \? <span/);
});

test("Assign technician opens the assignment tab and the completion checklist can jump to tabs", () => {
  assert.match(page, /if \(selected === "assign"\) \{\s*openEditModal\(workOrder, "assignment"\);/);
  assert.match(page, /onOpenTab=\{\(tab\) => \{/);
});
