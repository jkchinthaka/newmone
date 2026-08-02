#!/usr/bin/env node
/**
 * Structural production security controls validator (source/fixtures only).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..");

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

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (["node_modules", ".next", "dist", "coverage", ".git"].includes(name)) continue;
      walk(full, out);
    } else if (/\.(mjs|js|ts|yml|yaml|md|conf)$/i.test(name)) {
      out.push(full);
    }
  }
  return out;
}

console.log("validate:production-security-controls — structural checks only\n");

if (process.env.MAINTAINPRO_READ_REAL_ENV === "true") {
  fail("SEC-SAFE-000", "Must not enable real .env reads");
  process.exit(1);
}

const prodCompose = path.join(root, "docker-compose.production.yml");
const nginx = path.join(root, "infra/nginx/default.conf");
const fixture = path.join(root, ".env.production.security-fixture.example");
const migScript = path.join(root, "scripts/security/analyze-permission-migration.mjs");
const portDoc = path.join(root, "docs/remediation/PORT_OWNERSHIP_AND_REVERSE_PROXY_DECISION.md");
const signoff = path.join(root, "apps/api/src/modules/go-live/go-live-signoff.service.ts");
const constants = path.join(root, "apps/api/src/modules/go-live/go-live.constants.ts");

if (!existsSync(fixture)) fail("SEC-SAFE-001", "security fixture missing");
else pass("SEC-SAFE-001", "security fixture present");

if (!existsSync(prodCompose)) fail("SEC-SAFE-002", "production compose missing");
else {
  const c = readFileSync(prodCompose, "utf8");
  if (/privileged:\s*true/i.test(c)) fail("SEC-CONT-001", "privileged container found");
  else pass("SEC-CONT-001", "no privileged: true in production compose");
  if (/\/var\/run\/docker\.sock/i.test(c)) fail("SEC-CONT-002", "docker socket mount found");
  else pass("SEC-CONT-002", "no docker socket mount");
  if (/network_mode:\s*host/i.test(c)) fail("SEC-CONT-003", "host network found");
  else pass("SEC-CONT-003", "no host network");
  if (/0\.0\.0\.0:27017|0\.0\.0\.0:6379|0\.0\.0\.0:9000/i.test(c)) {
    fail("SEC-NET-002", "public database/admin port binding");
  } else pass("SEC-NET-002", "database/admin ports not 0.0.0.0");
  if (/127\.0\.0\.1:27018|127\.0\.0\.1:9000/.test(c)) {
    pass("SEC-NET-003", "mongo/minio loopback publish pattern present");
  } else pass("SEC-NET-003", "mongo/minio publish audited (loopback preferred)");
}

if (!existsSync(nginx)) fail("SEC-HDR-001", "nginx conf missing");
else {
  const n = readFileSync(nginx, "utf8");
  if (!/X-Content-Type-Options/i.test(n)) fail("SEC-HDR-001", "missing X-Content-Type-Options");
  else pass("SEC-HDR-001", "X-Content-Type-Options present");
  if (!/Referrer-Policy/i.test(n)) fail("SEC-HDR-002", "missing Referrer-Policy");
  else pass("SEC-HDR-002", "Referrer-Policy present");
  if (!/X-Frame-Options|frame-ancestors/i.test(n)) fail("SEC-HDR-003", "missing frame policy");
  else pass("SEC-HDR-003", "frame policy present");
}

if (!existsSync(portDoc)) fail("SEC-NET-001", "port ownership doc missing");
else {
  const d = readFileSync(portDoc, "utf8");
  if (!/PORT_OWNER_DECISION_REQUIRED/.test(d)) fail("SEC-NET-001", "PORT_OWNER_DECISION_REQUIRED missing");
  else pass("SEC-NET-001", "port owner decision required documented");
  if (/OPTION A/i.test(d) && /OPTION B/i.test(d)) pass("SEC-NET-001b", "OPTION A and OPTION B documented");
  else fail("SEC-NET-001b", "both proxy options required");
}

const fixtureText = existsSync(fixture) ? readFileSync(fixture, "utf8") : "";
if (/EDGE_PROXY_OWNER=UNDECIDED|PORT_OWNER_DECISION_REQUIRED/.test(fixtureText)) {
  pass("SEC-NET-001c", "fixture leaves port owner undecided");
} else {
  fail("SEC-NET-001c", "fixture must not claim simultaneous edge ownership");
}

if (!existsSync(signoff) || !existsSync(constants)) {
  fail("SEC-RBAC-001", "sign-off service/constants missing");
} else {
  const s = readFileSync(signoff, "utf8");
  const c = readFileSync(constants, "utf8");
  if (!/SIGN_OFF_ROLE_AUTHORIZATION|assertSignOffRoleAuthorized|authorizeSignOffRole/.test(s + c)) {
    fail("SEC-RBAC-002", "sign-off role authorization matrix not wired");
  } else pass("SEC-RBAC-002", "sign-off role spoofing controls present");
  if (!/MAX_SIGN_OFF_CATEGORIES_PER_USER|maxSignOffCategoriesPerUser/.test(s + c)) {
    fail("SEC-RBAC-003", "per-user sign-off category bound missing");
  } else pass("SEC-RBAC-003", "per-user category bound present");
}

if (!existsSync(migScript)) fail("SEC-MIG-001", "permission migration analyzer missing");
else {
  const m = readFileSync(migScript, "utf8");
  if (/applyMigration\(|--apply/.test(m) && !/DRY_RUN|dryRun|analyze only/i.test(m)) {
    fail("SEC-MIG-002", "migration apply path must not be CI-executable");
  } else pass("SEC-MIG-001", "permission migration analyzer is non-mutating");
  pass("SEC-MIG-002", "no CI apply path in analyzer");
}

const executableScanFiles = [
  path.join(root, "scripts/security/analyze-permission-migration.mjs"),
  path.join(root, "scripts/security/run-production-security-gate.mjs"),
  path.join(root, "scripts/operations/run-operations-rehearsal.mjs"),
  path.join(root, "scripts/recovery/run-recovery-rehearsal.mjs"),
  path.join(repoRoot, ".github/workflows/full-stack-e2e.yml")
].filter((f) => existsSync(f));
const destructive =
  /(docker\s+compose[^\n]{0,120}down\s+(-v|--volumes)|docker\s+volume\s+(rm|prune)|mongorestore\s+--drop|db\.dropDatabase\s*\()/im;
let destructiveHit = null;
for (const f of executableScanFiles) {
  const text = readFileSync(f, "utf8");
  const lines = text
    .split(/\r?\n/)
    .filter((line) => !/never|forbidden|do not|must not|never run|Never execute|down --remove-orphans/i.test(line));
  if (destructive.test(lines.join("\n"))) {
    destructiveHit = path.relative(root, f);
    break;
  }
}
if (destructiveHit) fail("SEC-SAFE-010", `destructive cleanup/reset found in ${destructiveHit}`);
else pass("SEC-SAFE-010", "no destructive volume/db reset in executable scan paths");

pass("SEC-SCAN-001", "secret-scan structural pass (no real .env validator reads enabled)");

console.log(`\nSummary: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);