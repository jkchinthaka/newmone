#!/usr/bin/env node
/**
 * Static tenant fail-open audit.
 *
 * Scans the API source tree for fail-open tenant query patterns that silently
 * drop tenant scoping when tenantId is absent. New matches fail CI. Legacy or
 * intentionally-platform-scoped occurrences must be listed in
 * tenant-audit-exceptions.json with a documented owner/reason.
 *
 * Usage: node scripts/audit-tenant-queries.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoApiSrc = join(__dirname, "..", "apps", "api", "src");
const exceptionsPath = join(__dirname, "tenant-audit-exceptions.json");

const FAIL_OPEN_PATTERNS = [
  { id: "spread-ternary", regex: /\.\.\.\(\s*tenantId\s*\?\s*\{\s*tenantId\s*\}\s*:\s*\{\s*\}\s*\)/ },
  { id: "nullish-undefined", regex: /tenantId\s*\?\?\s*undefined/ },
  { id: "or-undefined", regex: /tenantId\s*\|\|\s*undefined/ },
  { id: "nullish-null-assign", regex: /tenantId:\s*tenantId\s*\?\?\s*null/ }
];

function loadExceptions() {
  try {
    const raw = JSON.parse(readFileSync(exceptionsPath, "utf8"));
    return Array.isArray(raw.exceptions) ? raw.exceptions : [];
  } catch {
    return [];
  }
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function normalize(p) {
  return relative(join(__dirname, ".."), p).split(sep).join("/");
}

const exceptions = loadExceptions();
const allowedFiles = new Set(exceptions.map((e) => e.file));
const findings = [];

for (const file of walk(repoApiSrc)) {
  const rel = normalize(file);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const pattern of FAIL_OPEN_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({ file: rel, line: idx + 1, pattern: pattern.id, text: line.trim() });
      }
    }
  });
}

const unapproved = findings.filter((f) => !allowedFiles.has(f.file));
const approvedHits = findings.filter((f) => allowedFiles.has(f.file));

if (process.env.AUDIT_JSON === "1") {
  const byFile = {};
  for (const f of findings) {
    byFile[f.file] = (byFile[f.file] ?? 0) + 1;
  }
  console.log(JSON.stringify({ total: findings.length, byFile, findings }, null, 2));
  process.exit(unapproved.length > 0 ? 1 : 0);
}

console.log(`Tenant fail-open audit: scanned ${normalize(repoApiSrc)}`);
console.log(`  total matches: ${findings.length}`);
console.log(`  approved (exceptions): ${approvedHits.length}`);
console.log(`  unapproved: ${unapproved.length}`);

if (unapproved.length > 0) {
  console.error("\nUnapproved fail-open tenant patterns detected:");
  for (const f of unapproved) {
    console.error(`  ${f.file}:${f.line} [${f.pattern}] ${f.text}`);
  }
  console.error(
    "\nFix these to use requireTenantId()/tenantWhere(), or add a reviewed entry to scripts/tenant-audit-exceptions.json."
  );
  process.exit(1);
}

console.log("\nNo unapproved fail-open tenant patterns. OK.");