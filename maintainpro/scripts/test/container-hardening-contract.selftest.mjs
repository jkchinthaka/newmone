#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const check = (id, ok, d) => { if (ok) console.log(`PASS ${id}`); else { failed += 1; console.error(`FAIL ${id}: ${d}`); } };
const compose = readFileSync(path.join(root, "docker-compose.production.yml"), "utf8") +
  readFileSync(path.join(root, "docker-compose.yml"), "utf8");
check("CONT-001", !/privileged:\s*true/i.test(compose), "no privileged");
check("CONT-002", !/\/var\/run\/docker\.sock/.test(compose), "no docker socket");
check("CONT-003", !/network_mode:\s*host/i.test(compose), "no host network");
if (failed) process.exit(1);
console.log("container-hardening-contract ok");