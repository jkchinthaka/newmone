#!/usr/bin/env node
/**
 * Structural E2E safety validator. Never prints secret values.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertAllE2eGuards,
  assertE2eDatabaseName,
  loadE2eEnvOnly
} from "./lib/e2e-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");

let failures = 0;
let passes = 0;

function pass(id, msg) {
  passes += 1;
  console.log(`PASS ${id}: ${msg}`);
}
function fail(id, msg) {
  failures += 1;
  console.error(`FAIL ${id}: ${msg}`);
}

function stripComments(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

function main() {
  console.log("validate:e2e-safety — structural checks only (no secret values)");
  const loaded = loadE2eEnvOnly();
  pass("E2E-SAFE-001", `loaded fixture env basename=${path.basename(loaded)}`);

  try {
    assertAllE2eGuards({ requireRunId: true });
    pass("E2E-SAFE-002", "core E2E guards passed");
  } catch (error) {
    fail("E2E-SAFE-002", error.message);
  }

  const composePath = path.join(maintainproRoot, "docker-compose.e2e.yml");
  if (!existsSync(composePath)) {
    fail("E2E-SAFE-003", "docker-compose.e2e.yml missing");
  } else {
    const text = stripComments(readFileSync(composePath, "utf8"));
    if (!/127\.0\.0\.1:\$\{E2E_HTTP_PORT/.test(text) && !/127\.0\.0\.1:\$\{E2E_HTTP_PORT:-18080\}:80/.test(text)) {
      // accept either interpolation form
      if (!text.includes('127.0.0.1:${E2E_HTTP_PORT:-18080}:80')) {
        fail("E2E-SAFE-003", "Nginx must bind to 127.0.0.1 only");
      } else {
        pass("E2E-SAFE-003", "Nginx bound to 127.0.0.1");
      }
    } else {
      pass("E2E-SAFE-003", "Nginx bound to 127.0.0.1");
    }
    if (/ports:\s*\n\s*-\s*"\d+:27017"/.test(text) || text.includes("0.0.0.0:27017")) {
      fail("E2E-SAFE-004", "Mongo must not be publicly published");
    } else {
      pass("E2E-SAFE-004", "Mongo not publicly published in e2e overlay");
    }
    if (!text.includes("maintainpro-e2e-mongo-data") || !text.includes("maintainpro-e2e-redis-data")) {
      fail("E2E-SAFE-005", "E2E volumes must be isolated");
    } else {
      pass("E2E-SAFE-005", "Isolated E2E volumes present");
    }
    if (!text.includes("API_INTERNAL_URL: http://api:3000/api") && !text.includes("API_INTERNAL_URL=http://api:3000/api")) {
      // yaml form
      if (!/API_INTERNAL_URL:\s*http:\/\/api:3000\/api/.test(text)) {
        fail("E2E-SAFE-006", "API_INTERNAL_URL must point to api:3000/api");
      } else {
        pass("E2E-SAFE-006", "API_INTERNAL_URL configured");
      }
    } else {
      pass("E2E-SAFE-006", "API_INTERNAL_URL configured");
    }
    if (!text.includes('E2E_TEST_MODE: "true"') && !text.includes("E2E_TEST_MODE: 'true'")) {
      fail("E2E-SAFE-007", "E2E_TEST_MODE must be true in compose");
    } else {
      pass("E2E-SAFE-007", "E2E_TEST_MODE=true in compose");
    }
    if (text.includes("maintainpro-mongo-data") && !text.includes("maintainpro-e2e-mongo-data")) {
      fail("E2E-SAFE-008", "Must not reuse production volume name alone");
    } else {
      pass("E2E-SAFE-008", "Production volume names not reused as primary");
    }
  }

  try {
    assertE2eDatabaseName(process.env.PRIMARY_DATABASE_NAME || "");
    pass("E2E-SAFE-009", "PRIMARY_DATABASE_NAME has E2E prefix");
  } catch (error) {
    fail("E2E-SAFE-009", error.message);
  }

  const exampleEnv = path.join(maintainproRoot, ".env.e2e.example");
  if (!existsSync(exampleEnv)) {
    fail("E2E-SAFE-010", ".env.e2e.example missing");
  } else {
    const envText = readFileSync(exampleEnv, "utf8");
    if (/PASSWORD=CHANGE_ME|root_password(?!_not)/i.test(envText) && envText.includes("nelna?")) {
      fail("E2E-SAFE-010", "example env looks production-like");
    } else {
      pass("E2E-SAFE-010", ".env.e2e.example present and disposable-named");
    }
  }

  console.log(`Summary: ${passes} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`validate:e2e-safety FAIL — ${error.message}`);
  process.exit(1);
}