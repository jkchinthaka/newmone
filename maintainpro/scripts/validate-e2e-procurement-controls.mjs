#!/usr/bin/env node
/**
 * Structural validator for procurement E2E controls (no secrets).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const procSpec = path.join(root, "apps/web/e2e-real/procurement.spec.ts");
const controller = path.join(root, "apps/api/src/modules/inventory/inventory.controller.ts");

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

console.log("validate:e2e-procurement-controls — structural checks only\n");

if (!existsSync(procSpec)) {
  fail("INV-E2E-P-001", "procurement.spec.ts missing");
} else {
  const src = readFileSync(procSpec, "utf8");
  if (/\btest\.skip\b/.test(src)) fail("INV-E2E-P-002", "mandatory procurement suite must not use test.skip");
  else pass("INV-E2E-P-002", "no test.skip in procurement suite");
  if (/toBeLessThan\(500\)/.test(src)) fail("INV-E2E-P-003", "must not use status < 500 assertions");
  else pass("INV-E2E-P-003", "no broad status < 500 assertions");
  if (/['"][0-9a-fA-F]{24}['"]/.test(src)) fail("INV-E2E-P-004", "hardcoded ObjectId in procurement E2E");
  else pass("INV-E2E-P-004", "no hardcoded ObjectIds");
  if (/prisma\.|MongoClient|dropDatabase/.test(src)) fail("INV-E2E-P-005", "no direct DB access");
  else pass("INV-E2E-P-005", "no direct DB access");
  if (!/E2E-PROC-001/.test(src) || !/E2E-PROC-020/.test(src)) fail("INV-E2E-P-006", "E2E-PROC-001..020 coverage incomplete");
  else pass("INV-E2E-P-006", "E2E-PROC-001..020 present");
  if (!/@procurement-gate/.test(src)) fail("INV-E2E-P-007", "@procurement-gate tag missing");
  else pass("INV-E2E-P-007", "@procurement-gate present");
}

if (!existsSync(controller)) {
  fail("INV-RBAC-P-001", "inventory.controller missing");
} else {
  const c = readFileSync(controller, "utf8");
  if (!/purchase_orders\.create/.test(c)) fail("INV-RBAC-P-001", "purchase_orders.create missing");
  else pass("INV-RBAC-P-001", "purchase_orders.create present");
  if (!/purchase_orders\.receive/.test(c)) fail("INV-RBAC-P-002", "purchase_orders.receive missing");
  else pass("INV-RBAC-P-002", "purchase_orders.receive present");
  if (!/inventory\.erp_apply/.test(c)) fail("INV-RBAC-P-003", "inventory.erp_apply missing");
  else pass("INV-RBAC-P-003", "inventory.erp_apply present");
  if (!/HttpCode\(HttpStatus\.CREATED\)/.test(c)) fail("INV-RBAC-P-004", "CREATED HttpCode missing");
  else pass("INV-RBAC-P-004", "CREATED HttpCode present");
}

console.log(`\nSummary: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);