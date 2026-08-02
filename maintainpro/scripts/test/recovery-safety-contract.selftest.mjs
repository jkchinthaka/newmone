#!/usr/bin/env node
import {
  validateRecoveryTarget,
  buildSafeManifest,
  assertManifestSafe,
  detectRecoveryHazards,
  hostnameCategory
} from "../recovery/lib/recovery-safety.mjs";
import { sha256Buffer } from "../recovery/lib/sha256-file.mjs";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
function check(id, ok, d) {
  if (ok) console.log(`PASS ${id}: ${d}`);
  else { failed += 1; console.error(`FAIL ${id}: ${d}`); }
}

const good = validateRecoveryTarget({
  e2eTestMode: "true",
  recoveryRehearsal: "true",
  runId: "ci-123",
  sourceDatabase: "maintainpro_e2e_primary",
  targetDatabase: "maintainpro_restore_ci_123",
  host: "mongo",
  composeProjectName: "maintainpro-e2e-ci-123"
});
check("RECOVERY-SAFE-001", good.ok, "safe fresh-target accepted");

const drop = validateRecoveryTarget({ ...good, dropFlag: true, e2eTestMode: "true", recoveryRehearsal: "true", runId: "ci-123", sourceDatabase: "maintainpro_e2e_primary", targetDatabase: "maintainpro_restore_ci_123", host: "mongo", composeProjectName: "maintainpro-e2e-ci-123", dropFlag: true });
check("RECOVERY-SAFE-002", !drop.ok, "drop rejected");

const same = validateRecoveryTarget({
  e2eTestMode: "true", recoveryRehearsal: "true", runId: "ci-123",
  sourceDatabase: "maintainpro_e2e_primary", targetDatabase: "maintainpro_e2e_primary",
  host: "mongo", composeProjectName: "maintainpro-e2e-ci-123"
});
check("RECOVERY-SAFE-004", !same.ok, "source=target rejected");

const prod = validateRecoveryTarget({
  e2eTestMode: "true", recoveryRehearsal: "true", runId: "ci-123",
  sourceDatabase: "maintainpro_e2e_primary", targetDatabase: "nelna",
  host: "mongo", composeProjectName: "maintainpro-e2e-ci-123"
});
check("RECOVERY-SAFE-005", !prod.ok, "production DB target rejected");

check("RECOVERY-SAFE-006", hostnameCategory("8.8.8.8") === "public_ip", "public host rejected category");

const hazards = detectRecoveryHazards("mongorestore --archive=x --drop");
check("RECOVERY-SAFE-002b", hazards.some((h) => h.id === "mongorestore-drop"), "hazard detect --drop");

const hazards2 = detectRecoveryHazards("db.dropDatabase()");
check("RECOVERY-SAFE-003", hazards2.some((h) => h.id === "db.dropDatabase" || h.id === "dropDatabase"), "dropDatabase hazard");

const hazards3 = detectRecoveryHazards("docker volume rm foo");
check("RECOVERY-SAFE-007", hazards3.some((h) => h.id === "volume-rm"), "volume rm hazard");

const hazards4 = detectRecoveryHazards("mc rb local/bucket");
check("RECOVERY-SAFE-008", hazards4.some((h) => h.id === "mc-rb"), "mc rb hazard");

const manifest = buildSafeManifest({
  backupId: "b1", runId: "r1", createdAt: new Date().toISOString(),
  sourceDatabaseAlias: "e2e_primary", archiveChecksum: sha256Buffer(Buffer.from("x")),
  archiveSizeBytes: 1, collectionCount: 1, collectionDocumentCounts: { Tenant: 1 }
});
check("MANIFEST-001", assertManifestSafe(manifest).ok, "safe manifest");
check("MANIFEST-002", manifest.productionApproved === false, "productionApproved false");
check("MANIFEST-003", !assertManifestSafe({ ...manifest, leak: "mongodb://u:p@host/db" }).ok, "uri rejected");

check("DOCS-001", existsSync(path.join(root, "docs/remediation/BACKUP_AND_RECOVERY_ARCHITECTURE.md")), "architecture doc");
check("DOCS-002", existsSync(path.join(root, "docs/remediation/REPLICATION_AND_BACKUP_SEPARATION.md")), "replication separation doc");
check("DOCS-003", existsSync(path.join(root, "docs/remediation/DISASTER_RECOVERY_RUNBOOK.md")), "runbook doc");

const restoreSrc = readFileSync(path.join(root, "scripts/recovery/restore-mongo-backup.mjs"), "utf8");
check("RESTORE-001", !/mongorestore[\s\S]{0,240}--drop\b/.test(restoreSrc), "restore has no mongorestore --drop");
check("RESTORE-002", /maintainpro_restore_/.test(restoreSrc) || restoreSrc.includes("validateRecoveryTarget"), "restore uses safety guard");

if (failed) process.exit(1);
console.log("\nAll recovery contract selftests passed.");
