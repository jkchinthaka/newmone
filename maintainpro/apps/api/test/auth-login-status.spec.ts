import { readFileSync } from "node:fs";
import path from "node:path";

import { AUTH_LOGIN_SUCCESS_HTTP_STATUS } from "../src/modules/auth/auth-login-status.contract";

describe("AUTH-STATUS login HTTP contract", () => {
  const controllerSource = readFileSync(
    path.join(__dirname, "../src/modules/auth/auth.controller.ts"),
    "utf8"
  );
  const contractSource = readFileSync(
    path.join(__dirname, "../src/modules/auth/auth-login-status.contract.ts"),
    "utf8"
  );

  it("AUTH-STATUS-001: canonical success status is exactly 200", () => {
    expect(AUTH_LOGIN_SUCCESS_HTTP_STATUS).toBe(200);
    expect(contractSource).toMatch(/AUTH_LOGIN_SUCCESS_HTTP_STATUS\s*=\s*200/);
  });

  it("AUTH-STATUS-001b: login method has explicit HttpCode (not Nest POST default)", () => {
    expect(controllerSource).toMatch(/@Post\("login"\)/);
    expect(controllerSource).toMatch(/@HttpCode\(AUTH_LOGIN_SUCCESS_HTTP_STATUS\)/);
    expect(controllerSource).toMatch(/@ApiOkResponse\(/);
  });

  it("AUTH-STATUS-001c: login does not document Created/201 as success", () => {
    const loginBlock = controllerSource.split(/@Post\("login"\)/)[1]?.split(/@Post\(/)[0] ?? "";
    expect(loginBlock).not.toMatch(/ApiCreatedResponse/);
    expect(loginBlock).not.toMatch(/HttpStatus\.CREATED/);
    expect(loginBlock).not.toMatch(/@HttpCode\(\s*201\s*\)/);
  });
});