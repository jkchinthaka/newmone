#!/usr/bin/env node
import { validateRecoveryTarget } from "./lib/recovery-safety.mjs";

const provider = String(process.env.DATABASE_PROVIDER || "").toLowerCase();
const host =
  process.env.RECOVERY_SQLSERVER_HOST ||
  process.env.RECOVERY_MONGO_HOST ||
  (provider === "sqlserver" ? "sqlserver" : "mongo");

const result = validateRecoveryTarget({
  e2eTestMode: process.env.E2E_TEST_MODE,
  recoveryRehearsal: process.env.RECOVERY_REHEARSAL,
  runId: process.env.E2E_RUN_ID,
  sourceDatabase: process.env.RECOVERY_SOURCE_DATABASE || process.env.PRIMARY_DATABASE_NAME,
  targetDatabase: process.env.RECOVERY_TARGET_DATABASE,
  host,
  composeProjectName: process.env.COMPOSE_PROJECT_NAME,
  dropFlag: String(process.env.RECOVERY_ALLOW_DROP || "").toLowerCase() === "true",
  resetFlag: String(process.env.RECOVERY_ALLOW_RESET || "").toLowerCase() === "true"
});

for (const [k, v] of Object.entries(result.safe)) {
  console.log(`${k}=${v}`);
}
if (!result.ok) {
  console.error("recovery_target_rejected=yes");
  for (const e of result.errors) console.error(`reason=${e}`);
  process.exit(1);
}
console.log("recovery_target_ok=yes");
