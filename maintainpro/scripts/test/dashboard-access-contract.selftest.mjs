#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
function check(id, ok, d) {
  if (ok) console.log(`PASS ${id}: ${d}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${d}`);
  }
}
function read(rel) {
  const full = path.join(root, rel);
  if (!existsSync(full)) throw new Error("missing " + rel);
  return readFileSync(full, "utf8");
}


const matrix = read("apps/api/src/modules/reports/report-access.matrix.ts");
const roles = read("apps/web/lib/dashboard-roles.ts");
const schema = read("prisma/schema.prisma");
check("DASH-ACC-001", /resolveDashboardRoleVariant/.test(matrix), "role variant resolver");
check("DASH-ACC-002", /return "finance"/.test(matrix), "FINANCE maps to finance");
check("DASH-ACC-003", /FINANCE_APPROVER/.test(matrix) && /FINANCE/.test(matrix), "FINANCE_APPROVER alias to FINANCE");
check("DASH-ACC-004", /"finance"/.test(roles) && /"procurement"/.test(roles), "web DashboardVariant finance/procurement");
check("DASH-ACC-005", /enum RoleName[\s\S]*?\n\s*FINANCE\b/.test(schema) && !/enum RoleName[\s\S]*?FINANCE_APPROVER/.test(schema), "RoleName uses FINANCE not FINANCE_APPROVER");


if (failed) process.exit(1);
console.log("\nAll dashboard-access-contract selftests passed.");
