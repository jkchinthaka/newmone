import {
  DEFAULT_POST_LOGIN_REDIRECT,
  extractRoleName,
  getPostLoginRedirect,
  LEGACY_FMS_HOME_PATH,
  resolvePostLoginPath
} from "../../web/lib/role-redirect";

describe("role-redirect helper", () => {
  it("extracts role name from nested login user payload", () => {
    expect(
      extractRoleName({
        role: { name: "TECHNICIAN" }
      })
    ).toBe("TECHNICIAN");
  });

  it("maps technician to action center first", () => {
    expect(getPostLoginRedirect({ role: { name: "TECHNICIAN" } })).toBe("/action-center");
  });

  it("maps cleaner to action center first", () => {
    expect(getPostLoginRedirect({ role: { name: "CLEANER" } })).toBe("/action-center");
  });

  it("maps inventory keeper to action center first", () => {
    expect(getPostLoginRedirect({ role: { name: "INVENTORY_KEEPER" } })).toBe("/action-center");
  });

  it("maps super admin to action center first", () => {
    expect(getPostLoginRedirect({ role: { name: "SUPER_ADMIN" } })).toBe("/action-center");
  });

  it("maps admin to action center first", () => {
    expect(getPostLoginRedirect({ role: { name: "ADMIN" } })).toBe("/action-center");
  });

  it("falls back to action center for unknown roles", () => {
    expect(getPostLoginRedirect({ role: { name: "UNKNOWN_ROLE" } })).toBe(
      DEFAULT_POST_LOGIN_REDIRECT
    );
  });

  it("falls back to action center when role is missing", () => {
    expect(getPostLoginRedirect({})).toBe(DEFAULT_POST_LOGIN_REDIRECT);
    expect(getPostLoginRedirect(null)).toBe(DEFAULT_POST_LOGIN_REDIRECT);
  });

  it("maps facility manager to action center first", () => {
    expect(getPostLoginRedirect({ role: { name: "FACILITY_MANAGER" } })).toBe("/action-center");
    expect(getPostLoginRedirect({ role: { name: "BUILDING_SUPERVISOR" } })).toBe("/action-center");
  });

  it("never resolves to legacy /home", () => {
    expect(getPostLoginRedirect({ role: { name: "ADMIN" } })).not.toBe(LEGACY_FMS_HOME_PATH);
    expect(getPostLoginRedirect({ role: { name: "TECHNICIAN" } })).not.toBe(LEGACY_FMS_HOME_PATH);
    expect(resolvePostLoginPath(["/home", DEFAULT_POST_LOGIN_REDIRECT])).toBe(
      DEFAULT_POST_LOGIN_REDIRECT
    );
  });
});
