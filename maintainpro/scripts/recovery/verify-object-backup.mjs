#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectRecoveryHazards } from "./lib/recovery-safety.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const workDir =
  process.env.RECOVERY_WORK_DIR ||
  path.join(root, "artifacts", "recovery-tmp", process.env.E2E_RUN_ID || "local");
const files = readdirSync(workDir).filter((f) => f.endsWith(".objects.json"));
if (!files.length) {
  console.log("DR-OBJECT-001=FAIL");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(path.join(workDir, files[files.length - 1]), "utf8"));
if (!manifest.objectCount || !manifest.objects?.length) {
  console.log("DR-OBJECT-001=FAIL");
  process.exit(1);
}
console.log("DR-OBJECT-001=PASS");

// Structural: recovery scripts must not contain bucket deletion commands
const scripts = [
  "create-object-backup.mjs",
  "restore-object-backup.mjs",
  "verify-object-backup.mjs"
];
for (const s of scripts) {
  const raw = readFileSync(path.join(__dirname, s), "utf8");
  const hits = detectRecoveryHazards(raw).filter((h) =>
    ["mc-rm", "mc-rb", "mc-mirror-remove"].includes(h.id)
  );
  if (hits.length) {
    console.log("DR-OBJECT-007=FAIL");
    process.exit(1);
  }
}
console.log("DR-OBJECT-007=PASS");
console.log("object_verify_status=pass");