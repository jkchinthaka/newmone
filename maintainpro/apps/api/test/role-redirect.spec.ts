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

  it("maps technician to work orders when my-jobs route is unavailable", () => {
    expect(getPostLoginRedirect({ role: { name: "TECHNICIAN" } })).toBe("/work-orders");
  });

  it("maps cleaner to cleaning when my-tasks route is unavailable", () => {
    expect(getPostLoginRedirect({ role: { name: "CLEANER" } })).toBe("/cleaning");
  });

  it("maps inventory keeper to inventory", () => {
    expect(getPostLoginRedirect({ role: { name: "INVENTORY_KEEPER" } })).toBe("/inventory");
  });

  it("maps super admin to admin console when admin route is available", () => {
    expect(getPostLoginRedirect({ role: { name: "SUPER_ADMIN" } })).toBe("/admin");
  });

  it("maps admin to dashboard", () => {
    expect(getPostLoginRedirect({ role: { name: "ADMIN" } })).toBe("/dashboard");
  });

  it("falls back to dashboard for unknown roles", () => {
    expect(getPostLoginRedirect({ role: { name: "UNKNOWN_ROLE" } })).toBe(
      DEFAULT_POST_LOGIN_REDIRECT
    );
  });

  it("falls back to dashboard when role is missing", () => {
    expect(getPostLoginRedirect({})).toBe(DEFAULT_POST_LOGIN_REDIRECT);
    expect(getPostLoginRedirect(null)).toBe(DEFAULT_POST_LOGIN_REDIRECT);
  });

  it("never resolves to legacy /home", () => {
    expect(getPostLoginRedirect({ role: { name: "ADMIN" } })).not.toBe(LEGACY_FMS_HOME_PATH);
    expect(getPostLoginRedirect({ role: { name: "TECHNICIAN" } })).not.toBe(LEGACY_FMS_HOME_PATH);
    expect(resolvePostLoginPath(["/home", DEFAULT_POST_LOGIN_REDIRECT])).toBe(
      DEFAULT_POST_LOGIN_REDIRECT
    );
  });
});
