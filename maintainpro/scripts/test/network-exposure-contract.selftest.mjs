#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const check = (id, ok, d) => { if (ok) console.log(`PASS ${id}`); else { failed += 1; console.error(`FAIL ${id}: ${d}`); } };
const compose = readFileSync(path.join(root, "docker-compose.production.yml"), "utf8");
check("NET-001", /127\.0\.0\.1:27018/.test(compose), "mongo loopback");
check("NET-002", /127\.0\.0\.1:9000/.test(compose), "minio loopback");
check("NET-003", !/0\.0\.0\.0:27017/.test(compose), "no public mongo");
check("NET-004", /expose:\s*\n\s*-\s*"3000"/m.test(compose) || /expose:[\s\S]*3000/.test(compose), "api expose only");
if (failed) process.exit(1);
console.log("network-exposure-contract ok");