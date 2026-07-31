#!/usr/bin/env node
import {
  assertAllE2eGuards,
  loadE2eEnvOnly
} from "./lib/e2e-guards.mjs";

loadE2eEnvOnly();
const identity = assertAllE2eGuards({ requireRunId: true });
console.log("PASS e2e isolation");
console.log(`databaseName=${identity.databaseName}`);
console.log(`host=${identity.host}`);
console.log(`compose=${process.env.COMPOSE_PROJECT_NAME}`);
console.log(`baseHost=${new URL(process.env.E2E_BASE_URL).hostname}`);