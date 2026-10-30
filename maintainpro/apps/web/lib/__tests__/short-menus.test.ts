import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canAccessNavigationPath, getNavigationGroups, getVisibleNavigationItems } from "../navigation";

const menu = (role: string) => getNavigationGroups(role, { permissions: [] }).flatMap((group) => group.items.map((item) => item.label));

describe("short side menus", () => {
  it("shows one Jobs entry instead of the job lanes and history", () => {
    const admin = menu("ADMIN");
    assert.ok(admin.includes("Jobs"));
    for (const label of ["Machinery Jobs", "Service Jobs", "Vehicle Jobs", "Job History", "All Jobs"]) assert.ok(!admin.includes(label), label);
  });

  it("keeps admin tools in Admin Console instead of the menu", () => {
    const admin = menu("ADMIN");
    for (const label of ["Add Assets", "Add Vehicle", "Assign QR Tags", "ERP Sync", "ERP Part Codes"]) assert.ok(!admin.includes(label), label);
    assert.ok(admin.includes("Admin Console"));
    assert.ok(menu("INVENTORY_KEEPER").includes("ERP Part Codes"));
    assert.ok(menu("ADMIN").length <= 22, `admin menu has ${menu("ADMIN").length} items`);
  });

  it("gives technicians a short menu without the full lists", () => {
    const technician = menu("TECHNICIAN");
    assert.ok(technician.includes("My Jobs"));
    for (const label of ["Jobs", "Machines & Equipment", "Vehicles", "Scheduled Service", "Job History"]) assert.ok(!technician.includes(label), label);
    assert.ok(technician.length <= 7, technician.join(", "));
  });

  it("hidden menu items still open (links, tabs, search)", () => {
    assert.ok(getVisibleNavigationItems("ADMIN").some((item) => item.id === "machinery-jobs"));
    assert.equal(canAccessNavigationPath("/maintenance/jobs/machinery", "ADMIN"), true);
    assert.equal(canAccessNavigationPath("/admin/assets/new", "ADMIN"), true);
    assert.equal(canAccessNavigationPath("/assets", "TECHNICIAN"), true);
  });
});
