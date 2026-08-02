#!/usr/bin/env node
/**
 * Contract selftest: request correlation (request-id + nginx).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
function check(id, ok, d) {
  if (ok) console.log(`PASS ${id}: ${d}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${d}`);
  }
}
function read(rel) {
  const full = path.join(root, rel);
  if (!existsSync(full)) throw new Error("missing " + rel);
  return readFileSync(full, "utf8");
}

const mw = read("apps/api/src/common/middleware/request-id.middleware.ts");
check("CORR-001", /MAX_REQUEST_ID_LENGTH\s*=\s*64/.test(mw), "MAX_REQUEST_ID_LENGTH = 64");
check("CORR-002", /REQUEST_ID_PATTERN\s*=\s*\/\^\[A-Za-z0-9\\\-_\.:\]\+\$\//.test(mw) || /\\-_\\.:/.test(mw) || /:/.test(mw.match(/REQUEST_ID_PATTERN[\s\S]{0,80}/)?.[0] || ""), "colon allowed in request-id pattern");

const ctx = read("apps/api/src/common/context/request-context.middleware.ts");
check(
  "CORR-003",
  /requestId/.test(ctx) && /req\.requestId|existing\?\.requestId/.test(ctx),
  "requestContext.middleware preserves requestId"
);

const nginx = read("infra/nginx/default.conf");
const apiBlock = nginx.match(/location\s+\/api\/\s*\{[\s\S]*?\}/);
const socketBlock = nginx.match(/location\s+\/socket\.io\/\s*\{[\s\S]*?\}/);
check(
  "CORR-004",
  Boolean(apiBlock) && /X-Request-Id/.test(apiBlock[0]),
  "nginx /api/ sets X-Request-Id"
);
check(
  "CORR-005",
  Boolean(socketBlock) && /X-Request-Id/.test(socketBlock[0]),
  "nginx /socket.io/ sets X-Request-Id"
);

if (failed) process.exit(1);
console.log("\nAll request-correlation-contract selftests passed.");
