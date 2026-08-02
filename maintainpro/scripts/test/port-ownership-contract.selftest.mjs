#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const check = (id, ok, d) => { if (ok) console.log(`PASS ${id}`); else { failed += 1; console.error(`FAIL ${id}: ${d}`); } };
const doc = readFileSync(path.join(root, "docs/remediation/PORT_OWNERSHIP_AND_REVERSE_PROXY_DECISION.md"), "utf8");
check("PORT-001", /PORT_OWNER_DECISION_REQUIRED/.test(doc), "decision required");
check("PORT-002", /OPTION A/.test(doc) && /OPTION B/.test(doc), "both options");
const fixture = readFileSync(path.join(root, ".env.production.security-fixture.example"), "utf8");
check("PORT-003", /EDGE_PROXY_OWNER=UNDECIDED/.test(fixture), "undecided fixture");
if (failed) process.exit(1);
console.log("port-ownership-contract ok");