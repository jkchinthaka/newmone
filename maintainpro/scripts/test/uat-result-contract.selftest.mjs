#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// UAT results are classed by UatEvidenceClass; FORMAL_BUSINESS_UAT is the only class that can support GO.
const t = readFileSync(path.join(root, "apps/api/src/database/prisma-enums.ts"), "utf8");
if (!/enum UatEvidenceClass/.test(t) || !/FORMAL_BUSINESS_UAT/.test(t)) process.exit(1);
console.log("PASS uat-result-contract");