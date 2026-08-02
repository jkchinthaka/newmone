#!/usr/bin/env node
/**
 * Contract selftest: docker-compose.yml log retention for core services.
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

const full = path.join(root, "docker-compose.yml");
check("LOGRET-001", existsSync(full), "docker-compose.yml exists");
const src = existsSync(full) ? readFileSync(full, "utf8") : "";

const services = ["api", "web", "nginx", "mongo", "redis", "minio"];
for (const name of services) {
  const re = new RegExp(
    `(?:^|\\n)\\s{2}${name}:\\s*\\n([\\s\\S]*?)(?=\\n\\s{2}[a-zA-Z0-9_-]+:\\s*\\n|\\nvolumes:|$)`
  );
  const m = src.match(re);
  const block = m ? m[1] : "";
  const hasMaxSize = /max-size:\s*"?10m"?/.test(block);
  const hasMaxFile = /max-file:\s*"?5"?/.test(block);
  check(`LOGRET-${name.toUpperCase()}`, hasMaxSize && hasMaxFile, `${name} max-size 10m max-file 5`);
}

if (failed) process.exit(1);
console.log("\nAll log-retention-contract selftests passed.");
