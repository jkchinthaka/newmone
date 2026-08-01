#!/usr/bin/env node
/**
 * Logout/CSRF contract selftests (no secrets).
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const { AUTH_LOGOUT_SUCCESS_HTTP_STATUS } = require("../lib/auth-logout-status-contract.cjs");

let failed = 0;
function check(id, ok, detail) {
  if (ok) console.log(`PASS ${id}: ${detail}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${detail}`);
  }
}

check(
  "LOGOUT-STATUS-001",
  AUTH_LOGOUT_SUCCESS_HTTP_STATUS === 200,
  "Canonical logout success status is exactly 200"
);

const controller = readFileSync(
  path.join(maintainproRoot, "apps/api/src/modules/auth/auth.controller.ts"),
  "utf8"
);
check(
  "LOGOUT-STATUS-EXPLICIT",
  /@HttpCode\(AUTH_LOGOUT_SUCCESS_HTTP_STATUS\)/.test(controller) &&
    /@Post\("logout"\)/.test(controller),
  "Logout endpoint declares explicit HttpCode"
);

const bffAuth = readFileSync(path.join(maintainproRoot, "apps/web/lib/bff-auth.ts"), "utf8");
check(
  "LOGOUT-CSRF-001",
  !/path:\s*["']auth\/logout["']/.test(bffAuth),
  "Logout is not in CSRF exemption registry"
);

const authSpec = readFileSync(path.join(maintainproRoot, "apps/web/e2e-real/auth.spec.ts"), "utf8");
check(
  "AUTH-011-CTX",
  authSpec.includes("logoutBrowserSession") && !/E2E-AUTH-011[\s\S]{0,400}\{\s*page,\s*request\s*\}/.test(authSpec),
  "AUTH-011 uses browser-session logout helper"
);

const csrfSpec = readFileSync(path.join(maintainproRoot, "apps/web/e2e-real/csrf.spec.ts"), "utf8");
check(
  "CSRF-003-EXACT",
  /E2E-CSRF-003[\s\S]{0,500}toBe\(201\)/.test(csrfSpec) &&
    !/E2E-CSRF-003[\s\S]{0,500}\[200,\s*201,\s*400/.test(csrfSpec),
  "CSRF-003 asserts exact mutation success status"
);

check(
  "HELPER-PRESENT",
  existsSync(path.join(maintainproRoot, "apps/web/e2e-real/helpers/browser-session.ts")),
  "browser-session helper exists"
);

if (failed) {
  console.error(`logout-csrf-contract.selftest: ${failed} failed`);
  process.exit(1);
}
console.log("logout-csrf-contract.selftest: all passed");