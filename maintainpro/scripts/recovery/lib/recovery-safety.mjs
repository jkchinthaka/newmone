/**
 * Shared recovery rehearsal safety helpers.
 * Never print URIs, passwords, or credentials.
 */

export const FORBIDDEN_DB_NAMES = new Set([
  "nelna",
  "bileeta_db",
  "admin",
  "config",
  "local",
  "maintainpro",
  "production",
  "prod"
]);

export const ALLOWED_HOSTS = new Set(["mongo", "localhost", "127.0.0.1"]);

export const CORE_COLLECTIONS = ["Tenant", "User", "Role", "Permission"];

export const REQUIRED_COLLECTIONS = [
  "Tenant",
  "User",
  "Role",
  "Permission",
  "WorkOrder",
  "WorkOrderAssignee",
  "SparePart",
  "StockMovement",
  "PartRequest",
  "PurchaseOrder",
  "PurchaseOrderLine",
  "PurchaseReceipt",
  "PurchaseReceiptLine",
  "AuditLog",
  "SecurityEvent",
  "ReplicationOutbox"
];

export function hostnameCategory(host) {
  const h = String(host || "").toLowerCase().split(":")[0];
  if (!h) return "blank";
  if (ALLOWED_HOSTS.has(h)) return "docker_internal_or_loopback";
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) && h !== "127.0.0.1") return "public_ip";
  if (/mongodb\.net|atlas|amazonaws|\.com$|\.net$/i.test(h)) return "remote_public";
  return "unapproved";
}

export function validateRecoveryTarget(input = {}) {
  const errors = [];
  const e2eMode = String(input.e2eTestMode ?? "").trim();
  const rehearsal = String(input.recoveryRehearsal ?? "").trim();
  const runId = String(input.runId ?? "").trim();
  const sourceDb = String(input.sourceDatabase ?? "").trim();
  const targetDb = String(input.targetDatabase ?? "").trim();
  const host = String(input.host ?? "").trim().toLowerCase().split(":")[0];
  const project = String(input.composeProjectName ?? "").trim();
  const dropFlag = Boolean(input.dropFlag);
  const resetFlag = Boolean(input.resetFlag);

  if (e2eMode !== "true") errors.push("E2E_TEST_MODE must be true");
  if (rehearsal !== "true") errors.push("RECOVERY_REHEARSAL must be true");
  if (!runId || !/^[a-zA-Z0-9._-]{3,64}$/.test(runId)) errors.push("E2E_RUN_ID invalid");
  if (!sourceDb.startsWith("maintainpro_e2e_")) errors.push("source database prefix invalid");
  if (!targetDb.startsWith("maintainpro_restore_")) errors.push("target database prefix invalid");
  if (sourceDb === targetDb) errors.push("source and target must differ");
  if (FORBIDDEN_DB_NAMES.has(sourceDb.toLowerCase()) || FORBIDDEN_DB_NAMES.has(targetDb.toLowerCase())) {
    errors.push("forbidden database name");
  }
  const hostCat = hostnameCategory(host);
  if (hostCat !== "docker_internal_or_loopback") errors.push(`host not allowed: ${hostCat}`);
  if (!project.startsWith("maintainpro-e2e-")) errors.push("compose project must start with maintainpro-e2e-");
  if (dropFlag) errors.push("drop flag is prohibited");
  if (resetFlag) errors.push("reset flag is prohibited");

  return {
    ok: errors.length === 0,
    errors,
    safe: {
      source_host_category: hostCat === "docker_internal_or_loopback" ? "docker_internal" : hostCat,
      source_database_safe: sourceDb.startsWith("maintainpro_e2e_") ? "yes" : "no",
      target_database_fresh: targetDb.startsWith("maintainpro_restore_") && sourceDb !== targetDb ? "yes" : "no",
      rehearsal_mode: rehearsal === "true" && e2eMode === "true" ? "yes" : "no"
    }
  };
}

export function assertManifestSafe(manifest) {
  const text = JSON.stringify(manifest ?? {});
  const forbidden = [
    /mongodb(\+srv)?:\/\//i,
    /password/i,
    /secret/i,
    /authorization/i,
    /MINIO_SECRET/i,
    /JWT_/i
  ];
  // Allow field names like encryptionStatus; reject credential-bearing values.
  if (/mongodb(\+srv)?:\/\//i.test(text)) return { ok: false, reason: "uri_leak" };
  if (/:"[^"]*(password|secret|token)=/i.test(text)) return { ok: false, reason: "credential_leak" };
  return { ok: true };
}

export function buildSafeManifest(partial) {
  return {
    schemaVersion: "1.0",
    backupId: partial.backupId,
    runId: partial.runId,
    createdAt: partial.createdAt,
    applicationCommit: partial.applicationCommit || "unknown",
    sourceDatabaseAlias: partial.sourceDatabaseAlias,
    archiveFormat: partial.archiveFormat || "mongodump-archive",
    compression: partial.compression || "gzip",
    checksumAlgorithm: "sha256",
    archiveChecksum: partial.archiveChecksum,
    archiveSizeBytes: partial.archiveSizeBytes,
    collectionCount: partial.collectionCount,
    collectionDocumentCounts: partial.collectionDocumentCounts || {},
    objectStorageManifestRef: partial.objectStorageManifestRef || null,
    toolVersions: partial.toolVersions || {},
    encryptionStatus: partial.encryptionStatus || "none_e2e",
    productionApproved: false,
    restoreTestRequired: true
  };
}

export function detectRecoveryHazards(raw, { isMarkdown = false } = {}) {
  let source = String(raw || "");
  if (isMarkdown) {
    // Strip Never/Prohibited/Do not sections (same idea as docker cleanup validator).
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let skipping = false;
    for (const line of lines) {
      const trimmed = line.trim();
      const heading =
        /^(#{1,6}\s+)?(\*\*)?(never|prohibited|forbidden|do not)\b/i.test(trimmed) ||
        /^(never|prohibited|forbidden|do not)\s*:/i.test(trimmed);
      if (heading) {
        skipping = true;
        continue;
      }
      if (skipping && /^#{1,6}\s+/.test(trimmed)) skipping = false;
      if (!skipping) out.push(line);
    }
    source = out.join("\n");
  }
  const flat = source.replace(/\\\s*\n/g, " ").replace(/\r\n/g, "\n");
  const findings = [];
  const rules = [
    { id: "mongorestore-drop", re: /mongorestore[\s\S]{0,200}--drop\b/i },
    { id: "dropDatabase", re: /\bdropDatabase\s*\(/i },
    { id: "db.dropDatabase", re: /\bdb\.dropDatabase\s*\(/i },
    { id: "prisma-reset", re: /prisma\s+migrate\s+reset|\bdb\s+reset\b/i },
    { id: "deleteMany-cleanup", re: /deleteMany\s*\(\s*\{\s*\}\s*\)/ },
    { id: "compose-down-v", re: /docker(?:\s+|-)compose[\s\S]{0,80}\bdown\b[\s\S]{0,40}(--volumes|-v)\b/i },
    { id: "volume-rm", re: /docker\s+volume\s+rm\b/i },
    { id: "volume-prune", re: /docker\s+volume\s+prune\b/i },
    { id: "system-prune", re: /docker\s+system\s+prune\b/i },
    { id: "mc-rm", re: /\bmc\s+rm\b/i },
    { id: "mc-rb", re: /\bmc\s+rb\b/i },
    { id: "mc-mirror-remove", re: /mc\s+mirror[\s\S]{0,40}--remove\b/i },
    { id: "raw-archive-upload", re: /upload-artifact[\s\S]{0,200}\.(archive|dump|gz|bson)\b/i },
    { id: "prod-db-target", re: /maintainpro_restore_(nelna|bileeta_db)\b|targetDatabase.*=.*['"]nelna['"]/i },
    { id: "set-x-credentials", re: /set\s+-x[\s\S]{0,80}(MONGO|PASSWORD|SECRET|DATABASE_URL)/i }
  ];
  for (const rule of rules) {
    if (rule.re.test(flat)) findings.push({ id: rule.id, match: rule.id });
  }
  return findings;
}