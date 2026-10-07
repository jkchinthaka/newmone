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
const authSvc = read("apps/api/src/modules/auth/auth.service.ts");
const authSec = read("apps/api/src/modules/auth/auth-security-event.util.ts");
check("AUD-COV-001", /SecurityEvent|securityEvent/.test(sec), "SecurityEvent persistence");
check("AUD-COV-002", /fingerprintIdentifier/.test(sec), "identifier fingerprinting");
check("AUD-COV-003", /sanitizeMetadata/.test(sec) && /password|token/i.test(sec), "sanitize metadata blocks secrets");
// The coverage note is user-facing copy; it may say "login" or "sign-in", but must still state
// that failed attempts are recorded and that passwords/tokens are excluded.
check(
  "AUD-COV-004",
  /Failed (?:login|sign-in) attempts are (?:persisted|recorded)[^"\n]*without passwords or tokens/.test(svc),
  "reports coverage notes state failed sign-ins are recorded without passwords or tokens"
);
// The claim in AUD-COV-004 must be backed by the real auth path (AuthService does not use AuditModule).
check(
  "AUD-COV-005",
  /recordAuthSecurityEvent\([^)]*eventType:\s*"LOGIN_FAILURE"/s.test(authSvc) &&
    /securityEvent/.test(authSec) &&
    /fingerprintIdentifier/.test(authSec) &&
    /sanitizeMetadata/.test(authSec) &&
    /password\|token/.test(authSec),
  "AuthService records LOGIN_FAILURE as a SecurityEvent with fingerprinted identifier and secret-free metadata"
);


if (failed) process.exit(1);
console.log("\nAll audit-event-coverage-contract selftests passed.");
