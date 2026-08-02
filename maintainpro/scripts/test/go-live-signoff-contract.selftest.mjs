#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const t = readFileSync(path.join(root, "apps/api/src/modules/go-live/go-live-signoff.service.ts"), "utf8");
if (!/assertSignOffRoleAuthorized/.test(t) || !/UatEvidenceClass.SYNTHETIC/.test(t)) process.exit(1);
console.log("PASS go-live-signoff-contract");