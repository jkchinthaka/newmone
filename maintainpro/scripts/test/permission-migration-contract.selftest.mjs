#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const check = (id, ok, d) => {
  if (ok) console.log(`PASS ${id}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${d}`);
  }
};

const script = path.join(root, "scripts/security/analyze-permission-migration.mjs");
check("MIG-001", existsSync(script), "analyzer missing");
const t = readFileSync(script, "utf8");
check("MIG-002", /DRY_RUN/.test(t), "DRY_RUN missing");
check("MIG-003", !/prisma\.\w+\.(create|updateMany|deleteMany)/.test(t), "mutating prisma calls");
check("MIG-004", /ci_apply_available=no/.test(t), "ci apply must be no");
if (failed) process.exit(1);
console.log("permission-migration-contract ok");
