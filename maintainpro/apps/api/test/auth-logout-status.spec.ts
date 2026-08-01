import { readFileSync } from "node:fs";
import path from "node:path";

import { AUTH_LOGOUT_SUCCESS_HTTP_STATUS } from "../src/modules/auth/auth-logout-status.contract";

describe("LOGOUT-API logout HTTP contract", () => {
  const controllerSource = readFileSync(
    path.join(__dirname, "../src/modules/auth/auth.controller.ts"),
    "utf8"
  );
  const bffAuthSource = readFileSync(
    path.join(__dirname, "../../web/lib/bff-auth.ts"),
    "utf8"
  );

  it("LOGOUT-API-001: canonical logout success status is exactly 200", () => {
    expect(AUTH_LOGOUT_SUCCESS_HTTP_STATUS).toBe(200);
    expect(controllerSource).toMatch(/@HttpCode\(AUTH_LOGOUT_SUCCESS_HTTP_STATUS\)/);
    expect(controllerSource).toMatch(/@ApiOkResponse\(/);
  });

  it("LOGOUT-CSRF-001: logout is not CSRF-exempt in BFF registry", () => {
    expect(bffAuthSource).not.toMatch(/path:\s*["']auth\/logout["']/);
  });

  it("LOGOUT-API-006: Nest logout still does not call res.cookie for session issue", () => {
    const logoutBlock = controllerSource.split(/@Post\("logout"\)/)[1]?.split(/@Post\(/)[0] ?? "";
    expect(logoutBlock).not.toMatch(/res\.cookie\s*\(/);
    expect(logoutBlock).toMatch(/clearAuthCookies/);
  });
});
