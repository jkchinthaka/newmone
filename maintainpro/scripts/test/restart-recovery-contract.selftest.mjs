#!/usr/bin/env node
/**
 * Contract selftest: operations rehearsal project guard + stop/start without -v.
 */
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

const full = path.join(root, "scripts/operations/run-operations-rehearsal.mjs");
check("RESTART-001", existsSync(full), "run-operations-rehearsal.mjs exists");
const src = existsSync(full) ? readFileSync(full, "utf8") : "";

check(
  "RESTART-002",
  /maintainpro-e2e-/.test(src) && /startsWith\(\s*["']maintainpro-e2e-["']\s*\)/.test(src),
  "maintainpro-e2e- compose project guard"
);
check("RESTART-003", /\bstop\b/.test(src) && /\bstart\b/.test(src), "uses stop/start");
check(
  "RESTART-004",
  !/\bdown\b[\s\S]{0,40}-v\b|\bstop\b[\s\S]{0,40}-v\b|["']-v["']/.test(src),
  "stop/start without -v"
);
check(
  "RESTART-005",
  !/volume\s+rm|down\s+[^\n]*--volumes|--remove-orphans[\s\S]{0,40}--volumes/i.test(src),
  "no volume removal flags"
);

if (failed) process.exit(1);
console.log("\nAll restart-recovery-contract selftests passed.");
