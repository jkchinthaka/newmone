#!/usr/bin/env node
/**
 * FG production runtime compose contract — no secrets, no Docker engine required
 * beyond optional `docker compose config` (run separately in release gate).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const check = (id, ok, detail) => {
  if (ok) console.log(`PASS ${id}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${detail}`);
  }
};

const compose = readFileSync(path.join(root, "docker-compose.yml"), "utf8");
const prod = readFileSync(path.join(root, "docker-compose.production.yml"), "utf8");
const nginx = readFileSync(path.join(root, "infra/nginx/default.conf"), "utf8");

for (const svc of [
  "fg-collectstatic:",
  "fg:",
  "fg-celery-worker:",
  "fg-celery-beat:",
  "nginx:"
]) {
  check(`FG-COMPOSE-SVC-${svc.replace(":", "")}`, compose.includes(`\n  ${svc}`), `missing ${svc}`);
}

check(
  "FG-COMPOSE-WAIT-WEB",
  /fg:\s*[\s\S]*?WAIT_FOR_POSTGRES:\s*"0"/.test(compose),
  "fg WAIT_FOR_POSTGRES!=0"
);
check(
  "FG-COMPOSE-WAIT-WORKER",
  /fg-celery-worker:\s*[\s\S]*?WAIT_FOR_POSTGRES:\s*"0"/.test(compose),
  "worker WAIT_FOR_POSTGRES!=0"
);
check(
  "FG-COMPOSE-WAIT-BEAT",
  /fg-celery-beat:\s*[\s\S]*?WAIT_FOR_POSTGRES:\s*"0"/.test(compose),
  "beat WAIT_FOR_POSTGRES!=0"
);
check(
  "FG-COMPOSE-WAIT-STATIC",
  /fg-collectstatic:\s*[\s\S]*?WAIT_FOR_POSTGRES:\s*"0"/.test(compose),
  "collectstatic WAIT_FOR_POSTGRES!=0"
);

check(
  "FG-COMPOSE-DB-DEFAULT",
  /MONGODB_DATABASE:\s*\$\{PRIMARY_DATABASE_NAME:-maintainpro_prod\}/.test(compose) ||
    /MONGODB_DATABASE:\s*maintainpro_prod/.test(compose),
  "FG DB default not maintainpro_prod"
);
check(
  "FG-COMPOSE-DB-TARGET",
  /MONGODB_PRODUCTION_TARGET_DATABASE:\s*maintainpro_prod/.test(compose),
  "target DB not locked"
);
check(
  "FG-COMPOSE-REDIS",
  /FG_REDIS_URL:/.test(compose) && /redis:\/\/redis:6379\/1/.test(compose),
  "FG_REDIS_URL DB1 missing"
);
check("FG-COMPOSE-NO-PUB-8000", !/8000:8000/.test(compose), "fg must not publish 8000");
check(
  "FG-COMPOSE-NGINX-DEPENDS-FG",
  /nginx:[\s\S]*depends_on:[\s\S]*fg:/.test(compose),
  "nginx must depend on fg"
);
check(
  "FG-COMPOSE-STATIC-VOL",
  /maintainpro-fg-static:/.test(compose) && /\/var\/www\/fg-static:ro/.test(compose),
  "static volume mount missing"
);
check(
  "FG-COMPOSE-EVIDENCE-VOL",
  /maintainpro-fg-evidence:/.test(compose),
  "evidence volume missing"
);
check(
  "FG-COMPOSE-BEAT-NO-HTTP-HC",
  /fg-celery-beat:[\s\S]*healthcheck:\s*\n\s*disable:\s*true/.test(compose),
  "beat must disable web healthcheck"
);
check(
  "FG-COMPOSE-WORKER-CELERY-HC",
  /fg-celery-worker:[\s\S]*celery -A config inspect ping/.test(compose),
  "worker celery healthcheck missing"
);

check(
  "FG-PROD-HARDCODE-DB",
  /MONGODB_DATABASE:\s*maintainpro_prod/.test(prod),
  "production overlay must hardcode maintainpro_prod"
);
check(
  "FG-PROD-IMAGE-SHA",
  /MAINTAINPRO_FG_IMAGE:-\s*maintainpro-fg:\$\{APP_COMMIT_SHA/.test(prod),
  "FG image must use APP_COMMIT_SHA"
);

check(
  "NGINX-FG-STRIP",
  /location \^~ \/fg\/ \{[\s\S]*proxy_pass http:\/\/maintainpro_fg\/;/.test(nginx),
  "nginx must strip /fg/ via trailing-slash proxy_pass"
);
check(
  "NGINX-FG-STATIC-ALIAS",
  /location \^~ \/fg\/static\/ \{[\s\S]*alias \/var\/www\/fg-static\/;/.test(nginx),
  "nginx must alias FG static volume"
);
const staticBlock = nginx.match(/location \^~ \/fg\/static\/ \{[\s\S]*?\n  \}/);
check("NGINX-FG-STATIC-BLOCK", Boolean(staticBlock), "static location block missing");
check(
  "NGINX-NO-DOUBLE-PROXY-STATIC",
  Boolean(staticBlock) && !/proxy_pass/.test(staticBlock[0]) && /alias \/var\/www\/fg-static\//.test(staticBlock[0]),
  "static must alias volume and not proxy to gunicorn"
);

if (failed) process.exit(1);
console.log("fg-runtime-compose-contract ok");
