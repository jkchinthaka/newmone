#!/usr/bin/env node
/**
 * Structural text-integrity validator.
 * Rejects forbidden ASCII control characters and corrupted evidence metadata.
 * Never prints secrets or environment values. Never reads .env files.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(maintainproRoot, "..");

const ALLOWED_CONTROLS = new Set([0x09, 0x0a, 0x0d]); // TAB, LF, CR
const HEX40 = /^[0-9a-f]{40}$/i;

export const EXPECTED_CLEANUP_FIX_SHA = "fe3b3992d883d33c916b3595769add2c4db8878a";
export const EXPECTED_VALIDATOR_COMMAND = "validate:nondestructive-docker-cleanup";

/**
 * @returns {{ line: number, column: number, codePoint: string, category: string }[]}
 */
export function findForbiddenControlCharacters(text) {
  const findings = [];
  let line = 1;
  let column = 1;
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i);
    const width = cp > 0xffff ? 2 : 1;
    if (cp === 0x0a) {
      line += 1;
      column = 1;
      i += width;
      continue;
    }
    const forbiddenControl =
      ((cp <= 0x1f || cp === 0x7f) && !ALLOWED_CONTROLS.has(cp)) || cp === 0xfffd;
    if (forbiddenControl) {
      findings.push({
        line,
        column,
        codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
        category: cp === 0xfffd ? "replacement-character" : "forbidden-control"
      });
    }
    column += 1;
    i += width;
  }
  return findings;
}

/** Detect hex SHA fragments interrupted by a forbidden control or unexpected newline. */
export function findSplitShaArtifacts(text) {
  const findings = [];
  // e.g. "fe" + FF + "3b3992..." or "f" + FF + "e3b3992..."
  const re = /([0-9a-f]{1,39})([\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD])([0-9a-f]{1,39})/gi;
  let m;
  while ((m = re.exec(text))) {
    const combined = `${m[1]}${m[3]}`;
    if (combined.length >= 7 && combined.length <= 40) {
      findings.push({
        line: text.slice(0, m.index).split(/\n/).length,
        column: m.index - text.lastIndexOf("\n", m.index) ,
        codePoint: `U+${m[2].codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
        category: "split-commit-sha"
      });
    }
  }
  return findings;
}

/** Detect npm script names with a leading character eaten by a control char. */
export function findSplitNpmCommands(text) {
  const findings = [];
  const re =
    /([\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD])(alidate:[a-z0-9][a-z0-9:_-]*)/gi;
  let m;
  while ((m = re.exec(text))) {
    findings.push({
      line: text.slice(0, m.index).split(/\n/).length,
      column: 1,
      codePoint: `U+${m[1].codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
      category: "split-npm-command"
    });
  }
  return findings;
}

/**
 * Evidence-field SHA length checks for known labels.
 * Looks for markdown table/backtick values that should be full SHAs.
 */
export function findMalformedEvidenceShas(text) {
  const findings = [];
  // Only fields that must carry a full 40-char cleanup-fix / correction SHA.
  // Intentional short forms (e.g. `app SHA \`e41d7ab\``) are allowed elsewhere.
  const patterns = [
    /Correction commit\s*\|\s*`?([0-9a-f]+)`?/gi,
    /Exact tested corrected SHA\s*\|\s*`?([0-9a-f]+)`?/gi,
    /cleanup-fix commit\s*\|\s*`?([0-9a-f]+)`?/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      const sha = m[1];
      if (!HEX40.test(sha)) {
        findings.push({
          line: text.slice(0, m.index).split(/\n/).length,
          column: 1,
          codePoint: "N/A",
          category: "malformed-evidence-sha",
          detail: `shaLen=${sha.length}`
        });
      }
    }
  }
  return findings;
}

export function analyzeTextIntegrity(text) {
  return [
    ...findForbiddenControlCharacters(text),
    ...findSplitShaArtifacts(text),
    ...findSplitNpmCommands(text),
    ...findMalformedEvidenceShas(text)
  ];
}

function shouldSkipDir(name) {
  return (
    name === ".git" ||
    name === "node_modules" ||
    name === ".next" ||
    name === "dist" ||
    name === "coverage" ||
    name === "e2e-real-report" ||
    name === "e2e-real-results" ||
    name === "artifacts" ||
    name === "test-results"
  );
}

function walkFiles(dir, out, exts) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (shouldSkipDir(name)) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkFiles(full, out, exts);
      continue;
    }
    if (name.startsWith(".env")) continue; // never read .env*
    const lower = name.toLowerCase();
    if (exts.some((e) => lower.endsWith(e))) out.push(full);
  }
}

export function collectTextIntegrityTargets(options = {}) {
  const root = options.repoRoot || repoRoot;
  const mp = options.maintainproRoot || maintainproRoot;
  const files = [];
  walkFiles(path.join(mp, "docs"), files, [".md"]);
  walkFiles(path.join(root, ".github", "workflows"), files, [".yml", ".yaml"]);
  walkFiles(path.join(mp, "scripts"), files, [".mjs", ".js", ".cjs"]);
  for (const rel of [
    "package.json",
    path.join("maintainpro", "package.json"),
    path.join("maintainpro", "apps", "web", "package.json"),
    path.join("maintainpro", "apps", "api", "package.json")
  ]) {
    const p = path.join(root, rel);
    if (existsSync(p)) files.push(p);
  }
  // Exclude this validator's self-test fixtures are in-memory only; keep selftest file scannable.
  return [...new Set(files)];
}

export function scanRepositoryTextIntegrity(options = {}) {
  const root = options.repoRoot || repoRoot;
  const targets = options.targets || collectTextIntegrityTargets(options);
  const all = [];
  for (const file of targets) {
    // Skip UTF-16 / binary-ish by rejecting NULs densely — still report controls if UTF-8 decode has them.
    const raw = readFileSync(file);
    if (raw.includes(0) && raw[1] === 0) {
      all.push({
        file,
        line: 1,
        column: 1,
        codePoint: "U+0000",
        category: "utf16-or-binary-nul"
      });
      continue;
    }
    const text = raw.toString("utf8");
    for (const f of analyzeTextIntegrity(text)) {
      all.push({ file, ...f });
    }
  }
  return all;
}

function main() {
  console.log("validate:text-integrity — structural checks only");
  const findings = scanRepositoryTextIntegrity();
  if (findings.length === 0) {
    console.log("PASS TEXT-SAFE: no forbidden control characters or split evidence metadata");
    console.log("Summary: 1 passed, 0 failed");
    return;
  }
  for (const f of findings) {
    const rel = path.relative(repoRoot, f.file).replace(/\\/g, "/");
    console.error(
      `FAIL TEXT-SAFE: ${rel}:${f.line}:${f.column} ${f.codePoint} category=${f.category}`
    );
  }
  console.error(`Summary: 0 passed, ${findings.length} failed`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
