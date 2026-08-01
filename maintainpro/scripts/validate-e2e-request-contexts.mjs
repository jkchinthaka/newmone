#!/usr/bin/env node
/**
 * Structural validator: authenticated E2E tests must not misuse isolated request fixture.
 * Never prints secrets.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const e2eReal = path.join(maintainproRoot, "apps/web/e2e-real");

let failures = 0;
let passes = 0;

function pass(id, msg) {
  passes += 1;
  console.log(`PASS ${id}: ${msg}`);
}
function fail(id, msg) {
  failures += 1;
  console.error(`FAIL ${id}: ${msg}`);
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function main() {
  console.log("validate:e2e-request-contexts — structural checks only\n");

  const authPath = path.join(e2eReal, "auth.spec.ts");
  const csrfPath = path.join(e2eReal, "csrf.spec.ts");
  const helperPath = path.join(e2eReal, "helpers/browser-session.ts");

  if (!existsSync(helperPath)) {
    fail("REQ-CTX-001", "browser-session helper missing");
  } else {
    const helper = readFileSync(helperPath, "utf8");
    if (!helper.includes("page.request") || !helper.includes("x-csrf-token")) {
      fail("REQ-CTX-001", "browser-session helper must use page.request and CSRF header");
    } else {
      pass("REQ-CTX-001", "browser-session helper present");
    }
    if (/console\.(log|info|debug)\(.*csrf/i.test(helper)) {
      fail("REQ-CTX-001b", "helper must not log CSRF values");
    } else {
      pass("REQ-CTX-001b", "helper does not log CSRF values");
    }
  }

  if (existsSync(authPath)) {
    const auth = stripComments(readFileSync(authPath, "utf8"));
    if (/E2E-AUTH-011[\s\S]{0,800}request\.post\s*\(\s*["']\/api\/backend\/auth\/logout/.test(auth)) {
      fail("REQ-CTX-002", "AUTH-011 must not logout via isolated request fixture after loginViaUi");
    } else {
      pass("REQ-CTX-002", "AUTH logout uses browser session helpers / page.request");
    }
    if (/E2E-AUTH-012[\s\S]{0,500}\.catch\(\s*\(\)\s*=>\s*undefined\s*\)/.test(auth)) {
      fail("REQ-CTX-003", "AUTH-012 must not swallow logout failures");
    } else {
      pass("REQ-CTX-003", "AUTH-012 does not swallow logout response");
    }
    if (/E2E-AUTH-011[\s\S]{0,600}\[200,\s*201,\s*204\]/.test(auth)) {
      fail("REQ-CTX-004", "AUTH-011 must assert exact logout status, not 200|201|204");
    } else {
      pass("REQ-CTX-004", "AUTH-011 uses exact logout status");
    }
  }

  if (existsSync(csrfPath)) {
    const csrf = stripComments(readFileSync(csrfPath, "utf8"));
    if (/E2E-CSRF-003[\s\S]{0,600}\[200,\s*201,\s*400,\s*422\]/.test(csrf)) {
      fail("REQ-CTX-005", "CSRF-003 must not accept 400/422 as CSRF success");
    } else {
      pass("REQ-CTX-005", "CSRF-003 requires exact mutation success status");
    }

    let authCsrfOk = true;
    for (const id of ["E2E-CSRF-001", "E2E-CSRF-002", "E2E-CSRF-003", "E2E-CSRF-004"]) {
      const idx = csrf.indexOf(id);
      if (idx < 0) {
        authCsrfOk = false;
        fail("REQ-CTX-006", `${id} missing`);
        continue;
      }
      const block = csrf.slice(idx, idx + 500);
      if (/async\s*\(\s*\{\s*page,\s*request\s*\}/.test(block)) {
        authCsrfOk = false;
        fail("REQ-CTX-006", `${id} must not use { page, request } after browser login`);
      }
    }
    if (authCsrfOk) {
      pass("REQ-CTX-006", "CSRF-001..004 authenticated tests avoid isolated request fixture");
    }

    if (!/E2E-CSRF-005[\s\S]{0,200}async\s*\(\s*\{\s*request\s*\}/.test(csrf)) {
      fail("REQ-CTX-007", "CSRF-005 should use isolated request for public login exemption");
    } else {
      pass("REQ-CTX-007", "CSRF-005 uses isolated request for unauthenticated login");
    }
  }

  const bffAuth = path.join(maintainproRoot, "apps/web/lib/bff-auth.ts");
  if (existsSync(bffAuth)) {
    const src = readFileSync(bffAuth, "utf8");
    if (/path:\s*["']auth\/logout["']/.test(src)) {
      fail("REQ-CTX-008", "auth/logout must not be CSRF-exempt");
    } else {
      pass("REQ-CTX-008", "auth/logout is not in CSRF exemption registry");
    }
  }

  console.log(`\nSummary: ${passes} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

main();