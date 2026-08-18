# ADR-049 — Mock Recall Exercises

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 38  

## Context

Recall preparedness, QA, audit, and analytics need to run mock recall exercises
without affecting live product/inventory status, customer notifications,
regulatory notifications, or dispatch release.

## Decision

1. Extend `apps.recall` with explicit `RecallCaseMode.MOCK_EXERCISE` and
   denormalized `is_mock=True`. Mock codes must use the `MOCK-` prefix and
   expose banner `MOCK EXERCISE — NOT A REAL RECALL` so exercises are visually
   and technically impossible to confuse with real recalls.
2. `MockExerciseMetrics` captures started_at, completed_at, scope, traceback /
   trace-forward completeness marks, quantity reconciliation notes, gaps, and
   actions — opaque assessments only (no invented scoring thresholds).
3. Mock side effects are forbidden: no ERP stock change, no real customer
   notification, no regulatory notification, no dispatch block
   (`MOCK_CASE_NO_SIDE_EFFECTS` / isolation guards).
4. Findings may create NCR, CAPA, or improvement actions only via explicit user
   services (`link_mock_finding_to_ncr`, `link_mock_finding_to_capa`,
   `create_mock_improvement_action`) with `manage_mock_recall_findings`.
5. `run_mock_recall` is separate from high-risk `initiate_recall`.

## Consequences

- Mock exercise procedure / preparedness SOP remains **EVIDENCE REQUIRED**
  (APR-063).
- Real recall dual-gates (APR-062) remain unchanged.

## Related

- ADR-048 Product Recall, ADR-047 Batch Genealogy, APR-063
