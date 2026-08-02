#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const p = path.join(root, "scripts/uat/run-rollback-rehearsal.mjs");
if (!existsSync(p)) process.exit(1);
const t = readFileSync(p, "utf8");
if (!/ROLLBACK_REHEARSAL_VALIDATED/.test(t) || !/volumes_removed=no/.test(t)) process.exit(1);
console.log("PASS rollback-rehearsal-contract");