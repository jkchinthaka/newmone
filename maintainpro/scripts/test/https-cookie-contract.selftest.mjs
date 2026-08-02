#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const check = (id, ok, d) => {
  if (ok) console.log(`PASS ${id}`);
  else { failed += 1; console.error(`FAIL ${id}: ${d}`); }
};

const src = readFileSync(path.join(root, "apps/web/lib/runtime-security-config.ts"), "utf8");
check("HTTPS-COOKIE-001", /ALLOW_INSECURE_HTTP/.test(src), "dual opt-in missing");
check("HTTPS-COOKIE-002", /COOKIE_SECURE=false is rejected/.test(src), "https fail-closed missing");
const fixture = readFileSync(path.join(root, ".env.production.security-fixture.example"), "utf8");
check("HTTPS-COOKIE-003", /COOKIE_SECURE=true/.test(fixture), "fixture secure cookies");
check("HTTPS-COOKIE-004", /ALLOW_INSECURE_HTTP=false/.test(fixture), "fixture no insecure http");
if (failed) process.exit(1);
console.log("https-cookie-contract ok");