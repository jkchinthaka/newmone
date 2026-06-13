import {
  canManageFacilities,
  canViewFacilities,
  canViewFacilityReports,
  FACILITY_CREATE_PAYLOAD_KEYS,
  FACILITY_MANAGE_FALLBACK_ROLES,
  FACILITY_VIEW_FALLBACK_ROLES,
  facilityCreatePayloadIncludesTenantId
} from "../../web/lib/facilities";

describe("facilities web role helpers", () => {
  it("allows view access via facilities.view permission", () => {
    expect(canViewFacilities("TECHNICIAN", ["facilities.view"])).toBe(true);
    expect(canManageFacilities("TECHNICIAN", ["facilities.view"])).toBe(false);
  });

  it("allows manage access via facilities.manage permission", () => {
    expect(canManageFacilities("BUILDING_SUPERVISOR", ["facilities.manage"])).toBe(true);
  });

  it("maps facility roles to view access without explicit permissions", () => {
    for (const role of FACILITY_VIEW_FALLBACK_ROLES) {
      expect(canViewFacilities(role, [])).toBe(true);
    }
  });

  it("keeps BUILDING_SUPERVISOR view-only unless manage permission is granted", () => {
    expect(canViewFacilities("BUILDING_SUPERVISOR", [])).toBe(true);
    expect(canManageFacilities("BUILDING_SUPERVISOR", [])).toBe(false);
  });

  it("allows FACILITY_MANAGER to manage hierarchy by role fallback", () => {
    expect(canManageFacilities("FACILITY_MANAGER", [])).toBe(true);
  });

  it("does not grant manage access to CLEANER by default", () => {
    expect(canViewFacilities("CLEANER", [])).toBe(false);
    expect(canManageFacilities("CLEANER", [])).toBe(false);
  });

  it("blocks drivers from facility reports while allowing viewers", () => {
    expect(canViewFacilityReports("VIEWER", [])).toBe(true);
    expect(canViewFacilityReports("DRIVER", [])).toBe(false);
  });
});

describe("facilities API client payload safety", () => {
  it("documents allowed create payload keys without tenantId", () => {
    expect(FACILITY_CREATE_PAYLOAD_KEYS).not.toContain("tenantId");
  });

  it("detects tenantId in create payloads for regression guard", () => {
    expect(facilityCreatePayloadIncludesTenantId({ name: "HQ", code: "HQ" })).toBe(false);
    expect(facilityCreatePayloadIncludesTenantId({ name: "HQ", tenantId: "abc" })).toBe(true);
  });
});
