#!/usr/bin/env node
/**
 * Work-order create contract selftests (source-level, no secrets).
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "../..");

let failed = 0;
function check(id, ok, detail) {
  if (ok) console.log(`PASS ${id}: ${detail}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${detail}`);
  }
}

const service = readFileSync(
  path.join(maintainproRoot, "apps/api/src/modules/work-orders/work-orders.service.ts"),
  "utf8"
);
check(
  "WO-CONTRACT-001",
  /createdById is required/.test(service),
  "Service requires createdById"
);

const validation = readFileSync(
  path.join(maintainproRoot, "apps/api/src/common/utils/work-order-validation.ts"),
  "utf8"
);
check(
  "WO-CONTRACT-002",
  /CORRECTIVE,\s*EMERGENCY/.test(validation) || /General tasks \(CORRECTIVE/.test(validation),
  "CORRECTIVE may omit asset/vehicle"
);

const webTypes = readFileSync(
  path.join(maintainproRoot, "apps/web/components/work-orders/types.ts"),
  "utf8"
);
check(
  "WO-CONTRACT-003",
  /export interface CreateWorkOrderInput[\s\S]*createdById:\s*string/.test(webTypes),
  "Web CreateWorkOrderInput requires createdById"
);

const mobileDs = path.join(
  maintainproRoot,
  "apps/mobile/lib/features/work_orders/data/datasources/work_orders_remote_datasource.dart"
);
check(
  "WO-CONTRACT-004",
  existsSync(mobileDs) && /createdById/.test(readFileSync(mobileDs, "utf8")),
  "Flutter create path includes createdById"
);

const helper = readFileSync(
  path.join(maintainproRoot, "apps/web/e2e-real/helpers/work-order-payload.ts"),
  "utf8"
);
check(
  "WO-CONTRACT-005",
  /getAuthenticatedUserId/.test(helper) && /type:\s*overrides\?\.type\s*\?\?\s*"CORRECTIVE"/.test(helper),
  "E2E payload helper uses /auth/me and CORRECTIVE default"
);

const csrf = readFileSync(path.join(maintainproRoot, "apps/web/e2e-real/csrf.spec.ts"), "utf8");
check(
  "WO-CONTRACT-006",
  /E2E-CSRF-003[\s\S]*toBe\(201\)/.test(csrf) && /buildValidWorkOrderPayload/.test(csrf),
  "CSRF-003 requires exact 201 with valid payload helper"
);

if (failed > 0) process.exit(1);
console.log("\nAll work-order create contract selftests passed.");
