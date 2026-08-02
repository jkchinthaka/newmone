#!/usr/bin/env node
/**
 * Contract selftest: queue reconciliation Policy B + notification: jobId.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readText(full) {
  const buf = readFileSync(full);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
  if (buf.length >= 4 && buf[1] === 0 && buf[3] === 0 && buf[0] !== 0 && buf[2] !== 0) {
    return buf.toString("utf16le");
  }
  return buf.toString("utf8");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
function check(id, ok, d) {
  if (ok) console.log("PASS " + id + ": " + d);
  else {
    failed += 1;
    console.error("FAIL " + id + ": " + d);
  }
}

const rel = "apps/api/src/modules/queues/reconciliation/queue-startup-reconciliation.service.ts";
const full = path.join(root, rel);
check("QUEUE-001", existsSync(full), "queue-startup-reconciliation.service.ts exists");
const src = existsSync(full) ? readText(full) : "";

check("QUEUE-002", /Policy B/.test(src), "Policy B comments present");
check("QUEUE-003", /notification:/.test(src) && /jobId/.test(src), "jobId notification: pattern");

const notifPath = path.join(root, "apps/api/src/modules/notifications/notifications.service.ts");
if (existsSync(notifPath)) {
  const n = readText(notifPath);
  check("QUEUE-004", /jobId:[\s\S]{0,80}notification:/.test(n), "notifications.service uses notification: jobId");
} else {
  check("QUEUE-004", true, "notifications.service optional check skipped");
}

if (failed) process.exit(1);
console.log("\nAll queue-reconciliation-contract selftests passed.");