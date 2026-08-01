#!/usr/bin/env node
/**
 * Structural validator for work-order lifecycle E2E (no secrets).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const lcSpec = path.join(root, "apps/web/e2e-real/work-order-lifecycle.spec.ts");
const diagSpec = path.join(root, "apps/web/e2e-real/work-order-lifecycle-diagnostic.spec.ts");
const service = path.join(root, "apps/api/src/modules/work-orders/work-orders.service.ts");

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

console.log("validate:e2e-work-order-lifecycle — structural checks only\n");

if (!existsSync(lcSpec)) {
  fail("WO-LC-001", "work-order-lifecycle.spec.ts missing");
} else {
  const src = readFileSync(lcSpec, "utf8");
  if (/test\.skip/.test(src)) fail("WO-LC-002", "mandatory lifecycle suite must not use test.skip");
  else pass("WO-LC-002", "no test.skip in lifecycle suite");

  if (/toBeLessThan\s*\(\s*500\s*\)/.test(src)) fail("WO-LC-003", "must not use status < 500 assertions");
  else pass("WO-LC-003", "no broad status < 500 assertions");

  if (!/workOrderId/.test(src)) fail("WO-LC-004", "workOrderId lifecycle state required");
  else pass("WO-LC-004", "workOrderId present in lifecycle suite");

  if (/["'][a-fA-F0-9]{24}["']/.test(src)) fail("WO-LC-005", "hardcoded ObjectId in lifecycle E2E");
  else pass("WO-LC-005", "no hardcoded ObjectIds");

  if (/prisma\.|MongoClient|mongoose/.test(src)) fail("WO-LC-006", "no direct DB access");
  else pass("WO-LC-006", "no direct DB access");

  if (!/E2E-WO-LC-001/.test(src)) fail("WO-LC-007", "E2E-WO-LC-001 missing");
  else pass("WO-LC-007", "E2E-WO-LC-001 present");

  if (!/E2E-WO-LC-015/.test(src)) fail("WO-LC-008", "E2E-WO-LC-015 missing");
  else pass("WO-LC-008", "E2E-WO-LC-015 present");

  if (!/selfApprove[\s\S]{0,400}403/.test(src) || !/maker-checker|self-approve|selfApprove/.test(src)) {
    fail("WO-LC-009", "maker-checker (403 self-approve) coverage missing");
  } else pass("WO-LC-009", "maker-checker self-approve 403 present");

  if (!/stock-out/.test(src) || !/idempotencyKey/.test(src)) {
    fail("WO-LC-010", "inventory stock-out with idempotencyKey missing");
  } else pass("WO-LC-010", "inventory stock-out linkage present");

  if (!/CSRF_INVALID/.test(src)) fail("WO-LC-011", "lifecycle CSRF negative missing");
  else pass("WO-LC-011", "lifecycle CSRF negative present");

  if (!/@full-stack @security @erp-control/.test(src)) fail("WO-LC-012", "lifecycle tags missing");
  else pass("WO-LC-012", "lifecycle suite tags present");
}

if (!existsSync(diagSpec)) {
  fail("WO-LC-DIAG-001", "work-order-lifecycle-diagnostic.spec.ts missing");
} else {
  const diag = readFileSync(diagSpec, "utf8");
  if (!/@wo-lifecycle-gate/.test(diag)) fail("WO-LC-DIAG-002", "@wo-lifecycle-gate tag missing");
  else pass("WO-LC-DIAG-002", "diagnostic gate tag present");
  if (/@full-stack|@smoke|@security/.test(diag)) {
    fail("WO-LC-DIAG-003", "diagnostic must not carry full-stack/smoke/security tags");
  } else pass("WO-LC-DIAG-003", "diagnostic tag isolation ok");
  if (/console\.log[\s\S]{0,200}(id|token|csrf|cookie)/i.test(diag)) {
    fail("WO-LC-DIAG-004", "diagnostic may log sensitive fields");
  } else pass("WO-LC-DIAG-004", "diagnostic console output appears safe");
}

if (!existsSync(service)) {
  fail("WO-LC-SVC-001", "work-orders.service.ts missing");
} else {
  const svc = readFileSync(service, "utf8");
  if (!/Maker-checker|maker_checker|maker-checker/.test(svc)) {
    fail("WO-LC-SVC-002", "maker-checker enforcement missing in service");
  } else pass("WO-LC-SVC-002", "maker-checker referenced in service");
  if (!/Cannot start work without an assigned technician/.test(svc)) {
    fail("WO-LC-SVC-003", "assignment-before-start guard missing in service");
  } else pass("WO-LC-SVC-003", "assignment-before-start guard present");
}

console.log(`\nSummary: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
