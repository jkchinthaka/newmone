/**
 * Production Hardening — Phase 14
 *
 * Thin re-export/constants module for cross-cutting production safeguards.
 * Keep this file minimal: it must never import Prisma or application services
 * so unit tests can import it without standing up the container.
 */

// ─── Soft-retired modules ────────────────────────────────────────────────────
//
// These modules remain registered in AppModule (routes still serve existing
// data). They are soft-retired: no new feature investment, write-stop/migrate
// policies documented in docs/DATA_DISPOSITION_REPORT.md.
//
// DO NOT unregister them until migration scripts have been run and verified on
// a production restore and the modules have been explicitly sunset in a
// dedicated phase.

export const SOFT_RETIRED_MODULE_KEYS = [
  "farm",
  "cleaning",
  "billing",
  "qa",
  "go-live",
  "post-go-live",
  "predictive-ai",
] as const;

export type SoftRetiredModuleKey = (typeof SOFT_RETIRED_MODULE_KEYS)[number];

export function isSoftRetiredModule(key: string): boolean {
  return (SOFT_RETIRED_MODULE_KEYS as readonly string[]).includes(key);
}

// ─── ERP mock safety ─────────────────────────────────────────────────────────
//
// Re-export from supply-boundary for use in tests without importing the full
// module. A mock ERP sync must never be reported as a production success.

export { erpSyncOutcome } from "../maintenance-supply/supply-boundary";

/**
 * Assert that a mock ERP sync is NEVER flagged as a production success.
 * Throws if the invariant is violated.
 */
export function assertNoFabricatedErpSuccess(outcome: {
  reportableAsProductionSuccess: boolean;
  status: string;
}): void {
  if (outcome.status.startsWith("MOCK") && outcome.reportableAsProductionSuccess) {
    throw new Error(
      "INVARIANT VIOLATED: mock ERP outcome must never be reportableAsProductionSuccess=true"
    );
  }
}

// ─── Terminal status constants ────────────────────────────────────────────────

export { TERMINAL_WO_STATUSES, isTerminalStatus } from "../reporting-kpis/kpi-definitions";

// ─── Admin safety re-exports ──────────────────────────────────────────────────

export {
  evaluateUserDeactivation,
  sanitizeSystemResponse,
  SENSITIVE_CONFIG_FIELDS,
} from "../admin-governance/admin-safety";
