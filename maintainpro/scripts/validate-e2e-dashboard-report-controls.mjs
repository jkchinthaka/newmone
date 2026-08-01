#!/usr/bin/env node
/**
 * Structural validator for management-info / dashboard / report E2E controls (no secrets).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mgmtSpec = path.join(root, "apps/web/e2e-real/management-info.spec.ts");
const reportsController = path.join(root, "apps/api/src/modules/reports/reports.controller.ts");
const currencyUtil = path.join(root, "apps/api/src/modules/reports/report-currency.util.ts");
const exportSafety = path.join(root, "apps/api/src/modules/reports/report-export-safety.util.ts");
const securityEvents = path.join(root, "apps/api/src/modules/audit/security-events.service.ts");
const pwConfig = path.join(root, "apps/web/playwright.full-stack.config.ts");

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

console.log("validate:e2e-dashboard-report-controls — structural checks only\n");

if (!existsSync(mgmtSpec)) {
  fail("MGMT-E2E-001", "management-info.spec.ts missing");
} else {
  const src = readFileSync(mgmtSpec, "utf8");
  if (!/@management-info-gate/.test(src)) fail("MGMT-E2E-002", "@management-info-gate tag missing");
  else pass("MGMT-E2E-002", "@management-info-gate present");
  if (/\btest\.skip\b/.test(src)) fail("MGMT-E2E-003", "mandatory suite must not use test.skip");
  else pass("MGMT-E2E-003", "no test.skip");
  if (/['"][0-9a-fA-F]{24}['"]/.test(src)) fail("MGMT-E2E-004", "hardcoded ObjectId in management-info E2E");
  else pass("MGMT-E2E-004", "no hardcoded ObjectIds");
  if (/docker\s+volume|prune|dropDatabase|MongoClient|prisma\./i.test(src)) {
    fail("MGMT-E2E-005", "must not include volume prune or direct DB access");
  } else pass("MGMT-E2E-005", "no volume prune / direct DB access");
  if (!/E2E-DASH-001/.test(src) || !/E2E-REPORT-001/.test(src) || !/E2E-ERP-MON-001/.test(src)) {
    fail("MGMT-E2E-006", "required case IDs incomplete");
  } else pass("MGMT-E2E-006", "required case IDs present");
}

if (!existsSync(reportsController)) {
  fail("MGMT-API-001", "reports.controller missing");
} else {
  const c = readFileSync(reportsController, "utf8");
  if (!/erp-monitoring/.test(c)) fail("MGMT-API-001", "erp-monitoring route missing");
  else pass("MGMT-API-001", "erp-monitoring present");
}

if (!existsSync(currencyUtil)) {
  fail("MGMT-API-002", "report-currency.util missing");
} else {
  const c = readFileSync(currencyUtil, "utf8");
  if (!/LKR/.test(c) || !/Asia\/Colombo/.test(c)) fail("MGMT-API-002", "LKR / Asia/Colombo missing");
  else pass("MGMT-API-002", "LKR currency util present");
}

if (!existsSync(exportSafety)) {
  fail("MGMT-API-003", "report-export-safety.util missing");
} else {
  const c = readFileSync(exportSafety, "utf8");
  if (!/neutralizeSpreadsheetValue/.test(c)) fail("MGMT-API-003", "neutralizeSpreadsheetValue missing");
  else pass("MGMT-API-003", "formula neutralize present");
}

if (!existsSync(securityEvents)) {
  fail("MGMT-API-004", "security-events.service missing");
} else {
  const c = readFileSync(securityEvents, "utf8");
  if (!/SecurityEvent|securityEvent/.test(c)) fail("MGMT-API-004", "SecurityEvent persistence missing");
  else pass("MGMT-API-004", "security events service present");
}

if (!existsSync(pwConfig)) {
  fail("MGMT-PW-001", "playwright.full-stack.config missing");
} else {
  const c = readFileSync(pwConfig, "utf8");
  if (!/@management-info-gate/.test(c)) fail("MGMT-PW-001", "chromium-gate grep missing @management-info-gate");
  else pass("MGMT-PW-001", "chromium-gate includes @management-info-gate");
}

console.log(`\nSummary: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
