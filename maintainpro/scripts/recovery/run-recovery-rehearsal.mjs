#!/usr/bin/env node
/**
 * Orchestrates Phase 6A disposable recovery rehearsal.
 * Safe summary only — never uploads raw archives.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadE2eEnvOnly } from "../lib/e2e-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function runNode(script, extraEnv = {}) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  process.stdout.write(r.stdout || "");
  if (r.stderr) process.stdout.write(r.stderr);
  if (r.status !== 0) {
    throw new Error(`${script} failed`);
  }
  return out;
}

function main() {
  loadE2eEnvOnly();
  const started = Date.now();
  process.env.RECOVERY_REHEARSAL = "true";
  process.env.E2E_TEST_MODE = process.env.E2E_TEST_MODE || "true";
  const runId = process.env.E2E_RUN_ID;
  if (!runId) throw new Error("E2E_RUN_ID required");

  process.env.RECOVERY_SOURCE_DATABASE =
    process.env.RECOVERY_SOURCE_DATABASE || process.env.PRIMARY_DATABASE_NAME || "maintainpro_e2e_primary";
  process.env.RECOVERY_TARGET_DATABASE =
    process.env.RECOVERY_TARGET_DATABASE || `maintainpro_restore_${runId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  process.env.RECOVERY_MONGO_HOST = process.env.RECOVERY_MONGO_HOST || "mongo";
  process.env.RECOVERY_WORK_DIR =
    process.env.RECOVERY_WORK_DIR || path.join(root, "artifacts", "recovery-tmp", runId);
  mkdirSync(process.env.RECOVERY_WORK_DIR, { recursive: true });

  console.log("recovery_mode=e2e");
  let smokeOut = "";
  runNode("validate-recovery-target.mjs");
  runNode("create-mongo-backup.mjs");
  runNode("verify-mongo-backup.mjs");
  runNode("restore-mongo-backup.mjs");
  runNode("verify-restored-data.mjs");
  smokeOut = runNode("smoke-recovery-api.mjs");
  if (!/recovery_api_health=200/.test(smokeOut) || !/recovery_login=200/.test(smokeOut) || !/application_smoke_status=pass/.test(smokeOut)) {
    throw new Error("recovery API smoke markers missing");
  }
  runNode("create-object-backup.mjs");
  runNode("restore-object-backup.mjs");
  runNode("verify-object-backup.mjs");

  const durationSec = Math.round((Date.now() - started) / 1000);
  const summary = {
    recovery_mode: "e2e",
    source_safe: "yes",
    target_fresh: "yes",
    backup_status: "success",
    checksum_status: "valid",
    corruption_rejected: "yes",
    restore_status: "success",
    collection_reconciliation: "pass",
    application_smoke_status: /application_smoke_status=pass/.test(smokeOut) ? "pass" : "fail",
    object_reconciliation: "pass",
    recovery_duration_seconds: durationSec,
    timing_label: "E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE",
    raw_archive_uploaded: "no",
    volumes_removed: "no",
    productionApproved: false,
    testedCommit: process.env.APP_COMMIT_SHA || process.env.GITHUB_SHA || "unknown",
    workflowRunId: process.env.GITHUB_RUN_ID || null,
    replication_vs_backup: "separated"
  };
  const summaryPath = path.join(root, "artifacts", "e2e-logs", "recovery-rehearsal-summary.json");
  mkdirSync(path.dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`recovery_duration_seconds=${durationSec}`);
  console.log("raw_archive_uploaded=no");
  console.log("volumes_removed=no");
  console.log(`summary_path=${path.relative(root, summaryPath)}`);

  // Remove exact temporary archives/manifests from work dir after success (keep summary only).
  if (existsSync(process.env.RECOVERY_WORK_DIR)) {
    for (const f of readdirSync(process.env.RECOVERY_WORK_DIR)) {
      if (f.endsWith(".archive.gz") || f.endsWith(".corrupt.copy") || f.endsWith(".manifest.json") || f.endsWith(".objects.json") || f.endsWith(".txt")) {
        try {
          unlinkSync(path.join(process.env.RECOVERY_WORK_DIR, f));
        } catch {
          /* ignore */
        }
      }
    }
  }
  console.log("temp_archive_cleanup=yes");
}

main();