#!/usr/bin/env node
/**
 * E2E-ENV-001 ... E2E-ENV-015 regression tests.
 * Uses temporary fixtures under maintainpro/.tmp-e2e-env-tests (gitignored).
 * Never reads the real production .env.
 */

import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const loaderPath = path.join(maintainproRoot, "scripts/lib/e2e-environment.cjs");

let failed = 0;
function check(id, condition, detail) {
  if (condition) console.log(`PASS ${id}${detail ? ": " + detail : ""}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}${detail ? ": " + detail : ""}`);
  }
}

function freshLoader() {
  delete require.cache[require.resolve(loaderPath)];
  return require(loaderPath);
}

const tmpRoot = path.join(maintainproRoot, ".tmp-e2e-env-tests");
rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });

function writeFixture(name, lines) {
  const file = path.join(tmpRoot, name);
  writeFileSync(file, lines.join("\n") + "\n", "utf8");
  return file;
}

const baseLines = [
  "NODE_ENV=test",
  "E2E_TEST_MODE=true",
  "E2E_RUN_ID=env-selftest-1",
  "COMPOSE_PROJECT_NAME=maintainpro-e2e-selftest",
  "E2E_BASE_URL=http://127.0.0.1:18080",
  "PRIMARY_DATABASE_NAME=maintainpro_e2e_primary",
  "MONGO_DATABASE_NAME=maintainpro_e2e_primary",
  "MINIO_BUCKET=maintainpro-e2e-files",
  "NOTIFICATION_REAL_SENDS_ENABLED=false",
  "ERP_WRITE_MODE=false",
  "E2E_SEED_PASSWORD=DisposableSelftestPass123!"
];

const goodFile = writeFixture(".env.e2e", baseLines);

// Isolate process env keys we care about for each test via child processes.
function runInChild(fnBody, envExtra = {}) {
  const script = `
    const loader = require(${JSON.stringify(loaderPath)});
    loader.__resetE2eEnvironmentLoaderForTests();
    ${fnBody}
  `;
  const tmp = path.join(tmpRoot, `child-${Date.now()}-${Math.random()}.cjs`);
  writeFileSync(tmp, script, "utf8");
  const env = { ...process.env, ...envExtra };
  // Clear keys that must come from file unless explicitly set in envExtra
  for (const k of [
    "E2E_SEED_PASSWORD",
    "NODE_ENV",
    "E2E_TEST_MODE",
    "E2E_RUN_ID",
    "COMPOSE_PROJECT_NAME",
    "E2E_BASE_URL",
    "PRIMARY_DATABASE_NAME",
    "MONGO_DATABASE_NAME",
    "MINIO_BUCKET",
    "MAINTAINPRO_E2E_ENV_FILE",
    "NOTIFICATION_REAL_SENDS_ENABLED",
    "ERP_WRITE_MODE"
  ]) {
    if (!(k in envExtra)) delete env[k];
  }
  const r = spawnSync(process.execPath, [tmp], { encoding: "utf8", env, cwd: maintainproRoot });
  return r;
}

{
  const r = runInChild(
    `loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(goodFile)} });
     if (!(process.env.E2E_SEED_PASSWORD || "").trim()) process.exit(2);
     process.exit(0);`,
    { MAINTAINPRO_E2E_ENV_FILE: goodFile }
  );
  check("E2E-ENV-001", r.status === 0, "Approved .env.e2e file is loaded");
}

{
  const r = runInChild(
    `loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(goodFile)} });
     if (process.env.E2E_SEED_PASSWORD !== "FROM_PROCESS") process.exit(2);
     process.exit(0);`,
    {
      MAINTAINPRO_E2E_ENV_FILE: goodFile,
      E2E_SEED_PASSWORD: "FROM_PROCESS",
      NODE_ENV: "test",
      E2E_TEST_MODE: "true",
      E2E_RUN_ID: "env-selftest-1",
      COMPOSE_PROJECT_NAME: "maintainpro-e2e-selftest",
      E2E_BASE_URL: "http://127.0.0.1:18080",
      PRIMARY_DATABASE_NAME: "maintainpro_e2e_primary",
      MINIO_BUCKET: "maintainpro-e2e-files"
    }
  );
  check("E2E-ENV-002", r.status === 0, "Explicit process env takes precedence");
}

{
  const noPass = writeFixture(
    ".env.e2e-nopass",
    baseLines.filter((l) => !l.startsWith("E2E_SEED_PASSWORD"))
  );
  // basename must be .env.e2e — use directory with approved name
  const dir = path.join(tmpRoot, "missing-pass");
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, ".env.e2e");
  writeFileSync(f, baseLines.filter((l) => !l.startsWith("E2E_SEED_PASSWORD")).join("\n") + "\n");
  const r = runInChild(
    `try {
       loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(f)} });
       process.exit(2);
     } catch (e) {
       const msg = String(e && e.message || e);
       if (!msg.includes("E2E_SEED_PASSWORD")) process.exit(3);
       if (msg.includes("Disposable") || msg.includes("SelftestPass")) process.exit(4);
       process.exit(0);
     }`,
    { MAINTAINPRO_E2E_ENV_FILE: f }
  );
  check("E2E-ENV-003", r.status === 0, "Missing E2E_SEED_PASSWORD fails before tests");
  check("E2E-ENV-005", r.status === 0, "Error contains variable name but not value");
}

{
  const dir = path.join(tmpRoot, "blank-pass");
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, ".env.e2e");
  writeFileSync(
    f,
    baseLines.map((l) => (l.startsWith("E2E_SEED_PASSWORD") ? "E2E_SEED_PASSWORD=" : l)).join("\n") + "\n"
  );
  const r = runInChild(
    `try {
       loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(f)} });
       process.exit(2);
     } catch (e) {
       process.exit(0);
     }`,
    { MAINTAINPRO_E2E_ENV_FILE: f }
  );
  check("E2E-ENV-004", r.status === 0, "Blank E2E_SEED_PASSWORD fails");
}

{
  const prod = path.join(tmpRoot, ".env.production");
  writeFileSync(prod, "NODE_ENV=production\n", "utf8");
  const r = runInChild(
    `try {
       loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(prod)} });
       process.exit(2);
     } catch (e) {
       process.exit(0);
     }`
  );
  check("E2E-ENV-006", r.status === 0, ".env.production is rejected");
}

{
  const outside = path.join(tmpRoot, "..", "..", "..", "outside-e2e.env");
  const r = runInChild(
    `try {
       loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(path.resolve(maintainproRoot, "../.env.e2e"))} });
       process.exit(2);
     } catch (e) {
       process.exit(0);
     }`
  );
  check("E2E-ENV-007", r.status === 0, "Path outside MaintainPro is rejected");
}

{
  const bad = writeFixture(".env.staging", baseLines);
  const r = runInChild(
    `try {
       loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(bad)} });
       process.exit(2);
     } catch (e) {
       process.exit(0);
     }`
  );
  check("E2E-ENV-008", r.status === 0, "Non-E2E file name is rejected");
}

{
  const dir = path.join(tmpRoot, "bad-mode");
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, ".env.e2e");
  writeFileSync(
    f,
    baseLines.map((l) => (l.startsWith("NODE_ENV") ? "NODE_ENV=production" : l)).join("\n") + "\n"
  );
  const r = runInChild(
    `try {
       loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(f)} });
       process.exit(2);
     } catch (e) {
       process.exit(0);
     }`,
    { MAINTAINPRO_E2E_ENV_FILE: f }
  );
  check("E2E-ENV-009", r.status === 0, "Incorrect NODE_ENV is rejected");
}

{
  const dir = path.join(tmpRoot, "bad-url");
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, ".env.e2e");
  writeFileSync(
    f,
    baseLines
      .map((l) => (l.startsWith("E2E_BASE_URL") ? "E2E_BASE_URL=https://example.com" : l))
      .join("\n") + "\n"
  );
  const r = runInChild(
    `try {
       loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(f)} });
       process.exit(2);
     } catch (e) {
       process.exit(0);
     }`,
    { MAINTAINPRO_E2E_ENV_FILE: f }
  );
  check("E2E-ENV-010", r.status === 0, "Non-loopback E2E_BASE_URL is rejected");
}

{
  const dir = path.join(tmpRoot, "bad-db");
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, ".env.e2e");
  writeFileSync(
    f,
    baseLines
      .map((l) =>
        l.startsWith("PRIMARY_DATABASE_NAME") || l.startsWith("MONGO_DATABASE_NAME")
          ? l.replace(/maintainpro_e2e_primary/g, "nelna")
          : l
      )
      .join("\n") + "\n"
  );
  const r = runInChild(
    `try {
       loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(f)} });
       process.exit(2);
     } catch (e) {
       process.exit(0);
     }`,
    { MAINTAINPRO_E2E_ENV_FILE: f }
  );
  check("E2E-ENV-011", r.status === 0, "Invalid database-name prefix is rejected");
}

{
  const r = runInChild(
    `loader.ensureE2eEnvironmentLoaded({ envFilePath: ${JSON.stringify(goodFile)} });
     const pw = (process.env.E2E_SEED_PASSWORD || "").trim();
     if (!pw) process.exit(2);
     process.exit(0);`,
    { MAINTAINPRO_E2E_ENV_FILE: goodFile }
  );
  check("E2E-ENV-012", r.status === 0, "Helper can resolve seed password after load");
}

{
  const wf = readFileSync(path.resolve(maintainproRoot, "../.github/workflows/full-stack-e2e.yml"), "utf8");
  const hasPath = wf.includes("MAINTAINPRO_E2E_ENV_FILE:") && wf.includes(".env.e2e");
  const hardcodesPassword =
    /E2E_SEED_PASSWORD:\s*\S+/.test(wf) ||
    /echo\s+[\"']?E2E_SEED_PASSWORD=/.test(wf) ||
    /GITHUB_ENV.*E2E_SEED_PASSWORD/.test(wf);
  check("E2E-ENV-013", hasPath && !hardcodesPassword, "Workflow passes file path only");
}

{
  const manifestScript = readFileSync(
    path.join(maintainproRoot, "scripts/generate-e2e-evidence-manifest.mjs"),
    "utf8"
  );
  check(
    "E2E-ENV-014",
    !manifestScript.includes("E2E_SEED_PASSWORD") &&
      manifestScript.includes("forbidden secret-like content"),
    "Evidence generation does not include seed password"
  );
}

{
  const authHelper = readFileSync(
    path.join(maintainproRoot, "apps/web/e2e-real/helpers/auth.ts"),
    "utf8"
  );
  const envHelper = readFileSync(
    path.join(maintainproRoot, "apps/web/e2e-real/helpers/env.ts"),
    "utf8"
  );
  const noBrowserExpose =
    !authHelper.includes("NEXT_PUBLIC_") &&
    !envHelper.includes("localStorage.setItem") &&
    authHelper.includes('localStorage.getItem("maintainpro_access_token")');
  check(
    "E2E-ENV-015",
    noBrowserExpose,
    "Password stays Node-side; browser storage checks tokens only"
  );
}

rmSync(tmpRoot, { recursive: true, force: true });

if (failed > 0) {
  console.error(`e2e-environment.selftest: ${failed} failed`);
  process.exit(1);
}
console.log("e2e-environment.selftest: all passed");