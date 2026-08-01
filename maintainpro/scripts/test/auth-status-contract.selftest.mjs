#!/usr/bin/env node
/**
 * AUTH-STATUS contract selftests — exact login success status only (no 200|201 ranges).
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const { AUTH_LOGIN_SUCCESS_HTTP_STATUS } = require("../lib/auth-login-status-contract.cjs");

let failed = 0;
function check(id, ok, detail) {
  if (ok) console.log(`PASS ${id}: ${detail}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${detail}`);
  }
}

check(
  "AUTH-STATUS-001",
  AUTH_LOGIN_SUCCESS_HTTP_STATUS === 200,
  "Canonical Nest login success status is exactly 200"
);

const controller = readFileSync(
  path.join(maintainproRoot, "apps/api/src/modules/auth/auth.controller.ts"),
  "utf8"
);
check(
  "AUTH-STATUS-EXPLICIT",
  /@HttpCode\(AUTH_LOGIN_SUCCESS_HTTP_STATUS\)/.test(controller) &&
    /@ApiOkResponse\(/.test(controller),
  "Login endpoint declares explicit HttpCode + ApiOkResponse"
);

const authSpec = readFileSync(
  path.join(maintainproRoot, "apps/web/e2e-real/auth.spec.ts"),
  "utf8"
);
const auth001 = authSpec.match(/E2E-AUTH-001[\s\S]{0,400}/)?.[0] ?? "";
check(
  "AUTH-STATUS-013",
  /toBe\(200\)/.test(auth001) && !/\[200,\s*201\]/.test(auth001),
  "E2E-AUTH-001 asserts exact 200 (no 200|201 range)"
);
check(
  "AUTH-STATUS-013b",
  !/expect\(\[200,\s*201\]\)\.toContain\(loginResponse\.status\(\)\)/.test(authSpec),
  "Real-stack auth suite has no broad login 200|201 assertion"
);

const diag = readFileSync(
  path.join(maintainproRoot, "scripts/e2e-auth-path-diagnostic.mjs"),
  "utf8"
);
check(
  "AUTH-STATUS-011",
  diag.includes("AUTH_LOGIN_SUCCESS_HTTP_STATUS") &&
    diag.includes("canonical=") &&
    /results\.A === 201/.test(diag),
  "Auth-path diagnostic requires exact canonical status (rejects 201)"
);

const flutterLogin = path.join(
  maintainproRoot,
  "apps/mobile/lib/features/auth/data/datasources/auth_remote_datasource.dart"
);
if (existsSync(flutterLogin)) {
  const dart = readFileSync(flutterLogin, "utf8");
  check(
    "AUTH-STATUS-012",
    !/statusCode\s*==\s*201/.test(dart) && !/statusCode\s*!=\s*201/.test(dart),
    "Flutter auth datasource does not hard-require HTTP 201"
  );
}

const bffSpec = readFileSync(
  path.join(maintainproRoot, "apps/api/test/bff-backend-route.spec.ts"),
  "utf8"
);
check(
  "AUTH-STATUS-006",
  /BFF-001:[\s\S]*?expect\(response\.status\)\.toBe\(200\)/.test(bffSpec),
  "BFF login success test asserts exact 200"
);

if (failed) {
  console.error(`auth-status-contract.selftest: ${failed} failed`);
  process.exit(1);
}
console.log("auth-status-contract.selftest: all passed");