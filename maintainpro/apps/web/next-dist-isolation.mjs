import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Next adds `<distDir>/types/**\/*.ts` to the tsconfig it type-checks with. For an isolated
 * NEXT_DIST_DIR (QA builds, extra dev servers) that tsconfig is a gitignored file that extends
 * the tracked tsconfig.json, so local dist folders never leak into a commit.
 */
export const ISOLATED_TSCONFIG = "tsconfig.isolated.json";

export function resolveTypescriptConfigPath(distDir) {
  return !distDir || distDir === ".next" ? "tsconfig.json" : ISOLATED_TSCONFIG;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function ensureIsolatedTsconfig(webRoot, distDir) {
  const tsconfigPath = resolveTypescriptConfigPath(distDir);
  if (tsconfigPath !== ISOLATED_TSCONFIG) {
    return tsconfigPath;
  }
  const target = path.join(webRoot, ISOLATED_TSCONFIG);
  const current = existsSync(target) ? readJson(target) : null;
  // Next 14 appends to `include`, so the file needs its own copy (extends does not provide one).
  if (!current || !Array.isArray(current.include)) {
    const base = readJson(path.join(webRoot, "tsconfig.json")) ?? {};
    const isolated = {
      extends: "./tsconfig.json",
      include: Array.isArray(base.include) ? base.include : ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: Array.isArray(base.exclude) ? base.exclude : ["node_modules"]
    };
    writeFileSync(target, `${JSON.stringify(isolated, null, 2)}\n`);
  }
  return tsconfigPath;
}
