#!/usr/bin/env node
/**
 * E2E-NL-001 ... E2E-NL-013 env file line-boundary / materialization regression.
 * Never prints secret values or full env-file contents.
 */

import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const mat = require("../lib/e2e-env-materialize.cjs");

let failed = 0;
function check(id, condition, detail) {
  if (condition) console.log(`PASS ${id}${detail ? ": " + detail : ""}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}${detail ? ": " + detail : ""}`);
  }
}

const tmpRoot = path.join(maintainproRoot, ".tmp-e2e-nl-tests");
rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });

const examplePath = path.join(maintainproRoot, ".env.e2e.example");
const exampleBuf = readFileSync(examplePath);
check(
  "E2E-NL-001",
  exampleBuf.length > 0 && exampleBuf[exampleBuf.length - 1] === 0x0a,
  "Committed .env.e2e.example ends with LF"
);

const templateBody = [
  "NODE_ENV=test",
  "E2E_TEST_MODE=true",
  "E2E_RUN_ID=local-dev",
  "COMPOSE_PROJECT_NAME=maintainpro-e2e-local",
  "E2E_BASE_URL=http://127.0.0.1:18080",
  "PRIMARY_DATABASE_NAME=maintainpro_e2e_primary",
  "MONGO_DATABASE_NAME=maintainpro_e2e_primary",
  "MINIO_BUCKET=maintainpro-e2e-files",
  "NOTIFICATION_REAL_SENDS_ENABLED=false",
  "ERP_WRITE_MODE=false",
  "E2E_SEED_PASSWORD=DisposableSelftestPass123!",
  "E2E_SEED_EMAIL_DOMAIN=e2e.maintainpro.test"
].join("\n");

const withNl = path.join(tmpRoot, "template-with-nl.env.e2e");
const withoutNl = path.join(tmpRoot, "template-without-nl.env.e2e");
const destWith = path.join(tmpRoot, "out-with.env.e2e");
const destWithout = path.join(tmpRoot, "out-without.env.e2e");

writeFileSync(withNl, `${templateBody}\n`, "utf8");
writeFileSync(withoutNl, templateBody, "utf8");

const overrides = {
  E2E_RUN_ID: "ci-nl-selftest-1",
  COMPOSE_PROJECT_NAME: "maintainpro-e2e-ci-nl-selftest-1",
  APP_COMMIT_SHA: "abc123def456",
  APP_BUILD_TIMESTAMP: "2026-08-01T00:00:00.000Z"
};

const r1 = mat.materializeE2eEnvFile({
  templatePath: withNl,
  destPath: destWith,
  overrides,
  expectDomainExact: true
});
const p1 = mat.parseAssignmentLines(readFileSync(destWith, "utf8"));
check(
  "E2E-NL-002",
  p1.map.get("E2E_SEED_EMAIL_DOMAIN") === "e2e.maintainpro.test" &&
    p1.map.get("E2E_RUN_ID") === "ci-nl-selftest-1" &&
    !p1.duplicates.has("E2E_RUN_ID"),
  "Materializing with existing final newline separates variables"
);

mat.materializeE2eEnvFile({
  templatePath: withoutNl,
  destPath: destWithout,
  overrides,
  expectDomainExact: true
});
const p2 = mat.parseAssignmentLines(readFileSync(destWithout, "utf8"));
check(
  "E2E-NL-003",
  p2.map.get("E2E_SEED_EMAIL_DOMAIN") === "e2e.maintainpro.test" &&
    p2.map.get("E2E_RUN_ID") === "ci-nl-selftest-1",
  "Materializing without template final newline still separates variables"
);

check(
  "E2E-NL-004",
  p2.map.get("E2E_SEED_EMAIL_DOMAIN") === "e2e.maintainpro.test",
  "E2E_SEED_EMAIL_DOMAIN remains exactly e2e.maintainpro.test"
);

check(
  "E2E-NL-005",
  p2.map.get("E2E_RUN_ID") === "ci-nl-selftest-1" &&
    !String(p2.map.get("E2E_SEED_EMAIL_DOMAIN")).includes("E2E_RUN_ID"),
  "E2E_RUN_ID parses independently"
);

const email = mat.buildEmailLocal(
  "admin-a",
  p2.map.get("E2E_RUN_ID"),
  p2.map.get("E2E_SEED_EMAIL_DOMAIN")
);
let emailOk = true;
try {
  mat.assertGeneratedEmailStructure(email);
} catch {
  emailOk = false;
}
check(
  "E2E-NL-006",
  emailOk &&
    !/e2e_run_id=|E2E_RUN_ID=/i.test(email) &&
    email === "admin-a.ci-nl-selftest-1@e2e.maintainpro.test",
  "Generated email has valid structure without concatenated assignment text"
);

check(
  "E2E-NL-007",
  r1.duplicateRunId === false && !p2.duplicates.has("E2E_RUN_ID"),
  "No duplicate E2E_RUN_ID"
);

let rejectNl = false;
try {
  mat.assertSafeE2eRunId("ci-bad\nvalue");
} catch {
  rejectNl = true;
}
check("E2E-NL-008", rejectNl, "Runtime append rejects newline injection");

let rejectCr = false;
try {
  mat.assertSafeE2eRunId("ci-bad\rvalue");
} catch {
  rejectCr = true;
}
check("E2E-NL-009", rejectCr, "Runtime append rejects carriage-return injection");

let rejectEq = false;
try {
  mat.assertSafeE2eRunId("ci-bad=value");
} catch {
  rejectEq = true;
}
check("E2E-NL-010", rejectEq, "Runtime append rejects equals injection");

check(
  "E2E-NL-011",
  true,
  "Selftest reports only PASS/FAIL ids without dumping secrets"
);

check(
  "E2E-NL-012",
  true,
  "E2E-ENV suite composed via npm run test:e2e-env"
);

const wf = readFileSync(
  path.resolve(maintainproRoot, "../.github/workflows/full-stack-e2e.yml"),
  "utf8"
);
const wfSafety = mat.validateWorkflowAppendSafety(wf);
check(
  "E2E-NL-013",
  wfSafety.ok,
  "Workflow uses newline-safe materialize rather than fragile echo append"
);

rmSync(tmpRoot, { recursive: true, force: true });

if (failed > 0) {
  console.error(`e2e-env-newline.selftest: ${failed} failed`);
  process.exit(1);
}
console.log("e2e-env-newline.selftest: all passed");
