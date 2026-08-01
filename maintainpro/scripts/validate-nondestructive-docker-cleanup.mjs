#!/usr/bin/env node
/**
 * Structural validator: reject automated Docker volume deletion / prune.
 * Never executes matched commands. Never prints secrets.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(maintainproRoot, "..");

export const CATEGORIES = {
  COMPOSE_DOWN_VOLUMES: "compose-down-with-volumes",
  DOCKER_VOLUME_RM: "docker-volume-rm",
  DOCKER_VOLUME_PRUNE: "docker-volume-prune",
  DOCKER_SYSTEM_PRUNE: "docker-system-prune",
  VOLUME_RM_PIPELINE: "volume-rm-pipeline"
};

/** Collapse YAML/shell line continuations so flags cannot hide across lines. */
export function flattenExecutableText(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\\s*\n/g, " ")
    .replace(/[ \t]+/g, " ");
}

/** Strip markdown sections marked Never / Prohibited / Forbidden / Do not. */
export function stripAllowedDocProhibitions(raw) {
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let skipping = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const heading =
      /^(#{1,6}\s+)?(\*\*)?(never|prohibited|forbidden|do not)\b/i.test(trimmed) ||
      /^(never|prohibited|forbidden|do not)\s*:/i.test(trimmed);
    if (heading) {
      skipping = true;
      continue;
    }
    if (skipping && /^#{1,6}\s+/.test(trimmed)) {
      skipping = false;
    }
    if (!skipping) out.push(line);
  }
  return out.join("\n");
}

/**
 * Detect prohibited Docker cleanup patterns in flattened text.
 * Returns [{ category, match }].
 */
export function detectDestructiveDockerCleanup(raw, { isMarkdown = false } = {}) {
  const source = isMarkdown ? stripAllowedDocProhibitions(raw) : raw;
  const flat = flattenExecutableText(source);
  const findings = [];

  // Split on shell separators so "docker compose up" cannot glue to later "down -v" prose.
  const segments = flat.split(/[;\n|&]+/);
  for (const segment of segments) {
    const s = segment.trim();
    if (!s) continue;

    const composeCmd =
      /(?:^|[\s`"'(|])(?:docker(?:\s+|-)compose)((?:\s+(?:"[^"]*"|'[^']*'|\$\{[^}]+\}|[^\s;|&]+))+)/i.exec(
        ` ${s}`
      );
    if (composeCmd) {
      const args = composeCmd[1];
      if (/(?:^|\s)down(?:\s|$)/i.test(args) && /(?:^|\s)(--volumes|-v)(?:\s|$)/i.test(args)) {
        findings.push({
          category: CATEGORIES.COMPOSE_DOWN_VOLUMES,
          match: `compose down with volume flag in: ${s.slice(0, 100)}`
        });
      }
    }

    if (/(?:^|[\s`"'(|])docker\s+volume\s+rm(?:\s|$)/i.test(` ${s}`)) {
      findings.push({ category: CATEGORIES.DOCKER_VOLUME_RM, match: "docker volume rm" });
    }
    if (/(?:^|[\s`"'(|])docker\s+volume\s+prune(?:\s|$)/i.test(` ${s}`)) {
      findings.push({ category: CATEGORIES.DOCKER_VOLUME_PRUNE, match: "docker volume prune" });
    }
    if (/(?:^|[\s`"'(|])docker\s+system\s+prune(?:\s|$)/i.test(` ${s}`)) {
      findings.push({ category: CATEGORIES.DOCKER_SYSTEM_PRUNE, match: "docker system prune" });
    }
    if (/xargs\s+(?:-n\s+\d+\s+)?docker\s+volume\s+rm(?:\s|$)/i.test(s)) {
      findings.push({ category: CATEGORIES.VOLUME_RM_PIPELINE, match: "xargs docker volume rm" });
    }
    if (/docker\s+volume\s+ls[\s\S]{0,120}xargs[\s\S]{0,80}docker\s+volume\s+rm/i.test(s)) {
      findings.push({ category: CATEGORIES.VOLUME_RM_PIPELINE, match: "volume ls | xargs volume rm" });
    }
  }

  return findings;
}

function lineNumberForMatch(raw, snippet) {
  const normalized = String(raw || "").replace(/\r\n/g, "\n");
  const needle = String(snippet || "").slice(0, 40);
  const idx = normalized.indexOf(needle);
  if (idx < 0) return 1;
  return normalized.slice(0, idx).split("\n").length;
}

function walkFiles(dir, out, exts) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".next" || name === "coverage") {
      continue;
    }
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
    const lower = name.toLowerCase();
    if (exts.some((e) => lower.endsWith(e))) out.push(full);
  }
}

export function collectScanTargets({ repoRoot: root, maintainproRoot: mp }) {
  const files = [];
  walkFiles(path.join(root, ".github", "workflows"), files, [".yml", ".yaml"]);
  walkFiles(path.join(mp, "scripts"), files, [".mjs", ".js", ".cjs", ".sh", ".ps1", ".bash"]);
  walkFiles(path.join(root, "scripts"), files, [".mjs", ".js", ".cjs", ".sh", ".ps1", ".bash"]);
  for (const rel of [
    "package.json",
    path.join("maintainpro", "package.json"),
    path.join("maintainpro", "apps", "web", "package.json"),
    path.join("maintainpro", "apps", "api", "package.json")
  ]) {
    const p = path.join(root, rel);
    if (existsSync(p)) files.push(p);
  }
  walkFiles(path.join(mp, "docs"), files, [".md"]);
  walkFiles(path.join(root, "docs"), files, [".md"]);

  const excludeName = new Set([
    "validate-nondestructive-docker-cleanup.mjs",
    "nondestructive-docker-cleanup.selftest.mjs"
  ]);
  return [...new Set(files)].filter((f) => {
    const base = path.basename(f);
    if (excludeName.has(base)) return false;
    const norm = f.replace(/\\/g, "/");
    // Self-tests intentionally embed prohibited strings as fixtures.
    if (norm.includes("/scripts/test/") && base.endsWith(".selftest.mjs")) return false;
    return true;
  });
}

function scanPackageJsonScripts(filePath) {
  const raw = readFileSync(filePath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return detectDestructiveDockerCleanup(raw).map((f) => ({ ...f, file: filePath, line: 1 }));
  }
  const findings = [];
  for (const [name, cmd] of Object.entries(parsed.scripts || {})) {
    for (const f of detectDestructiveDockerCleanup(String(cmd))) {
      findings.push({ ...f, file: filePath, line: 1, script: name });
    }
  }
  return findings;
}

export function scanRepositoryForDestructiveDockerCleanup(options = {}) {
  const root = options.repoRoot || repoRoot;
  const mp = options.maintainproRoot || maintainproRoot;
  const targets = options.targets || collectScanTargets({ repoRoot: root, maintainproRoot: mp });
  const all = [];
  for (const file of targets) {
    const lower = file.toLowerCase();
    if (lower.endsWith("package.json")) {
      all.push(...scanPackageJsonScripts(file));
      continue;
    }
    const raw = readFileSync(file, "utf8");
    const isMarkdown = lower.endsWith(".md");
    for (const f of detectDestructiveDockerCleanup(raw, { isMarkdown })) {
      all.push({
        ...f,
        file,
        line: lineNumberForMatch(raw, f.match)
      });
    }
  }
  return all;
}

function main() {
  console.log("validate:nondestructive-docker-cleanup — structural checks only");
  const findings = scanRepositoryForDestructiveDockerCleanup();
  if (findings.length === 0) {
    console.log("PASS DOCKER-SAFE: no automated volume-deletion or prune commands found");
    console.log("Summary: 1 passed, 0 failed");
    return;
  }
  for (const f of findings) {
    const rel = path.relative(repoRoot, f.file).replace(/\\/g, "/");
    const script = f.script ? ` script=${f.script}` : "";
    console.error(`FAIL DOCKER-SAFE: ${rel}:${f.line} category=${f.category}${script}`);
  }
  console.error(`Summary: 0 passed, ${findings.length} failed`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
