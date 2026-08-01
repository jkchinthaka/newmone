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


const sec = read("apps/api/src/modules/audit/security-events.service.ts");
const svc = read("apps/api/src/modules/reports/reports.service.ts");
check("AUD-COV-001", /SecurityEvent|securityEvent/.test(sec), "SecurityEvent persistence");
check("AUD-COV-002", /fingerprintIdentifier/.test(sec), "identifier fingerprinting");
check("AUD-COV-003", /sanitizeMetadata/.test(sec) && /password|token/i.test(sec), "sanitize metadata blocks secrets");
check("AUD-COV-004", /Failed login|SecurityEvent/.test(svc), "reports notes mention SecurityEvent / failed login");


if (failed) process.exit(1);
console.log("\nAll audit-event-coverage-contract selftests passed.");
