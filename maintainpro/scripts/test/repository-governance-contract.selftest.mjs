#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const check = (id, ok, d) => { if (ok) console.log(`PASS ${id}`); else { failed += 1; console.error(`FAIL ${id}: ${d}`); } };
const doc = path.join(root, "docs/remediation/REPOSITORY_GOVERNANCE_AND_RELEASE_POLICY.md");
check("REPO-001", existsSync(doc), "governance doc");
const t = readFileSync(doc, "utf8");
check("REPO-002", /OPERATOR_ACTION_REQUIRED/.test(t), "operator action required");
check("REPO-003", /Force-push protection/i.test(t), "force-push policy");
if (failed) process.exit(1);
console.log("repository-governance-contract ok");