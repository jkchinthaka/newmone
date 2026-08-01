#!/usr/bin/env node
/**
 * Structural validator for E2E work-order create payloads and assertions.
 * Never prints secrets or payload values.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
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

function listSpecFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".spec.ts"))
    .map((f) => path.join(dir, f));
}

function main() {
  console.log("validate:e2e-work-order-payloads — structural checks only\n");

  const helperPath = path.join(e2eReal, "helpers/work-order-payload.ts");
  const sessionHelper = path.join(e2eReal, "helpers/browser-session.ts");
  const csrfPath = path.join(e2eReal, "csrf.spec.ts");

  if (!existsSync(helperPath)) {
    fail("WO-PAY-001", "work-order-payload helper missing");
  } else {
    const helper = readFileSync(helperPath, "utf8");
    if (!helper.includes("getAuthenticatedUserId") || !helper.includes("createdById")) {
      fail("WO-PAY-001", "payload helper must resolve createdById via getAuthenticatedUserId");
    } else {
      pass("WO-PAY-001", "payload helper resolves createdById from session");
    }
    if (/["'][a-fA-F0-9]{24}["']/.test(helper)) {
      fail("WO-PAY-001b", "payload helper must not hardcode 24-char ObjectIds");
    } else {
      pass("WO-PAY-001b", "payload helper has no hardcoded ObjectIds");
    }
  }

  if (!existsSync(sessionHelper) || !readFileSync(sessionHelper, "utf8").includes("getAuthenticatedUserId")) {
    fail("WO-PAY-002", "getAuthenticatedUserId helper missing");
  } else {
    pass("WO-PAY-002", "getAuthenticatedUserId present");
  }

  if (existsSync(csrfPath)) {
    const csrf = stripComments(readFileSync(csrfPath, "utf8"));
    if (!/E2E-CSRF-003[\s\S]{0,1200}buildValidWorkOrderPayload/.test(csrf)) {
      fail("WO-PAY-003", "CSRF-003 must use buildValidWorkOrderPayload");
    } else {
      pass("WO-PAY-003", "CSRF-003 uses valid payload helper");
    }
    if (/E2E-CSRF-003[\s\S]{0,800}\[200,\s*201,\s*400,\s*422\]/.test(csrf)) {
      fail("WO-PAY-004", "CSRF-003 must not accept 400/422 as success");
    } else {
      pass("WO-PAY-004", "CSRF-003 does not broaden success statuses");
    }
    if (!/E2E-CSRF-003[\s\S]{0,800}toBe\(201\)/.test(csrf)) {
      fail("WO-PAY-005", "CSRF-003 must assert exact HTTP 201");
    } else {
      pass("WO-PAY-005", "CSRF-003 asserts exact 201");
    }
    if (!/E2E-CSRF-003[\s\S]{0,1500}createdById/.test(csrf)) {
      fail("WO-PAY-006", "CSRF-003 must include createdById contract checks");
    } else {
      pass("WO-PAY-006", "CSRF-003 checks createdById attribution");
    }
  } else {
    fail("WO-PAY-003", "csrf.spec.ts missing");
  }

  const specs = listSpecFiles(e2eReal);
  for (const file of specs) {
    const rel = path.relative(maintainproRoot, file).replace(/\\/g, "/");
    const src = stripComments(readFileSync(file, "utf8"));

    // Ban hardcoded ObjectIds in request data payloads (allow roleId-style only if in allowlist files — none).
    // Skip rbac negative tests that historically used zeros — flag zeros in work-order / csrf specs strictly.
    if (/work-order|csrf/.test(path.basename(file))) {
      const dataBlocks = src.match(/data:\s*\{[\s\S]{0,400}\}/g) || [];
      for (const block of dataBlocks) {
        if (/["'][a-fA-F0-9]{24}["']/.test(block)) {
          fail("WO-PAY-007", `${rel}: hardcoded ObjectId in request data payload`);
        }
      }
    }

    if (/prisma\.|MongoClient|dropDatabase|deleteMany\(/.test(src)) {
      fail("WO-PAY-008", `${rel}: must not access database directly from browser E2E`);
    }

    if (/localStorage\.getItem\(["']maintainpro_.*user/.test(src)) {
      fail("WO-PAY-009", `${rel}: must not use localStorage as authoritative actor identity`);
    }

    if (/page\.route\(|route\.fulfill\(/.test(src)) {
      fail("WO-PAY-010", `${rel}: must not mock routes in real-stack suite`);
    }
  }
  if (failures === 0) {
    pass("WO-PAY-007..010", "no hardcoded WO ObjectIds / DB access / localStorage identity / route mocks in WO+CSRF specs");
  }

  console.log(`\nSummary: ${passes} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

main();
