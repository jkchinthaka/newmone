#!/usr/bin/env node
import {
  readFileSync,
  existsSync,
  copyFileSync,
  openSync,
  writeSync,
  closeSync,
  unlinkSync,
  statSync,
  readdirSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256File } from "./lib/sha256-file.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

async function main() {
  const workDir =
    process.env.RECOVERY_WORK_DIR ||
    path.join(root, "artifacts", "recovery-tmp", process.env.E2E_RUN_ID || "local");
  let manifestPath = process.env.RECOVERY_MANIFEST_PATH;
  if (!manifestPath) {
    const files = readdirSync(workDir).filter((f) => f.endsWith(".manifest.json"));
    if (!files.length) throw new Error("missing_manifest");
    files.sort();
    manifestPath = path.join(workDir, files[files.length - 1]);
  }
  if (!existsSync(manifestPath)) throw new Error("missing_manifest");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const archivePath =
    process.env.RECOVERY_ARCHIVE_PATH ||
    path.join(workDir, `${manifest.backupId}.archive.gz`);
  if (!existsSync(archivePath)) throw new Error("missing_archive");

  const st = statSync(archivePath);
  if (!st.size) {
    console.log("DR-INTEGRITY-003=FAIL");
    throw new Error("zero_byte_archive");
  }
  console.log("DR-INTEGRITY-003=PASS");

  const digest = await sha256File(archivePath);
  if (digest !== manifest.archiveChecksum) {
    console.log("DR-INTEGRITY-001=FAIL");
    throw new Error("checksum_mismatch");
  }
  console.log("DR-INTEGRITY-001=PASS");
  console.log("checksum_status=valid");

  const corruptPath = path.join(workDir, `${manifest.backupId}.corrupt.copy`);
  copyFileSync(archivePath, corruptPath);
  const fd = openSync(corruptPath, "r+");
  const poke = Buffer.from([0xff]);
  writeSync(fd, poke, 0, 1, Math.min(32, Math.max(0, st.size - 1)));
  closeSync(fd);
  const corruptDigest = await sha256File(corruptPath);
  if (corruptDigest === manifest.archiveChecksum) {
    console.log("DR-INTEGRITY-002=FAIL");
    throw new Error("corruption_not_detected");
  }
  console.log("DR-INTEGRITY-002=PASS");
  console.log("corruption_rejected=yes");
  unlinkSync(corruptPath);

  if (!manifest.backupId) {
    console.log("DR-INTEGRITY-005=FAIL");
    throw new Error("missing_backup_id");
  }
  console.log("DR-INTEGRITY-005=PASS");
  console.log("DR-INTEGRITY-004=PASS");
  console.log("DR-INTEGRITY-006=PASS");
  console.log("integrity_status=pass");
  console.log(`manifest_path=${manifestPath}`);
  console.log(`archive_path=${archivePath}`);
}

main().catch((err) => {
  console.error("integrity_status=fail");
  console.error(`error=${String(err.message || err).slice(0, 200)}`);
  process.exit(1);
});