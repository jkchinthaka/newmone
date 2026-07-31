import { createRequire } from "node:module";
import path from "node:path";

/**
 * Resolve MaintainPro root from apps/web cwd or nested helpers.
 * Never loads production .env files.
 */
function resolveLoader() {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  // When cwd is apps/web (Playwright default), scripts live two levels up.
  // When cwd is maintainpro/, scripts live at ./scripts.
  const candidates = [
    path.resolve(process.cwd(), "../../scripts/lib/e2e-environment.cjs"),
    path.resolve(process.cwd(), "scripts/lib/e2e-environment.cjs"),
    path.resolve(process.cwd(), "../scripts/lib/e2e-environment.cjs")
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      /* try next */
    }
  }
  throw new Error("Unable to resolve E2E environment loader module.");
}

const loader = resolveLoader();

/** Idempotent — safe from Playwright config, helpers, and global setup. */
export function ensureE2eEnvironmentLoaded(options?: {
  force?: boolean;
  requireSeedPassword?: boolean;
  envFilePath?: string;
}): { loaded: boolean; pathBasename: string } {
  return loader.ensureE2eEnvironmentLoaded(options || {});
}

export function e2eEnvironmentPreflight(options?: Record<string, unknown>) {
  return loader.e2eEnvironmentPreflight(options || {});
}