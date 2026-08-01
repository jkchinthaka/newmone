#!/usr/bin/env node
/**
 * Structural validation for E2E env template final newline and workflow append safety.
 * Never prints secret values or full env-file contents.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const {
  assertExampleEndsWithLf,
  parseAssignmentLines,
  valueLooksConcatenated,
  validateWorkflowAppendSafety,
  endsWithLf
} = require("./lib/e2e-env-materialize.cjs");

let failures = 0;
let passes = 0;

function pass(id, detail) {
  passes += 1;
  console.log(`PASS ${id}: ${detail}`);
}

function fail(id, detail) {
  failures += 1;
  console.error(`FAIL ${id}: ${detail}`);
}

const examplePath = path.join(maintainproRoot, ".env.e2e.example");
if (!existsSync(examplePath)) {
  fail("E2E-NL-SAFE-001", ".env.e2e.example missing");
} else {
  try {
    assertExampleEndsWithLf(examplePath);
    pass("E2E-NL-SAFE-001", "E2E environment template final newline: PASS");
  } catch (error) {
    fail("E2E-NL-SAFE-001", error.message);
  }

  const buf = readFileSync(examplePath);
  const text = buf.toString("utf8");
  const parsed = parseAssignmentLines(text);
  const domain = parsed.map.get("E2E_SEED_EMAIL_DOMAIN");
  if (domain !== "e2e.maintainpro.test" || valueLooksConcatenated(domain || "")) {
    fail("E2E-NL-SAFE-002", "E2E_SEED_EMAIL_DOMAIN assignment is malformed");
  } else {
    pass("E2E-NL-SAFE-002", "E2E_SEED_EMAIL_DOMAIN is a single clean assignment");
  }

  if (!endsWithLf(buf)) {
    fail("E2E-NL-SAFE-003", "template buffer does not end with LF");
  } else {
    pass("E2E-NL-SAFE-003", "template ends with LF");
  }
}

const workflowPath = path.join(maintainproRoot, "..", ".github", "workflows", "full-stack-e2e.yml");
if (!existsSync(workflowPath)) {
  fail("E2E-NL-SAFE-004", "full-stack-e2e.yml missing");
} else {
  const wf = readFileSync(workflowPath, "utf8");
  const { fragile, usesMaterialize, ok } = validateWorkflowAppendSafety(wf);
  if (!ok) {
    fail(
      "E2E-NL-SAFE-004",
      `fragile=${fragile} usesMaterialize=${usesMaterialize}`
    );
  } else {
    pass("E2E-NL-SAFE-004", "E2E runtime append boundary: PASS");
  }
}

console.log(`Summary: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("E2E materialized variable separation checks: PASS");
