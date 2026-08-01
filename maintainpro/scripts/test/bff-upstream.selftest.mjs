#!/usr/bin/env node
/**
 * BFF-502 focused selftests for upstream URL + nginx buffer policy.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const urlLib = require("../lib/bff-upstream-url.cjs");

let failed = 0;
function check(id, ok, detail) {
  if (ok) console.log(`PASS ${id}: ${detail}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${detail}`);
  }
}

const good = urlLib.resolveBffUpstreamApiBase(
  {
    API_INTERNAL_URL: "http://api:3000/api",
    E2E_TEST_MODE: "true",
    NODE_ENV: "test"
  },
  { requireDockerApiHost: true }
);
check(
  "BFF-502-001",
  urlLib.loginUpstreamUrl(good.base) === "http://api:3000/api/auth/login",
  "Runtime API base builds exactly /api/auth/login"
);

let dupRejected = false;
try {
  urlLib.normalizeApiBase("http://api:3000/api/api");
} catch {
  dupRejected = true;
}
check("BFF-502-002", dupRejected, "Duplicate /api path is rejected");

let missingRejected = false;
try {
  urlLib.resolveBffUpstreamApiBase({ NODE_ENV: "production" });
} catch {
  missingRejected = true;
}
check("BFF-502-003", missingRejected, "Missing API_INTERNAL_URL fails closed");

let relativeRejected = false;
try {
  urlLib.normalizeApiBase("/api");
} catch {
  relativeRejected = true;
}
check("BFF-502-003b", relativeRejected, "Relative NEXT_PUBLIC-style base is rejected");

const conf = readFileSync(path.join(maintainproRoot, "infra/nginx/default.conf"), "utf8");
check(
  "BFF-502-NGINX-001",
  /proxy_buffer_size\s+32k/.test(conf) && /proxy_buffers\s+8\s+32k/.test(conf),
  "Nginx BFF location enlarges proxy buffers"
);
check(
  "BFF-502-NGINX-002",
  /proxy_set_header\s+X-Request-Id\s+\$maintainpro_request_id/.test(conf) &&
    /map\s+\$http_x_request_id\s+\$maintainpro_request_id/.test(conf),
  "Nginx generates or forwards X-Request-Id to BFF"
);

const proxySrc = readFileSync(path.join(maintainproRoot, "apps/web/lib/bff-proxy.ts"), "utf8");
check(
  "BFF-502-016",
  !/console\.(log|info|debug)\(.*password/i.test(proxySrc) &&
    !/console\.(log|info|debug)\(.*body/i.test(proxySrc),
  "BFF logs do not print password or request body"
);
check(
  "BFF-502-019",
  !proxySrc.includes('"http://api:3000') && !proxySrc.includes("'http://api:3000"),
  "Browser-facing BFF source does not hardcode internal URL in strings"
);

if (failed) {
  console.error(`bff-upstream.selftest: ${failed} failed`);
  process.exit(1);
}
console.log("bff-upstream.selftest: all passed");