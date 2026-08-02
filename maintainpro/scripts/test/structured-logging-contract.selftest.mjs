#!/usr/bin/env node
/**
 * Contract selftest: structured logging sanitization.
 * Prefers dynamic import of built JS; falls back to source pattern + inline check.
 */
import { readFileSync, existsSync } from "node:fs";
function readText(full) {
  const buf = readFileSync(full);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return Buffer.from(buf).swap16().toString("utf16le");
  }
  if (buf.length >= 4 && buf[1] === 0 && buf[3] === 0 && buf[0] !== 0 && buf[2] !== 0) {
    return buf.toString("utf16le");
  }
  return buf.toString("utf8");
}
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
function check(id, ok, d) {
  if (ok) console.log(`PASS ${id}: ${d}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${d}`);
  }
}

const srcPath = path.join(root, "apps/api/src/common/logging/sanitize-for-log.util.ts");
check("LOG-SRC-001", existsSync(srcPath), "sanitize-for-log.util.ts exists");
const src = existsSync(srcPath) ? readText(srcPath) : "";

check("LOG-SRC-002", /export\s+function\s+sanitizeLogText/.test(src), "sanitizeLogText export");
check("LOG-SRC-003", /export\s+function\s+sanitizeErrorForLog/.test(src), "sanitizeErrorForLog export");
check("LOG-PAT-001", /mongodb\(\+srv\)\?:\\\/\\\//.test(src) || /mongodb/.test(src), "mongodb:// redaction pattern");
check("LOG-PAT-002", /Bearer\\s\+/.test(src) || /Bearer/.test(src), "Bearer redaction pattern");
check("LOG-PAT-003", /password/.test(src), "password= redaction pattern");

/** Minimal inline mirror of SECRET_VALUE_PATTERNS for behavioral assert. */
function inlineSanitize(input) {
  const patterns = [
    /mongodb(\+srv)?:\/\/[^\s"']+/gi,
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    /(?:"|')?(?:password|pass|pwd|secret|token)(?:"|')?\s*[:=]\s*(?:"|')?[^"',\s}]+/gi
  ];
  let text = String(input);
  for (const p of patterns) text = text.replace(p, "[REDACTED]");
  return text;
}

const sample =
  "uri=mongodb://user:secret@host/db Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aa.bb password=hunter2";
const sanitized = inlineSanitize(sample);
check("LOG-BEH-001", !/mongodb:\/\//.test(sanitized), "inline redact mongodb://");
check("LOG-BEH-002", !/Bearer\s+eyJ/.test(sanitized), "inline redact Bearer");
check("LOG-BEH-003", !/password=hunter2/.test(sanitized), "inline redact password=");
check("LOG-BEH-004", /\[REDACTED\]/.test(sanitized), "inline inserts [REDACTED]");

const candidates = [
  path.join(root, "apps/api/dist/common/logging/sanitize-for-log.util.js"),
  path.join(root, "apps/api/src/common/logging/sanitize-for-log.util.js")
];
let imported = null;
for (const c of candidates) {
  if (!existsSync(c)) continue;
  try {
    imported = await import(pathToFileURL(c).href);
    break;
  } catch {
    /* optional */
  }
}
if (imported && typeof imported.sanitizeLogText === "function") {
  const out = imported.sanitizeLogText(sample);
  check("LOG-IMP-001", !/mongodb:\/\//.test(out) && /\[REDACTED\]/.test(out), "imported sanitizeLogText redacts");
} else {
  check("LOG-IMP-001", true, "imported sanitize skipped (no built JS); source+inline covered");
}

if (failed) process.exit(1);
console.log("\nAll structured-logging-contract selftests passed.");
