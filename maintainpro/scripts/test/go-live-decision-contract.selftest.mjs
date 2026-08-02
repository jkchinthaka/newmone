#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const t = readFileSync(path.join(root, "apps/api/src/modules/go-live/decision-board.service.ts"), "utf8");
let failed = 0;
const check = (ok, msg) => { if (!ok) { console.error("FAIL", msg); failed++; } else console.log("PASS", msg); };
check(/recommendedDecision = GoLiveDecisionOption.DELAYED/.test(t), "default DELAYED");
check(/Cannot record GO without formal business UAT/.test(t), "blocks GO without formal UAT");
check(/POST_DEPLOYMENT_ACCEPTANCE is not allowed/.test(t), "blocks post-deploy in phase7");
check(/PENDING_AUTHORIZED_HUMAN_DECISION/.test(t), "human decision pending marker");
if (failed) process.exit(1);