#!/usr/bin/env node
/**
 * Contract selftest: OperationalAlert schema + observe/dedupe/cooldown.
 */
import { readFileSync, existsSync } from "node:fs";
function readText(full) {
  const buf = readFileSync(full);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return Buffer.from(buf).swap16().toString("utf16le");
  }
  if (buf.length >= 4 && buf[1] === 0 && buf[3] === 0 && buf[0] !== 0 && buf[2] !== 0) {
    return buf.toString("utf16le");
  }
  return buf.toString("utf8");
}
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

const schemaPath = path.join(root, "prisma/schema.prisma");
const svcPath = path.join(
  root,
  "apps/api/src/modules/operations/alerts/operational-alert.service.ts"
);
check("ALERT-SCHEMA-001", existsSync(schemaPath), "schema.prisma exists");
check("ALERT-SVC-001", existsSync(svcPath), "operational-alert.service.ts exists");

const schema = existsSync(schemaPath) ? readText(schemaPath) : "";
const svc = existsSync(svcPath) ? readText(svcPath) : "";

check("ALERT-SCHEMA-002", /model\s+OperationalAlert\b/.test(schema), "OperationalAlert in schema");
check("ALERT-SVC-002", /async\s+observe\s*\(/.test(svc), "observe method");
check(
  "ALERT-SVC-003",
  /duplicateSuppressed|fingerprint/.test(svc),
  "dedupe via fingerprint / duplicateSuppressed"
);
check(
  "ALERT-SVC-004",
  /cooldownSeconds|cooldownUntil|OPERATIONAL_ALERT_COOLDOWN/.test(svc),
  "cooldown present"
);

if (failed) process.exit(1);
console.log("\nAll operational-alert-contract selftests passed.");
