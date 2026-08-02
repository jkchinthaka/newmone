#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const p = path.join(root, "docs/uat/GO_LIVE_ACCEPTED_RISK_REGISTER.md");
if (!existsSync(p)) process.exit(1);
if (!/P0 cannot be accepted/.test(readFileSync(p, "utf8"))) process.exit(1);
console.log("PASS accepted-risk-contract");