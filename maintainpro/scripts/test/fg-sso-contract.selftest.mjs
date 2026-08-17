/**
 * Secret-safe FG SSO compose / nginx / env contract validation.
 * Never prints secret values — only presence/length/equality checks via env fixture.
 */
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const handoff = read("apps/web/app/api/fg-sso/handoff/route.ts");
const navigation = read("apps/web/lib/navigation.ts");
const bff = read("apps/web/lib/bff-proxy.ts");
const nginx = read("infra/nginx/default.conf");
const compose = read("docker-compose.yml");
const prodCompose = read("docker-compose.production.yml");
const fgSsoService = read("apps/api/src/modules/auth/fg-sso.service.ts");
const seed = read("apps/api/src/database/seed.ts");
const ssoPy = read("systems/fg-digital-recording/apps/accounts/sso.py");
const bridge = read(
  "systems/fg-digital-recording/apps/access_control/maintainpro_bridge.py"
);
const gate = read(
  "systems/fg-digital-recording/apps/accounts/sso_middleware.py"
);

assert(handoff.includes("auth/fg-sso/exchange"), "handoff must call Nest exchange");
assert(handoff.includes('path: "/fg"'), "assertion cookie Path=/fg");
assert(handoff.includes("httpOnly: true"), "assertion cookie HttpOnly");
assert(/requiredPermissions:\s*\[["']fg\.access["']\]/.test(navigation), "nav requires fg.access");
assert(bff.includes("fg_sessionid") && bff.includes("fg_sso_assertion"), "logout clears FG cookies");
assert(/location \^~ \/fg\/ \{[\s\S]*proxy_pass http:\/\/maintainpro_fg\/;/.test(nginx), "nginx /fg/");
assert(compose.includes("FG_SSO_SIGNING_SECRET"), "compose wires FG_SSO_SIGNING_SECRET");
assert(compose.includes("FG_PASSWORD_LOGIN_ENABLED: \"false\""), "compose disables FG password login");
assert(compose.includes("MAINTAINPRO_SSO_GATE_ENABLED: \"true\""), "compose enables SSO gate");
assert(prodCompose.includes("FG_SSO_SIGNING_SECRET:?"), "production requires FG_SSO_SIGNING_SECRET");
assert(prodCompose.includes("FG_PASSWORD_LOGIN_ENABLED: \"false\""), "prod disables FG password login");
assert(prodCompose.includes("MAINTAINPRO_SSO_GATE_ENABLED: \"true\""), "prod enables SSO gate");
assert(fgSsoService.includes("fg.access"), "exchange requires fg.access");
assert(seed.includes('"fg.admin"'), "seed catalogues fg.admin");
assert(ssoPy.includes("consume_fg_sso_jti"), "jti replay protection present");
assert(ssoPy.includes("cache.add"), "jti uses cache SETNX");
assert(bridge.includes("assert_fg_permission"), "granular FG bridge present");
assert(gate.includes("verify_maintainpro_access_token"), "session gate validates access JWT");
assert(gate.includes("fg.admin"), "admin path requires fg.admin");
assert(gate.includes("live_revalidate_maintainpro_user"), "live revalidation present");

// Safe fixture env — dummy secrets only; never log values.
const fixtureDir = mkdtempSync(path.join(tmpdir(), "fg-sso-compose-"));
const fixtureEnv = path.join(fixtureDir, ".env.fixture");
const secretA = "fixture-fg-sso-signing-secret-value-32chars-min";
const secretB = "fixture-jwt-access-secret-value-32chars-min!!";
assert(secretA.length >= 32, "fixture SSO secret length");
writeFileSync(
  fixtureEnv,
  [
    `FG_SSO_SIGNING_SECRET=${secretA}`,
    `JWT_ACCESS_SECRET=${secretB}`,
    `JWT_REFRESH_SECRET=${secretB}`,
    "DJANGO_SECRET_KEY=fixture-django-secret-key-not-for-prod-min-32",
    "DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1",
    "DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost",
    "MONGODB_URI=mongodb://mongo:27017/maintainpro_prod?replicaSet=rs0",
    "BACKUP_DATABASE_NAME=bileeta_db",
    "PRIMARY_DATABASE_URL=mongodb://mongo:27017/maintainpro_prod?replicaSet=rs0",
    "DATABASE_URL=mongodb://mongo:27017/maintainpro_prod?replicaSet=rs0",
    "BACKUP_DATABASE_URL=mongodb://mongo:27017/bileeta_db?replicaSet=rs0",
    "REDIS_URL=redis://redis:6379",
    "MINIO_ACCESS_KEY=minioadmin",
    "MINIO_SECRET_KEY=minioadmin123456",
    "MINIO_BUCKET=maintainpro-files",
    "APP_COMMIT_SHA=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    "APP_BUILD_TIMESTAMP=2026-01-01T00:00:00Z",
    "NEXT_PUBLIC_API_BASE_URL=http://localhost/api",
    "NEXT_PUBLIC_API_ORIGIN=http://localhost",
    "API_INTERNAL_URL=http://api:3000/api",
    "CORS_ORIGIN=http://localhost",
    "FRONTEND_URL=http://localhost",
    "MONGO_APP_USERNAME=maintainpro_app",
    "MONGO_APP_PASSWORD=fixture-mongo-app-password-not-real",
    "MONGO_INITDB_DATABASE=bileeta_db",
    "MONGO_INITDB_ROOT_USERNAME=root",
    "MONGO_INITDB_ROOT_PASSWORD=fixture-mongo-root-password",
    "MAINTAINPRO_API_IMAGE=maintainpro-api:deadbeef",
    "MAINTAINPRO_WEB_IMAGE=maintainpro-web:deadbeef",
    "MAINTAINPRO_FG_IMAGE=maintainpro-fg:deadbeef"
  ].join("\n")
);

const baseConfig = spawnSync(
  "docker",
  ["compose", "--env-file", fixtureEnv, "config", "--quiet"],
  { cwd: root, encoding: "utf8" }
);
assert(baseConfig.status === 0, `base compose config failed: ${baseConfig.stderr || baseConfig.stdout}`);

const prodConfig = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    fixtureEnv,
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.production.yml",
    "config",
    "--quiet"
  ],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, MAINTAINPRO_COMPOSE_ENV_FILE: fixtureEnv }
  }
);
assert(
  prodConfig.status === 0,
  `production compose config failed: ${prodConfig.stderr || prodConfig.stdout}`
);

// Missing secret must fail production compose interpolation.
const missingSecretEnv = path.join(fixtureDir, ".env.missing-secret");
writeFileSync(
  missingSecretEnv,
  readFileSync(fixtureEnv, "utf8").replace(/^FG_SSO_SIGNING_SECRET=.*$/m, "FG_SSO_SIGNING_SECRET=")
);
const missing = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    missingSecretEnv,
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.production.yml",
    "config",
    "--quiet"
  ],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, MAINTAINPRO_COMPOSE_ENV_FILE: missingSecretEnv }
  }
);
assert(missing.status !== 0, "production compose must fail when FG_SSO_SIGNING_SECRET empty");

rmSync(fixtureDir, { recursive: true, force: true });
console.log("fg-sso-contract ok");
