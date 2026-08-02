#!/usr/bin/env node
/**
 * Structural validator for operations E2E / ops safety controls (no secrets).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const opsSpec = path.join(root, "apps/web/e2e-real/operations-controls.spec.ts");
const rehearsal = path.join(root, "scripts/operations/run-operations-rehearsal.mjs");
const compose = path.join(root, "docker-compose.yml");
const healthCtrl = path.join(root, "apps/api/src/health.controller.ts");
const requestIdMw = path.join(root, "apps/api/src/common/middleware/request-id.middleware.ts");
const mainTs = path.join(root, "apps/api/src/main.ts");
const opsCtrl = path.join(root, "apps/api/src/modules/operations/operations.controller.ts");
const schema = path.join(root, "prisma/schema.prisma");
const opsScriptsDir = path.join(root, "scripts/operations");

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
    if (st.isDirectory()) walk(full, out);
    else if (/\.(mjs|js|ts|sh|ps1|yml|yaml)$/.test(name)) out.push(full);
  }
  return out;
}

console.log("validate:e2e-operations-controls — structural checks only\n");

if (!existsSync(rehearsal)) {
  fail("OPS-SAFE-001", "scripts/operations/run-operations-rehearsal.mjs missing");
} else {
  pass("OPS-SAFE-001", "operations rehearsal script present");
}

if (!existsSync(opsSpec)) {
  fail("OPS-SAFE-002", "operations-controls.spec.ts missing");
} else {
  const src = readFileSync(opsSpec, "utf8");
  if (/\btest\.skip\b/.test(src)) fail("OPS-SAFE-002", "operations e2e must not use test.skip");
  else pass("OPS-SAFE-002", "no test.skip in operations e2e");
}

const opsFiles = [
  ...walk(opsScriptsDir),
  ...(existsSync(opsSpec) ? [opsSpec] : [])
];
const opsBlob = opsFiles.map((f) => readFileSync(f, "utf8")).join("\n");

const destructiveChecks = [
  {
    id: "OPS-SAFE-003",
    bad: /mongorestore[\s\S]{0,240}--drop\b/,
    okMsg: "no mongorestore --drop in operations scripts",
    failMsg: "mongorestore --drop found in operations scripts"
  },
  {
    id: "OPS-SAFE-004",
    bad: new RegExp(["docker", String.raw`\s+`, "volume", String.raw`\s+`, "rm", String.raw`\b`].join("") + "|" + String.raw`volume\s+rm\b`, "i"),
    okMsg: "no docker " + "volume rm in operations scripts",
    failMsg: "docker " + "volume rm found in operations scripts"
  },
  {
    id: "OPS-SAFE-005",
    bad: /docker\s+(system|volume|image|container|network)\s+prune\b|\bprune\s+-a?f?\b/i,
    okMsg: "no prune in operations scripts",
    failMsg: "prune found in operations scripts"
  },
  {
    id: "OPS-SAFE-006",
    bad: /(?:^|[\s;`|&])(?:sudo\s+)?reboot(?:\s|$)|shutdown\s+-r|systemctl\s+reboot|docker\s+daemon\s+restart|systemctl\s+restart\s+docker/im,
    okMsg: "no host reboot / docker daemon restart in operations scripts",
    failMsg: "host reboot or docker daemon restart found"
  }
];

for (const c of destructiveChecks) {
  if (c.bad.test(opsBlob)) fail(c.id, c.failMsg);
  else pass(c.id, c.okMsg);
}

if (!existsSync(compose)) {
  fail("OPS-SAFE-007", "docker-compose.yml missing");
  fail("OPS-SAFE-008", "docker-compose.yml missing");
} else {
  const c = readFileSync(compose, "utf8");
  if (!/max-size:\s*"?10m"?/.test(c)) fail("OPS-SAFE-007", "compose missing logging max-size 10m");
  else pass("OPS-SAFE-007", "compose has logging max-size");
  if (!/\/api\/health\/live/.test(c)) fail("OPS-SAFE-008", "compose missing /api/health/live");
  else pass("OPS-SAFE-008", "compose probes /api/health/live");
}

if (!existsSync(healthCtrl)) {
  fail("OPS-SAFE-009", "health.controller.ts missing");
} else {
  const h = readFileSync(healthCtrl, "utf8");
  if (!/@Get\("live"\)/.test(h) || !/@Get\("ready"\)/.test(h)) {
    fail("OPS-SAFE-009", "health live/ready routes missing");
  } else {
    pass("OPS-SAFE-009", "health live/ready routes present");
  }
}

if (!existsSync(requestIdMw)) {
  fail("OPS-SAFE-010", "request-id.middleware.ts missing");
} else {
  const r = readFileSync(requestIdMw, "utf8");
  if (!/MAX_REQUEST_ID_LENGTH\s*=\s*64/.test(r)) fail("OPS-SAFE-010", "request-id max length is not 64");
  else pass("OPS-SAFE-010", "request-id max 64");
}

if (!existsSync(mainTs)) {
  fail("OPS-SAFE-011", "main.ts missing");
} else {
  const m = readFileSync(mainTs, "utf8");
  const hasSanitizeImport = /sanitizeErrorForLog/.test(m);
  const rawUnhandled =
    /process\.on\(\s*["']unhandledRejection["'][\s\S]{0,400}console\.error\(\s*(reason|err)\s*\)/.test(m) ||
    /process\.on\(\s*["']uncaughtException["'][\s\S]{0,400}console\.error\(\s*(err|error)\s*\)/.test(m);
  if (!hasSanitizeImport || rawUnhandled) {
    fail("OPS-SAFE-011", "raw unhandled console.error without sanitize");
  } else {
    pass("OPS-SAFE-011", "unhandled errors use sanitizeErrorForLog");
  }
}

if (!existsSync(opsCtrl)) {
  fail("OPS-SAFE-012", "operations.controller.ts missing");
} else {
  const o = readFileSync(opsCtrl, "utf8");
  const metricsBlock = o.match(/@Get\("metrics"\)[\s\S]{0,400}async\s+metrics/);
  const hasRoles =
    metricsBlock &&
    /@Roles\(/.test(o.slice(Math.max(0, o.indexOf('@Get("metrics")') - 200), o.indexOf('@Get("metrics")') + 200));
  const metricsPublic = /@Public\(\)[\s\S]{0,120}@Get\("metrics"\)|@Get\("metrics"\)[\s\S]{0,120}@Public\(\)/.test(o);
  const schemaSrc = existsSync(schema) ? readFileSync(schema, "utf8") : "";
  const hasAlertModel = /model\s+OperationalAlert\b/.test(schemaSrc);
  if (!hasRoles || metricsPublic) {
    fail("OPS-SAFE-012", "operations/metrics must be role-protected (not public)");
  } else if (!hasAlertModel) {
    fail("OPS-SAFE-012", "OperationalAlert model missing from schema");
  } else {
    pass("OPS-SAFE-012", "metrics role-protected; OperationalAlert model present");
  }
}

console.log(`\nSummary: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
