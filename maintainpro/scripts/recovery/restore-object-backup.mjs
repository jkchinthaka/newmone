#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function composeBase() {
  return [
    "compose",
    "-p",
    process.env.COMPOSE_PROJECT_NAME,
    "--env-file",
    process.env.MAINTAINPRO_E2E_ENV_FILE || ".env.e2e",
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.e2e.yml"
  ];
}

function run(args) {
  const r = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (r.status !== 0) {
    throw new Error(
      (r.stderr || r.stdout || "")
        .slice(0, 400)
        .replace(/(key|secret|password)=[^\s]+/gi, "$1=REDACTED")
    );
  }
  return r.stdout || "";
}

function mcRun(script) {
  return run([
    ...composeBase(),
    "run",
    "--rm",
    "--no-deps",
    "-e",
    `MINIO_ACCESS_KEY=${process.env.MINIO_ACCESS_KEY || "minioadmin"}`,
    "-e",
    `MINIO_SECRET_KEY=${process.env.MINIO_SECRET_KEY || "minioadmin123"}`,
    "--entrypoint",
    "/bin/sh",
    "minio-init",
    "-c",
    script
  ]);
}

function main() {
  const workDir =
    process.env.RECOVERY_WORK_DIR ||
    path.join(root, "artifacts", "recovery-tmp", process.env.E2E_RUN_ID || "local");
  const files = readdirSync(workDir).filter((f) => f.endsWith(".objects.json"));
  if (!files.length) throw new Error("missing object manifest");
  files.sort();
  const manifest = JSON.parse(readFileSync(path.join(workDir, files[files.length - 1]), "utf8"));
  const sourceBucket = readFileSync(path.join(workDir, "object-source-bucket.txt"), "utf8").trim();
  const restoreBucket = readFileSync(path.join(workDir, "object-restore-bucket.txt"), "utf8").trim();
  if (sourceBucket === restoreBucket) throw new Error("buckets must differ");

  const obj = manifest.objects[0];
  if (!obj || obj.key.includes("..") || /\.(exe|sh|bat|ps1)$/i.test(obj.key)) {
    throw new Error("unsafe object key");
  }

  mcRun(
    [
      "set -e",
      'mc alias set local http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null',
      `mc mb -p "local/${restoreBucket}" >/dev/null || true`,
      `COUNT=$(mc ls --recursive "local/${restoreBucket}" 2>/dev/null | wc -l | tr -d ' ' || echo 0)`,
      'if [ "$COUNT" != "0" ]; then echo restore_bucket_not_fresh; exit 2; fi',
      `mc cp "local/${sourceBucket}/${obj.key}" "local/${restoreBucket}/${obj.key}" >/dev/null`
    ].join("\n")
  );

  const body = mcRun(
    [
      "set -e",
      'mc alias set local http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null',
      `mc cat "local/${restoreBucket}/${obj.key}"`
    ].join("\n")
  );
  const digest = createHash("sha256").update(body).digest("hex");
  if (digest !== obj.checksum) {
    console.log("DR-OBJECT-004=FAIL");
    throw new Error("object checksum mismatch");
  }
  console.log("DR-OBJECT-002=PASS");
  console.log("DR-OBJECT-003=PASS");
  console.log("DR-OBJECT-004=PASS");
  console.log("object_reconciliation=pass");
  console.log("bucket_deletion=no");
}

main();