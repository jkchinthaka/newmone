#!/usr/bin/env node
/**
 * Contract selftest: health live/ready readiness patterns (source scan only).
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

const ctrlPath = path.join(root, "apps/api/src/health.controller.ts");
const svcPath = path.join(root, "apps/api/src/health.service.ts");
check("HEALTH-CTRL-001", existsSync(ctrlPath), "health.controller.ts exists");
check("HEALTH-SVC-001", existsSync(svcPath), "health.service.ts exists");

const ctrl = existsSync(ctrlPath) ? readFileSync(ctrlPath, "utf8") : "";
const svc = existsSync(svcPath) ? readFileSync(svcPath, "utf8") : "";

check("HEALTH-LIVE-001", /@Get\("live"\)/.test(ctrl) && /getLiveness\(/.test(ctrl), "live route + getLiveness");
check("HEALTH-READY-001", /@Get\("ready"\)/.test(ctrl) && /getMinimalReadiness\(/.test(ctrl), "ready route + getMinimalReadiness");
check("HEALTH-READY-002", /getMinimalReadiness/.test(svc), "getMinimalReadiness in service");
check("HEALTH-503-001", /httpStatus[\s\S]{0,80}503|503[\s\S]{0,40}httpStatus/.test(svc), "httpStatus 503 pattern");

const liveMatch = svc.match(/getLiveness\s*\(\s*\)\s*\{([\s\S]*?)\n  \}/);
const liveBody = liveMatch ? liveMatch[1] : "";
check(
  "HEALTH-LIVE-002",
  Boolean(liveMatch) && !/\bcheckDatabase\s*\(/.test(liveBody),
  "getLiveness body has no checkDatabase call"
);

if (failed) process.exit(1);
console.log("\nAll health-readiness-contract selftests passed.");
