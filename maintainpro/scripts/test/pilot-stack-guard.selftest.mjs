import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const schema = read("prisma/schema.prisma");
assert.match(schema, /provider\s*=\s*"sqlserver"/);

const scripts = JSON.parse(read("package.json")).scripts;
assert.match(scripts["db:push"], /REFUSED: db:push is not allowed/);
assert.equal(scripts["db:push"].includes("prisma db push"), false);

const health = read("apps/api/src/health.controller.ts");
assert.match(health, /@Roles\("SUPER_ADMIN", "ADMIN"\)\s*\r?\n\s*@Get\("readiness"\)/);
assert.match(health, /@Roles\("SUPER_ADMIN", "ADMIN"\)\s*\r?\n\s*@Get\("deployment-readiness"\)/);
assert.match(health, /@Public\(\)\s*\r?\n\s*@Get\("ready"\)/);

const navigation = read("apps/web/lib/navigation.ts");
const systemHealth = navigation.slice(navigation.indexOf('id: "system-health"'));
assert.match(systemHealth.slice(0, 500), /allowedRoles:\s*\["SUPER_ADMIN"\]/);

const envSchema = read("apps/api/src/config/env.validation.ts");
assert.match(envSchema, /DATABASE_REPLICATION_ENABLED: Joi\.boolean\(\)\.default\(false\)/);
assert.match(envSchema, /EMAIL_MODE: Joi\.string\(\)\.valid\("disabled", "live"\)\.default\("disabled"\)/);
assert.match(envSchema, /SMS_MODE: Joi\.string\(\)\.valid\("disabled", "mock", "live"\)\.default\("disabled"\)/);
assert.match(envSchema, /ERP_SYNC_MODE: Joi\.string\(\)\.valid\("disabled", "mock", "file_import", "live"\)\.default\("disabled"\)/);
assert.match(envSchema, /ERP_STOCK_SYNC_APPLY_ENABLED: Joi\.boolean\(\)\.default\(false\)/);
assert.match(envSchema, /ERP_READ_ONLY_SYNC_ENABLED: Joi\.boolean\(\)\.default\(false\)/);
assert.match(envSchema, /NOTIFICATION_REAL_SENDS_ENABLED: Joi\.boolean\(\)\.default\(false\)/);
assert.match(envSchema, /ALLOW_PUBLIC_REGISTRATION: Joi\.boolean\(\)\.default\(false\)/);

const replication = read("apps/api/src/database/replication.config.ts");
assert.match(replication, /booleanEnv\(env\.DATABASE_REPLICATION_ENABLED, false\)/);

const example = read(".env.example");
for (const line of [
  "DATABASE_PROVIDER=sqlserver",
  "DATABASE_REPLICATION_ENABLED=false",
  "DATABASE_REPLICATION_MODE=disabled",
  "SMTP_ENABLED=false",
  "SMS_ENABLED=false",
  "NOTIFICATION_UAT_ENABLED=false",
  "NOTIFICATION_REAL_SENDS_ENABLED=false",
  "ERP_SYNC_MODE=disabled",
  "ERP_READ_ONLY_SYNC_ENABLED=false",
  "ERP_STOCK_SYNC_APPLY_ENABLED=false",
  "ALLOW_PUBLIC_REGISTRATION=false"
]) {
  assert.equal(example.includes(line), true, line);
}

for (const relativePath of [".env.docker.example", ".env.production.example", "apps/api/.env.example"]) {
  const text = read(relativePath);
  assert.equal(text.includes("DATABASE_REPLICATION_ENABLED=true"), false, relativePath);
  assert.equal(text.includes("DATABASE_REPLICATION_ENABLED=false"), true, relativePath);
}

console.log("pilot-stack-guard: ok");
