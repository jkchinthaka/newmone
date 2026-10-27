import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAuthorizedDestination } from "../navigation";
import { getPostLoginRedirect, safeInternalReturnPath } from "../role-redirect";

describe("authorized landing", () => {
  it("sends a technician to My Jobs", () => {
    assert.equal(getPostLoginRedirect("TECHNICIAN"), "/work-orders/my");
    assert.equal(getPostLoginRedirect("MECHANIC"), "/work-orders/my");
  });

  it("sends a storekeeper to inventory", () => {
    assert.equal(getPostLoginRedirect("STOREKEEPER"), "/inventory");
    assert.equal(getPostLoginRedirect("INVENTORY_KEEPER"), "/inventory");
  });

  it("sends a supervisor to the maintenance dashboard and a vendor to the portal", () => {
    assert.equal(getPostLoginRedirect("SUPERVISOR"), "/maintenance");
    assert.equal(getPostLoginRedirect("VENDOR"), "/vendor-portal");
    assert.equal(getPostLoginRedirect("ASSET_MANAGER"), "/assets");
  });

  it("sends maintenance managers to the maintenance dashboard", () => {
    assert.equal(getPostLoginRedirect("MAINTENANCE_SUPERVISOR"), "/maintenance");
    assert.equal(getPostLoginRedirect("MANAGER"), "/maintenance");
  });

  it("sends fleet managers to fleet and security officers to Requests", () => {
    assert.equal(getPostLoginRedirect("FLEET_MANAGER"), "/fleet");
    assert.equal(getPostLoginRedirect("SECURITY_OFFICER"), "/requests");
  });

  it("keeps an authorized return path", () => {
    assert.equal(
      resolveAuthorizedDestination({ role: "TECHNICIAN" }, "/work-orders/my?filter=overdue"),
      "/work-orders/my?filter=overdue"
    );
    assert.equal(resolveAuthorizedDestination({ role: "ADMIN" }, "/requests"), "/requests");
  });

  it("rejects an external return path and an unauthorized dashboard", () => {
    assert.equal(safeInternalReturnPath("https://evil.example"), null);
    assert.equal(safeInternalReturnPath("javascript:alert(1)"), null);
    assert.equal(safeInternalReturnPath("//evil.example"), null);
    assert.equal(resolveAuthorizedDestination({ role: "TECHNICIAN" }, "https://evil.example"), "/work-orders/my");
    assert.equal(resolveAuthorizedDestination({ role: "TECHNICIAN" }, "/admin"), "/work-orders/my");
    assert.equal(resolveAuthorizedDestination({ role: "STOREKEEPER" }, "/admin"), "/inventory");
    assert.equal(resolveAuthorizedDestination({ role: "FINANCE" }, "/maintenance"), "/reports");
  });

  it("sends a requester and an unmapped department role to their requests", () => {
    assert.equal(getPostLoginRedirect("REQUESTER"), "/requests");
    assert.equal(getPostLoginRedirect("SALES"), "/requests");
    assert.equal(getPostLoginRedirect("FINANCE"), "/reports");
    assert.equal(getPostLoginRedirect("MANAGER"), "/maintenance");
  });

  it("never lands on splash, action center, or login", () => {
    for (const role of ["ADMIN", "TECHNICIAN", "STOREKEEPER", "CLEANER", "SECURITY_OFFICER", "UNKNOWN_ROLE"]) {
      const landing = resolveAuthorizedDestination(role, "/splash");
      assert.equal(landing.includes("/splash"), false);
      assert.equal(landing.includes("/action-center"), false);
      assert.notEqual(landing, "/login");
      assert.equal(resolveAuthorizedDestination(role, "/action-center").includes("/action-center"), false);
    }
  });
});
