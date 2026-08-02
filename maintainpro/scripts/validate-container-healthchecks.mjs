#!/usr/bin/env node
/**
 * Structural validation of Compose/Dockerfile healthchecks.
 * Fixture-only — never reads real .env.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");

let failed = 0;
function pass(id, detail) {
  console.log(`PASS ${id}: ${detail}`);
}
function fail(id, detail) {
  failed += 1;
  console.error(`FAIL ${id}: ${detail}`);
}

function read(rel) {
  return readFileSync(path.join(maintainproRoot, rel), "utf8");
}

function stripComments(text) {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

console.log("validate:container-healthchecks — structural checks only");

const healthScript = path.join(maintainproRoot, "scripts/container-http-healthcheck.cjs");
if (!existsSync(healthScript)) {
  fail("HEALTH-VAL-001", "scripts/container-http-healthcheck.cjs missing");
} else {
  pass("HEALTH-VAL-001", "container-http-healthcheck.cjs present");
}

const base = stripComments(read("docker-compose.yml"));
const e2e = stripComments(read("docker-compose.e2e.yml"));
const apiDocker = read("apps/api/Dockerfile");
const webDocker = read("apps/web/Dockerfile");

function serviceBlock(text, name) {
  const re = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:|\\nvolumes:|\\nnetworks:|$)`);
  const m = text.match(re);
  return m ? m[0] : "";
}
function healthcheckBlock(serviceText) {
  const m = serviceText.match(/healthcheck:\n([\s\S]*?)(?=\n    [a-z]|\n  [a-z]|$)/);
  return m ? m[0] : "";
}

const apiHcBase = healthcheckBlock(serviceBlock(base, "api"));
const apiHcE2e = healthcheckBlock(serviceBlock(e2e, "api"));
const webHcBase = healthcheckBlock(serviceBlock(base, "web"));
const webHcE2e = healthcheckBlock(serviceBlock(e2e, "web"));

const apiHcUsesWget = /\b(wget|curl)\b/.test(apiHcBase) || /\b(wget|curl)\b/.test(apiHcE2e);
if (apiHcUsesWget) {
  fail("HEALTH-VAL-002", "API healthcheck must not use wget/curl");
} else {
  pass("HEALTH-VAL-002", "API healthcheck avoids wget/curl");
}

if (!base.includes("container-http-healthcheck.cjs") || !base.includes("/api/health/live")) {
  fail("HEALTH-VAL-003", "Base compose API healthcheck must call /api/health/live via Node script");
} else {
  pass("HEALTH-VAL-003", "Base compose API uses Node health script for /api/health/live");
}

if (!/healthcheck:[\s\S]*?127\.0\.0\.1[\s\S]*?\/api\/health\/live/.test(base)) {
  fail("HEALTH-VAL-004", "API healthcheck must target container loopback 127.0.0.1");
} else {
  pass("HEALTH-VAL-004", "API healthcheck uses loopback");
}

const webHcUsesWget = /\b(wget|curl)\b/.test(webHcBase) || /\b(wget|curl)\b/.test(webHcE2e);
if (webHcUsesWget) {
  fail("HEALTH-VAL-005", "Web healthcheck must not use wget/curl");
} else {
  pass("HEALTH-VAL-005", "Web healthcheck avoids wget/curl");
}

if (!/healthcheck:[\s\S]*?\/login/.test(base)) {
  fail("HEALTH-VAL-006", "Web healthcheck must probe /login");
} else {
  pass("HEALTH-VAL-006", "Web healthcheck probes /login");
}

if (!/nginx:[\s\S]*?healthcheck:[\s\S]*?\/api\/health\/live/.test(base)) {
  fail("HEALTH-VAL-007", "Nginx healthcheck must probe /api/health/live");
} else {
  pass("HEALTH-VAL-007", "Nginx healthcheck probes proxied /api/health/live");
}

if (!e2e.includes("127.0.0.1:${E2E_HTTP_PORT:-18080}:80")) {
  fail("HEALTH-VAL-008", "E2E Nginx must bind 127.0.0.1 only");
} else {
  pass("HEALTH-VAL-008", "E2E Nginx loopback bind present");
}

const apiHc = base.match(/api:[\s\S]*?healthcheck:[\s\S]*?(?=\n    restart:|\n  web:)/)?.[0] || "";
const timingOk =
  apiHc.includes("interval:") &&
  apiHc.includes("timeout:") &&
  apiHc.includes("retries:") &&
  apiHc.includes("start_period:");
if (timingOk) {
  pass("HEALTH-VAL-009", "API healthcheck has interval/timeout/retries/start_period");
} else {
  fail("HEALTH-VAL-009", "API healthcheck missing timing fields");
}

if (!apiDocker.includes("container-http-healthcheck.cjs")) {
  fail("HEALTH-VAL-010", "API Dockerfile must copy container-http-healthcheck.cjs");
} else {
  pass("HEALTH-VAL-010", "API image includes healthcheck script");
}

if (!webDocker.includes("container-http-healthcheck.cjs")) {
  fail("HEALTH-VAL-011", "Web Dockerfile must copy container-http-healthcheck.cjs");
} else {
  pass("HEALTH-VAL-011", "Web image includes healthcheck script");
}

if (/apk add[^\n]*wget/.test(apiDocker) || /apk add[^\n]*wget/.test(webDocker)) {
  fail("HEALTH-VAL-012", "API/Web images must not install wget solely for healthchecks");
} else {
  pass("HEALTH-VAL-012", "API/Web images do not apk-add wget for healthchecks");
}

const forbiddenHosts = ["nelnafarm", "20.15."];
const e2eLower = e2e.toLowerCase();
if (forbiddenHosts.some((h) => e2eLower.includes(h.toLowerCase()))) {
  fail("HEALTH-VAL-013", "E2E health/config must not reference production hosts");
} else {
  pass("HEALTH-VAL-013", "No production host/IP in E2E compose");
}

const hcChunks = base.split("healthcheck:");
const badEnv = hcChunks
  .slice(1)
  .some((chunk) => /printenv|echo\s+\$\{?MONGO|echo\s+\$\{?JWT/.test(chunk.slice(0, 400)));
if (badEnv) {
  fail("HEALTH-VAL-014", "Healthcheck must not print environment values");
} else {
  pass("HEALTH-VAL-014", "Healthchecks do not dump env values");
}

if (!base.includes("condition: service_healthy")) {
  fail("HEALTH-VAL-015", "Compose must use service_healthy dependency gates");
} else {
  pass("HEALTH-VAL-015", "service_healthy dependency gates present");
}

if (failed > 0) {
  console.error(`Summary: ${failed} failed`);
  process.exit(1);
}
console.log("Summary: all container healthcheck checks passed");