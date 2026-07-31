#!/usr/bin/env node
/**
 * Ensures real-stack Playwright specs do not mock business API responses.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const suiteDir = path.join(root, "apps", "web", "e2e-real");

const FORBIDDEN = [
  { id: "NOMOCK-001", re: /\.route\s*\(/, msg: "page.route / context.route is forbidden in real-stack tests" },
  { id: "NOMOCK-002", re: /route\.fulfill\s*\(/, msg: "route.fulfill is forbidden for application API responses" },
  { id: "NOMOCK-003", re: /localStorage\.setItem\s*\(\s*['"]maintainpro_access_token['"]/, msg: "localStorage token injection is forbidden" },
  { id: "NOMOCK-004", re: /localStorage\.setItem\s*\(\s*['"]maintainpro_refresh_token['"]/, msg: "localStorage refresh token injection is forbidden" },
  { id: "NOMOCK-005", re: /addCookies\s*\([\s\S]*maintainpro_access/, msg: "manual access-cookie injection is forbidden in real-stack auth proofs" }
];

const ALLOWED_FILE_HINTS = [
  // helpers may document forbidden patterns in comments only — still scanned
];

function walk(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

let failures = 0;

function main() {
  console.log("validate:e2e-no-mocks");
  const files = walk(suiteDir);
  if (files.length === 0) {
    console.error("FAIL: e2e-real suite directory is empty or missing");
    process.exit(1);
  }

  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (rel.includes("/helpers/") && rel.endsWith("safety.ts")) {
      // safety helpers may mention forbidden APIs in docs strings — scan body only after strip
    }
    const raw = readFileSync(file, "utf8");
    const body = stripComments(raw);
    for (const rule of FORBIDDEN) {
      // Permit documented allowlist block for analytics/fonts only via explicit marker
      if (rule.id === "NOMOCK-001" && body.includes("E2E_ALLOWED_ROUTE_INTERCEPT")) {
        continue;
      }
      if (rule.re.test(body)) {
        // Cookie assertion helpers that *read* cookies are fine; ban addCookies with access token
        if (rule.id === "NOMOCK-005" && !/addCookies/.test(body)) continue;
        console.error(`FAIL ${rule.id} in ${rel}: ${rule.msg}`);
        failures += 1;
      }
    }
    if (/localhost:3000|127\.0\.0\.1:3000/.test(body) && /goto|request\.|fetch\(/.test(body)) {
      console.error(`FAIL NOMOCK-006 in ${rel}: direct Nest browser calls that bypass Nginx are forbidden`);
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(`validate:e2e-no-mocks: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`PASS: scanned ${files.length} real-stack files; no business API mocks detected`);
}

main();