#!/usr/bin/env node
/**
 * Contract selftest: OperationalMetricsService forbids requestId labels.
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

const rel = "apps/api/src/modules/operations/alerts/operational-metrics.service.ts";
const full = path.join(root, rel);
check("METRICS-001", existsSync(full), "OperationalMetricsService file exists");
const src = existsSync(full) ? readText(full) : "";
check("METRICS-002", /class\s+OperationalMetricsService/.test(src), "OperationalMetricsService class");
check(
  "METRICS-003",
  /Forbidden labels:[\s\S]{0,120}requestId|requestId/.test(src) &&
    /Forbidden labels/.test(src),
  "forbids requestId labels in source comments"
);
check(
  "METRICS-004",
  !/labels\s*:\s*\{[\s\S]{0,200}requestId/.test(src),
  "no requestId used as metric label object key"
);

if (failed) process.exit(1);
console.log("\nAll operational-metrics-contract selftests passed.");
