#!/usr/bin/env node
/**
 * Structural validator for inventory E2E controls (no secrets).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const invSpec = path.join(root, "apps/web/e2e-real/inventory.spec.ts");
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

console.log("validate:e2e-inventory-controls — structural checks only\n");

if (!existsSync(invSpec)) {
  fail("INV-E2E-001", "inventory.spec.ts missing");
} else {
  const src = readFileSync(invSpec, "utf8");
  if (/test\.skip\s*\(/.test(src)) fail("INV-E2E-002", "mandatory inventory suite must not use test.skip");
  else pass("INV-E2E-002", "no test.skip in inventory suite");
  if (/toBeLessThan\s*\(\s*500\s*\)/.test(src)) fail("INV-E2E-003", "must not use status < 500");
  else pass("INV-E2E-003", "no broad status < 500 assertions");
  if (!/workOrderId/.test(src)) fail("INV-E2E-004", "stock-out must include workOrderId");
  else pass("INV-E2E-004", "workOrderId present in inventory E2E");
  if (/["'][a-fA-F0-9]{24}["']/.test(src)) fail("INV-E2E-005", "hardcoded ObjectId in inventory E2E");
  else pass("INV-E2E-005", "no hardcoded ObjectIds");
  if (/prisma\.|MongoClient|dropDatabase/.test(src)) fail("INV-E2E-006", "no direct DB access");
  else pass("INV-E2E-006", "no direct DB access");
  if (!/STOCK_OUT_SUCCESS/.test(src)) fail("INV-E2E-007", "exact stock-out success status required");
  else pass("INV-E2E-007", "exact stock-out success asserted");
  if (!/E2E-INV-001/.test(src) || !/E2E-INV-016/.test(src)) fail("INV-E2E-008", "INV-001..016 coverage incomplete");
  else pass("INV-E2E-008", "INV-001..016 present");
}

if (!existsSync(controller)) {
  fail("INV-RBAC-001", "inventory.controller missing");
} else {
  const c = readFileSync(controller, "utf8");
  if (!/INVENTORY_READ_ROLES/.test(c) || !/INVENTORY_KEEPER/.test(c)) {
    fail("INV-RBAC-001", "keeper not on read roles");
  } else pass("INV-RBAC-001", "INVENTORY_KEEPER included in read roles");
  if (!/@HttpCode\(HttpStatus\.OK\)/.test(c)) fail("INV-RBAC-002", "stock-out must declare HTTP 200");
  else pass("INV-RBAC-002", "stock-out exact HTTP 200");
}

console.log(`\nSummary: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
