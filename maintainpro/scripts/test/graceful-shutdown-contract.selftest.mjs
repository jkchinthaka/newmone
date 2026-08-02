#!/usr/bin/env node
/**
 * Contract selftest: graceful shutdown hooks in main.ts.
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

const full = path.join(root, "apps/api/src/main.ts");
check("SHUTDOWN-001", existsSync(full), "main.ts exists");
const src = existsSync(full) ? readFileSync(full, "utf8") : "";
check("SHUTDOWN-002", /enableShutdownHooks\s*\(/.test(src), "enableShutdownHooks present");
check(
  "SHUTDOWN-003",
  /process\.once\(\s*["']SIGTERM["']|process\.on\(\s*["']SIGTERM["']/.test(src),
  "SIGTERM handler present"
);

if (failed) process.exit(1);
console.log("\nAll graceful-shutdown-contract selftests passed.");
