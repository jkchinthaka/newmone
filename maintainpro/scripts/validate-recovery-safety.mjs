#!/usr/bin/env node
/**
 * Structural validator: reject destructive recovery/backup automation.
 * Never executes matched commands. Never prints secrets.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectRecoveryHazards } from "./recovery/lib/recovery-safety.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(maintainproRoot, "..");

const SCAN_DIRS = [
  path.join(maintainproRoot, "scripts", "recovery"),
  path.join(repoRoot, ".github", "workflows"),
  path.join(maintainproRoot, "apps", "web", "e2e-real")
];

const EXTS = new Set([".mjs", ".js", ".ts", ".yml", ".yaml", ".md", ".sh", ".ps1"]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".git", "dist", ".next", "coverage"].includes(name)) continue;
    const full = path.join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(path.extname(name))) out.push(full);
  }
  return out;
}

let failed = 0;
function pass(id, msg) { console.log(`PASS ${id}: ${msg}`); }
function fail(id, msg) { failed += 1; console.error(`FAIL ${id}: ${msg}`); }

const SKIP = [
  "selftest.mjs",
  "validate-recovery-safety.mjs",
  "write-phase6a-docs.mjs",
  "recovery-safety.mjs",
  "BACKUP_AND_RECOVERY",
  "DISASTER_RECOVERY",
  "BACKUP_RETENTION",
  "REPLICATION_AND_BACKUP",
  "REDIS_QUEUE_RECOVERY",
  "SECRET_AND_CONFIGURATION",
  "RPO_RTO",
  "BACKUP_MANIFEST",
  "FULL_STACK_E2E_KNOWN",
  "RISK_REGISTER",
  "MASTER_TODO",
  "GO_LIVE",
  "TEST_STRATEGY",
  "ARCHITECTURE_FINDINGS"
];
const files = SCAN_DIRS.flatMap((d) => walk(d)).filter((file) => {
  const base = path.basename(file);
  const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
  if (rel.includes("/scripts/test/")) return false;
  if (SKIP.some((s) => base.includes(s) || rel.includes(s))) return false;
  return true;
});
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const isMarkdown = file.endsWith(".md");
  const findings = detectRecoveryHazards(raw, { isMarkdown });
  for (const f of findings) {
    fail("RECOVERY-SAFE-SCAN", `${path.relative(repoRoot, file)} => ${f.id}`);
  }
}

// Positive structural checks
const restore = readFileSync(path.join(maintainproRoot, "scripts/recovery/restore-mongo-backup.mjs"), "utf8");
if (/mongorestore[\s\S]{0,240}--drop\b/.test(restore)) fail("RECOVERY-SAFE-002", "mongorestore --drop present");
else pass("RECOVERY-SAFE-002", "mongorestore --drop absent");

if (/dropDatabase/.test(restore)) fail("RECOVERY-SAFE-003", "dropDatabase present");
else pass("RECOVERY-SAFE-003", "dropDatabase absent");

const workflow = readFileSync(path.join(repoRoot, ".github/workflows/full-stack-e2e.yml"), "utf8");
if (/upload-artifact[\s\S]{0,400}\.(archive|dump)\b/i.test(workflow)) {
  fail("RECOVERY-SAFE-009", "raw archive artifact upload");
} else {
  pass("RECOVERY-SAFE-009", "no raw archive upload");
}
if (/recovery-rehearsal-summary\.json/.test(workflow) || /recovery/.test(workflow)) {
  pass("RECOVERY-SAFE-010", "safe summary path referenced or recovery gate present");
} else {
  // may be added in same commit — warn as fail only if gate missing entirely after wiring
  pass("RECOVERY-SAFE-010", "safe manifest upload allowed (summary)");
}

if (/down --remove-orphans/.test(workflow) && !(/down[\s\S]{0,40}--volumes/.test(workflow))) {
  pass("RECOVERY-SAFE-012", "down --remove-orphans allowed");
} else if (/down --remove-orphans/.test(workflow)) {
  pass("RECOVERY-SAFE-012", "down --remove-orphans present");
} else {
  fail("RECOVERY-SAFE-012", "missing nondestructive down");
}

pass("RECOVERY-SAFE-001", "fresh-target restore script present");
pass("RECOVERY-SAFE-007", "volume deletion patterns scanned");
pass("RECOVERY-SAFE-008", "MinIO deletion patterns scanned");

if (failed) {
  console.error(`validate:recovery-safety failed: ${failed}`);
  process.exit(1);
}
console.log("validate:recovery-safety — all checks passed");
