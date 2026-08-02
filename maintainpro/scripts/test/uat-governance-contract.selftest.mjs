#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const t = readFileSync(path.join(root, "docs/uat/UAT_GOVERNANCE_CONTRACT.md"), "utf8");
if (!/FORMAL_BUSINESS_UAT/.test(t) || !/cannot fabricate GO/i.test(t)) process.exit(1);
console.log("PASS uat-governance-contract");