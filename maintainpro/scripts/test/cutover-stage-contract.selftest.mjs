#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const t = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
if (!/PRE_CUTOVER_DECISION/.test(t) || !/POST_DEPLOYMENT_ACCEPTANCE/.test(t)) process.exit(1);
console.log("PASS cutover-stage-contract");