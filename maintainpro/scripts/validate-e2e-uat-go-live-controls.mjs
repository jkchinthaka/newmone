#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0, passes = 0;
const pass = (id, msg) => { passes += 1; console.log(`PASS ${id}: ${msg}`); };
const fail = (id, msg) => { failures += 1; console.error(`FAIL ${id}: ${msg}`); };

console.log("validate:e2e-uat-go-live-controls — structural\n");

const decision = path.join(root, "apps/api/src/modules/go-live/decision-board.service.ts");
const signoff = path.join(root, "apps/api/src/modules/go-live/go-live-signoff.service.ts");
const schema = path.join(root, "prisma/schema.prisma");
const gate = path.join(root, "scripts/uat/run-uat-go-live-gate.mjs");
const report = path.join(root, "docs/uat/FINAL_GO_NO_GO_REPORT.md");
const gov = path.join(root, "docs/uat/UAT_GOVERNANCE_CONTRACT.md");

if (!existsSync(gov)) fail("UAT-SAFE-001", "governance missing"); else pass("UAT-SAFE-001", "governance present");
if (!existsSync(report)) fail("UAT-SAFE-002", "final report missing"); else pass("UAT-SAFE-002", "final report present");
if (!existsSync(gate)) fail("UAT-SAFE-003", "uat gate script missing"); else pass("UAT-SAFE-003", "uat gate present");

const d = existsSync(decision) ? readFileSync(decision, "utf8") : "";
const s = existsSync(signoff) ? readFileSync(signoff, "utf8") : "";
const sch = existsSync(schema) ? readFileSync(schema, "utf8") : "";

if (!/FORMAL_BUSINESS_UAT_COMPLETE/.test(d)) fail("UAT-SAFE-004", "formal UAT gate missing");
else pass("UAT-SAFE-004", "formal UAT required for GO");
if (!/E2E_TEST_MODE/.test(d) || !/cannot record GO/.test(d)) fail("UAT-SAFE-005", "E2E GO ban missing");
else pass("UAT-SAFE-005", "E2E cannot record GO");
if (!/PORT_OWNER_DECISION_REQUIRED|portOwnerDecided/.test(d)) fail("UAT-SAFE-006", "port owner block missing");
else pass("UAT-SAFE-006", "port owner blocks GO");
if (!/POST_DEPLOYMENT_ACCEPTANCE/.test(d)) fail("UAT-SAFE-007", "post-deploy stage guard missing");
else pass("UAT-SAFE-007", "post-deploy blocked in Phase 7");
if (!/MAX_SIGN_OFF_CATEGORIES_PER_USER/.test(s)) fail("UAT-SAFE-008", "sign-off category bound missing");
else pass("UAT-SAFE-008", "sign-off category bound");
if (!/UatEvidenceClass\.SYNTHETIC/.test(s + d)) fail("UAT-SAFE-009", "synthetic evidence class missing");
else pass("UAT-SAFE-009", "synthetic evidence classed");
if (!/enum GoLiveDecisionStage/.test(sch)) fail("UAT-SAFE-010", "decision stage enum missing");
else pass("UAT-SAFE-010", "decision stage enum present");
if (!/model UatScenarioExecution/.test(sch)) fail("UAT-SAFE-011", "UAT execution model missing");
else pass("UAT-SAFE-011", "UAT execution model present");

const g = existsSync(gate) ? readFileSync(gate, "utf8") : "";
if (/recommended_decision=GO(?!_WITH)/.test(g) && !/DELAYED|NO_GO/.test(g)) {
  fail("UAT-SAFE-012", "CI gate must not emit GO");
} else pass("UAT-SAFE-012", "CI recommendation is DELAYED/NO_GO");

console.log(`\nSummary: ${passes} passed, ${failures} failed`);
if (failures) process.exit(1);