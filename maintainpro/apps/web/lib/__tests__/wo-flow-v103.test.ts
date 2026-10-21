import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { visibleLoginRoles } from "../visible-login-roles";
import { humanWorkOrderActionMessage } from "../work-order-action-messages";
import { primaryWorkOrderAction, secondaryWorkOrderActions, selectableWorkOrderStatuses } from "../work-order-next-action";

test("login role dropdown lists the six go-live roles and can repeat a role", () => {
  const roles = [
    { id: "1", name: "FINANCE" },
    { id: "2", name: "ADMIN" },
    { id: "3", name: "INVENTORY_KEEPER" },
    { id: "4", name: "TECHNICIAN" },
    { id: "5", name: "SECURITY_OFFICER" },
    { id: "6", name: "MANAGER" },
    { id: "7", name: "SUPER_ADMIN" },
    { id: "8", name: "DRIVER" }
  ];
  assert.deepEqual(
    visibleLoginRoles(roles).map((role) => role.name),
    ["ADMIN", "INVENTORY_KEEPER", "TECHNICIAN", "SECURITY_OFFICER", "MANAGER", "SUPER_ADMIN"]
  );
  assert.deepEqual(visibleLoginRoles(roles, "1").map((role) => role.id), ["1", "2", "3", "4", "5", "6", "7"]);
});

test("primary work order action follows status and role", () => {
  assert.equal(primaryWorkOrderAction({ status: "OPEN", role: "MANAGER", approvalStatus: "APPROVED" })?.label, "Assign technician");
  assert.equal(
    primaryWorkOrderAction({ status: "OPEN", role: "MANAGER", approvalStatus: "PENDING" })?.disabledReason,
    "Approve this work order before assigning a technician."
  );
  assert.equal(primaryWorkOrderAction({ status: "ASSIGNED", role: "TECHNICIAN" })?.label, "Start job");
  assert.equal(primaryWorkOrderAction({ status: "IN_PROGRESS", role: "TECHNICIAN" })?.label, "Mark complete");
  assert.equal(primaryWorkOrderAction({ status: "TECHNICIAN_COMPLETED", role: "MANAGER" })?.label, "Verify & close");
  assert.equal(primaryWorkOrderAction({ status: "REWORK_REQUIRED", role: "TECHNICIAN" })?.label, "Start job");
  assert.equal(primaryWorkOrderAction({ status: "ASSIGNED", role: "SECURITY_OFFICER" }), null);
  assert.equal(primaryWorkOrderAction({ status: "TECHNICIAN_COMPLETED", role: "TECHNICIAN" }), null);
  assert.equal(primaryWorkOrderAction({ status: "OPEN", role: "INVENTORY_KEEPER" }), null);
  assert.equal(secondaryWorkOrderActions({ status: "TECHNICIAN_COMPLETED", role: "MANAGER" })[0]?.label, "Send back");
  assert.equal(secondaryWorkOrderActions({ status: "TECHNICIAN_COMPLETED", role: "TECHNICIAN" }).length, 0);
});

test("legacy statuses stay out of filters", () => {
  assert.deepEqual(selectableWorkOrderStatuses(["OPEN", "COMPLETED", "OVERDUE", "CLOSED"]), ["OPEN", "CLOSED"]);
});

test("work order action errors use plain sentences", () => {
  assert.equal(
    humanWorkOrderActionMessage("Work order requires manager approval before execution"),
    "Approve this work order before starting the job."
  );
  assert.equal(
    humanWorkOrderActionMessage("Separation of duties violation: the completing technician cannot verify this work order."),
    "You cannot verify a job you completed."
  );
  assert.match(humanWorkOrderActionMessage("You already have WO-2026-0174 in progress."), /WO-2026-0174/);
});

test("many users can share one role", () => {
  const schema = readFileSync(new URL("../../../../prisma/schema.prisma", import.meta.url), "utf8");
  const user = schema.slice(schema.indexOf("model User {"), schema.indexOf("model TenantMembership {"));
  assert.equal(user.includes("roleId"), true);
  assert.equal(/@@unique\(\[roleId\]\)/.test(user), false);
  assert.equal(/@@unique\(\[tenantId, roleId\]\)/.test(user), false);
});
