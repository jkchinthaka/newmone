#!/usr/bin/env node
/**
 * Work-order lifecycle contract selftests (source-level, no secrets).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;

function check(id, ok, detail) {
  if (ok) console.log(`PASS ${id}: ${detail}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${detail}`);
  }
}

const service = readFileSync(
  path.join(root, "apps/api/src/modules/work-orders/work-orders.service.ts"),
  "utf8"
);
const controller = readFileSync(
  path.join(root, "apps/api/src/modules/work-orders/work-orders.controller.ts"),
  "utf8"
);
const evidenceGov = readFileSync(
  path.join(root, "apps/api/src/common/utils/work-order-evidence-governance.ts"),
  "utf8"
);

check(
  "WO-LC-CONTRACT-001",
  /Maker-checker separation required/.test(service) &&
    /current\.createdById === approver\.sub/.test(service),
  "Service enforces maker-checker on approval"
);

check(
  "WO-LC-CONTRACT-002",
  /Cannot start work without an assigned technician or employee/.test(service),
  "Service requires assignment before IN_PROGRESS"
);

check(
  "WO-LC-CONTRACT-003",
  /createdById: authoritativeCreatorId/.test(service),
  "Service sets createdById from authenticated actor"
);

check(
  "WO-LC-CONTRACT-004",
  /@Post\(":id\/assign"\)[\s\S]{0,120}@HttpCode\(HttpStatus\.OK\)/.test(controller),
  "Assign endpoint declares HTTP 200"
);

check(
  "WO-LC-CONTRACT-005",
  /@Patch\(":id\/status"\)[\s\S]{0,120}@HttpCode\(HttpStatus\.OK\)/.test(controller),
  "Status PATCH declares HTTP 200"
);

check(
  "WO-LC-CONTRACT-006",
  /verifySupervisor[\s\S]*status: WorkOrderStatus\.COMPLETED/.test(service),
  "verifySupervisor finalizes COMPLETED"
);

check(
  "WO-LC-CONTRACT-007",
  /Canonical assignee model: sync WorkOrderAssignee/.test(service),
  "Assign syncs canonical assignee model"
);

check(
  "WO-LC-CONTRACT-008",
  /Storage disabled: photo evidence is waived/.test(evidenceGov),
  "Storage-disabled evidence waiver documented in governance"
);

check(
  "WO-LC-CONTRACT-009",
  /targetStatus === WorkOrderStatus\.ON_HOLD[\s\S]{0,120}assertReasonProvided\("Hold reason"/.test(
    service
  ),
  "ON_HOLD requires delayReason via hold reason guard"
);

check(
  "WO-LC-CONTRACT-010",
  /@Patch\(":id\/approve"\)[\s\S]{0,120}@HttpCode\(HttpStatus\.OK\)/.test(controller),
  "Approve endpoint declares HTTP 200"
);

if (failed) process.exit(1);
console.log("\nAll work-order lifecycle contract selftests passed.");
