#!/usr/bin/env node
/**
 * Permission migration DRY-RUN analyzer only.
 * Never mutates production. Apply path is intentionally absent.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const seedPath = path.join(root, "apps/api/src/database/seed.ts");

const MIGRATION_INVENTORY = [
  { permission: "reports.view", targetRoles: ["ADMIN", "MANAGER", "VIEWER"], action: "ADD_IF_MISSING" },
  { permission: "reports.operations.view", targetRoles: ["ADMIN", "MANAGER", "OPERATIONS_MANAGER"], action: "ADD_IF_MISSING" },
  { permission: "reports.financials.view", targetRoles: ["ADMIN", "FINANCE"], action: "ADD_IF_MISSING" },
  { permission: "reports.export", targetRoles: ["ADMIN", "MANAGER"], action: "ADD_IF_MISSING" },
  { permission: "reports.management.view", targetRoles: ["ADMIN", "MANAGER", "VIEWER"], action: "ADD_IF_MISSING" },
  { permission: "purchase_orders.view", targetRoles: ["ADMIN", "PROCUREMENT_OFFICER", "FINANCE"], action: "ADD_IF_MISSING" },
  { permission: "purchase_orders.approve", targetRoles: ["ADMIN", "MANAGER"], action: "ADD_IF_MISSING" },
  { permission: "inventory.erp_dry_run", targetRoles: ["ADMIN", "MANAGER"], action: "ADD_IF_MISSING" },
  { permission: "inventory.erp_apply", targetRoles: ["ADMIN"], action: "ADD_IF_MISSING" },
  { permission: "go_live.view", targetRoles: ["ADMIN", "SUPER_ADMIN"], action: "ADD_IF_MISSING" },
  { permission: "go_live.manage", targetRoles: ["ADMIN", "SUPER_ADMIN"], action: "ADD_IF_MISSING" },
  { permission: "go_live.sign_off", targetRoles: ["ADMIN", "SUPER_ADMIN"], action: "ADD_IF_MISSING" },
  { permission: "go_live.accept_risk", targetRoles: ["ADMIN", "SUPER_ADMIN"], action: "ADD_IF_MISSING" },
  { permission: "operations.view", targetRoles: ["ADMIN", "OPERATIONS_MANAGER"], action: "ADD_IF_MISSING" },
  { permission: "operations.health.view", targetRoles: ["ADMIN", "SUPER_ADMIN", "OPERATIONS_MANAGER"], action: "ADD_IF_MISSING" },
  { permission: "operations.metrics.view", targetRoles: ["ADMIN", "SUPER_ADMIN"], action: "ADD_IF_MISSING" },
  { permission: "operations.alerts.view", targetRoles: ["ADMIN", "SUPER_ADMIN", "OPERATIONS_MANAGER"], action: "ADD_IF_MISSING" },
  { permission: "operations.alerts.acknowledge", targetRoles: ["ADMIN", "SUPER_ADMIN"], action: "ADD_IF_MISSING" },
  { permission: "audit.view", targetRoles: ["ADMIN", "SUPER_ADMIN"], action: "ADD_IF_MISSING" }
];

console.log("permission-migration-analyzer — DRY_RUN only (no mutation)\n");
console.log("mode=DRY_RUN");
console.log("ci_apply_available=no");
console.log(`inventory_count=${MIGRATION_INVENTORY.length}`);

if (process.env.CI === "true" && process.env.MAINTAINPRO_ALLOW_PRODUCTION_PERMISSION_APPLY === "true") {
  console.error("FAIL: production permission apply is forbidden in CI");
  process.exit(1);
}

if (!existsSync(seedPath)) {
  console.error("FAIL: seed.ts missing for catalog cross-check");
  process.exit(1);
}

const seed = readFileSync(seedPath, "utf8");
let present = 0;
let missingInSeed = 0;
for (const row of MIGRATION_INVENTORY) {
  if (seed.includes(`"${row.permission}"`) || seed.includes(`'${row.permission}'`)) {
    present += 1;
  } else {
    missingInSeed += 1;
    console.log(`catalog_gap permission=${row.permission} note=may_need_seed_add_only`);
  }
}

console.log(`seed_catalog_hits=${present}`);
console.log(`seed_catalog_gaps=${missingInSeed}`);
console.log("mutation_performed=no");
console.log("tenant_report=fixture_only_counts");
console.log("operator_confirmation_required=yes");
console.log("status=DRY_RUN_COMPLETE");
