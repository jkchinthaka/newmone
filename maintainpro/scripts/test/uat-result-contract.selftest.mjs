#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const t = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
if (!/model UatScenarioExecution/.test(t) || !/FORMAL_BUSINESS_UAT/.test(t)) process.exit(1);
console.log("PASS uat-result-contract");