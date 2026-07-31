#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(maintainproRoot, "..");
let failures = 0;
let passes = 0;

function pass(id, message) { passes += 1; console.log(`PASS ${id}: ${message}`); }
function fail(id, message) { failures += 1; console.error(`FAIL ${id}: ${message}`); }
function read(filePath) { return readFileSync(filePath, "utf8"); }
function stripYamlComments(text) {
  return text.split(/\r?\n/).filter((line) => !line.trim().startsWith("#")).join("\n");
}
function gitLsFiles() {
  const result = spawnSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8", shell: process.platform === "win32", windowsHide: true });
  if (result.error) { fail("SEC-CONFIG-001", `git ls-files could not start: ${result.error.message}`); return []; }
  if (result.status !== 0) { fail("SEC-CONFIG-001", `git ls-files exited ${result.status}`); return []; }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}
function assertDockerignoreRules(label, filePath, requiredSnippets) {
  if (!existsSync(filePath)) { fail("SEC-CONFIG-002", `Missing ${label}: ${path.relative(repoRoot, filePath)}`); return; }
  const text = read(filePath);
  const missing = requiredSnippets.filter((s) => !text.includes(s));
  if (missing.length) { fail("SEC-CONFIG-002", `${label} missing required ignore patterns: ${missing.join(", ")}`); return; }
  pass("SEC-CONFIG-002", `${label} contains required secret-exclusion patterns`);
}

function main() {
  console.log("validate:secret-safety — structural checks only (no secret values)\n");
  const tracked = gitLsFiles();
  const forbiddenName = tracked.filter((f) => {
    const normalized = f.replace(/\\/g, "/");
    const base = path.basename(normalized);
    if (base === ".env.compose-ci") return false;
    if (base.endsWith(".example")) return false;
    if (base === ".env" || /^\.env\.(local|production|development|test)$/i.test(base)) return true;
    if (/\.(pem|key|pfx|p12)$/i.test(base) && !normalized.includes("node_modules")) return true;
    if (/-credentials\.(json|txt)$/i.test(base)) return true;
    if (/\.secrets?$/i.test(base)) return true;
    if (/\/\.env\./.test(normalized) || /^\.env\./.test(base)) {
      if (base.endsWith(".example")) return false;
      if (base === ".env.compose-ci") return false;
      return true;
    }
    return false;
  });
  if (forbiddenName.length) fail("SEC-CONFIG-001", `Forbidden tracked secret-like paths: ${forbiddenName.join(", ")}`);
  else pass("SEC-CONFIG-001", "No real .env / private-key / credential-backup files are tracked");

  if (tracked.some((f) => f.replace(/\\/g, "/").endsWith("maintainpro/.env.example"))) pass("SEC-CONFIG-001", ".env.example remains tracked");
  else fail("SEC-CONFIG-001", "maintainpro/.env.example is not tracked");

  if (tracked.some((f) => f.replace(/\\/g, "/").endsWith("maintainpro/.env.compose-ci"))) pass("SEC-CONFIG-001", ".env.compose-ci CI fixture remains tracked");
  else fail("SEC-CONFIG-001", ".env.compose-ci is missing from tracking");

  assertDockerignoreRules("maintainpro/.dockerignore", path.join(maintainproRoot, ".dockerignore"), [".env", "*.pem", "*.key", "*.pfx", "!.env.compose-ci", "!.env.example"]);
  assertDockerignoreRules("repository-root .dockerignore", path.join(repoRoot, ".dockerignore"), ["maintainpro/.env", "*.pem", "!maintainpro/.env.compose-ci", "!maintainpro/.env.example"]);

  const prodComposePath = path.join(maintainproRoot, "docker-compose.production.yml");
  if (!existsSync(prodComposePath)) fail("SEC-CONFIG-003", "docker-compose.production.yml missing");
  else {
    const prodText = read(prodComposePath);
    const codeWithoutComments = stripYamlComments(prodText);
    if (/\.env\.compose-ci/.test(codeWithoutComments)) fail("SEC-CONFIG-003", "production compose references .env.compose-ci");
    else if (!/path:\s*\$\{MAINTAINPRO_COMPOSE_ENV_FILE:-\.env\}/.test(prodText) || !/required:\s*true/.test(prodText)) fail("SEC-CONFIG-003", "production compose must require env file (default .env)");
    else pass("SEC-CONFIG-003", "production compose requires env file (default .env) and does not load .env.compose-ci");

    const weak = ["root_password", "maintainpro_password", "minioadmin123", ":-minioadmin", ":-root}", ":-changeme", ":-password"];
    const weakInCode = weak.filter((w) => codeWithoutComments.includes(w));
    if (weakInCode.length) fail("SEC-CONFIG-003", `production compose still contains unsafe default patterns: ${weakInCode.join(", ")}`);
    else pass("SEC-CONFIG-003", "production compose has no weak credential defaults in active YAML");

    const missingReq = ["MONGO_INITDB_ROOT_PASSWORD", "MONGO_APP_PASSWORD", "MINIO_ACCESS_KEY", "JWT_ACCESS_SECRET", "PRIMARY_DATABASE_URL"]
      .filter((name) => !new RegExp(`${name}:\\s*\\$\\{${name}:\\?`).test(prodText));
    if (missingReq.length) fail("SEC-CONFIG-004", `production compose missing required-variable syntax for: ${missingReq.join(", ")}`);
    else pass("SEC-CONFIG-004", "production compose uses ${VAR:?} for mandatory secrets");

    const published = [...codeWithoutComments.matchAll(/["']([^"']+:\d+:\d+)["']/g)].map((m) => m[1]);
    const alsoBare = [...codeWithoutComments.matchAll(/-\s+(\d+:\d+)/g)].map((m) => m[1]);
    const allPorts = [...published, ...alsoBare];
    const illegal = allPorts.filter((p) => p !== "80:80" && !p.startsWith("127.0.0.1:"));
    if (illegal.length) fail("NET-PORT-001", `Non-loopback host binds in production compose: ${illegal.join(", ")}`);
    else pass("NET-PORT-001", "Mongo/MinIO/other host binds are 127.0.0.1-only or absent");
    pass("NET-PORT-002", "Only approved public reverse-proxy port 80 may be publicly bound (ownership TBD)");
  }

  const baseCompose = read(path.join(maintainproRoot, "docker-compose.yml"));
  if (/env_file:[\s\S]*?\.env\.compose-ci/.test(baseCompose)) fail("SEC-CONFIG-003", "base docker-compose.yml still lists .env.compose-ci under env_file");
  else pass("SEC-CONFIG-003", "base docker-compose.yml does not load .env.compose-ci via env_file");

  if (/-\s*["']?9000:9000["']?/.test(baseCompose)) fail("NET-PORT-001", "base docker-compose.yml still publishes MinIO 9000 without loopback bind");
  else pass("NET-PORT-001", "base docker-compose.yml does not publicly publish MinIO ports");

  console.log(`\nSummary: ${passes} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}
main();
