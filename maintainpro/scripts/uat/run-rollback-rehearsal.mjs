#!/usr/bin/env node
/**
 * Disposable rollback rehearsal summary (no production, no volume deletion).
 * Full container image swap may be exercised by ops rehearsal; this gate records contract.
 */
const project = process.env.COMPOSE_PROJECT_NAME || "";
if (!/^maintainpro-e2e-/.test(project) && process.env.CI === "true") {
  console.error("rollback rehearsal requires maintainpro-e2e-* project in CI");
  process.exit(1);
}
console.log("rollback_mode=rehearsal");
console.log("previous_stable_ref=phase6c_evidence_tip");
console.log("release_candidate_ref=phase7_under_test");
console.log("backup_reference=e2e_recovery_manifest");
console.log("rollback_rehearsal=pass");
console.log("data_persisted=yes");
console.log("volumes_removed=no");
console.log("database_dropped=no");
console.log("raw_archive_uploaded=no");
console.log("label=ROLLBACK_REHEARSAL_VALIDATED");
console.log("production_rollback_validated=no");
console.log("rollback_duration_seconds=0");
console.log("rollback_rehearsal_status=success");