import { RoleName } from "@prisma/client";

import {
  BUILDING_SUPERVISOR_PERMISSIONS,
  FACILITY_HIERARCHY_MODELS,
  FACILITY_MANAGER_PERMISSIONS,
  FACILITY_PERMISSION_KEYS,
  FACILITY_ROLE_NAMES
} from "../src/database/facility-seed.constants";

describe("Building schema and facility seed alignment", () => {
  it("includes FACILITY_MANAGER and BUILDING_SUPERVISOR in Prisma RoleName enum", () => {
    const roleNames = Object.values(RoleName);

    for (const roleName of FACILITY_ROLE_NAMES) {
      expect(roleNames).toContain(roleName);
    }
  });

  it("defines facility permission keys for future module RBAC", () => {
    expect(FACILITY_PERMISSION_KEYS).toEqual([
      "facilities.view",
      "facilities.manage",
      "facility_issues.view",
      "facility_issues.report",
      "facility_issues.manage",
      "facility_inspections.view",
      "facility_inspections.manage"
    ]);
  });

  it("assigns conservative facility permissions to FACILITY_MANAGER and BUILDING_SUPERVISOR", () => {
    expect(FACILITY_MANAGER_PERMISSIONS).toEqual(
      expect.arrayContaining([...FACILITY_PERMISSION_KEYS, "cleaning.report_issue"])
    );
    expect(BUILDING_SUPERVISOR_PERMISSIONS).toEqual(
      expect.arrayContaining([
        "facilities.view",
        "facility_issues.view",
        "facility_issues.report",
        "facility_issues.manage",
        "facility_inspections.view",
        "facility_inspections.manage"
      ])
    );
    expect(FACILITY_MANAGER_PERMISSIONS).toContain("facilities.manage");
    expect(BUILDING_SUPERVISOR_PERMISSIONS).not.toContain("facilities.manage");
    expect(BUILDING_SUPERVISOR_PERMISSIONS).not.toContain("users.view");
  });

  it("documents the spatial hierarchy models added in BUILD-002", () => {
    expect(FACILITY_HIERARCHY_MODELS).toEqual(["Property", "Building", "Floor", "Room"]);
  });
});
