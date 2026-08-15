# ADR-032 — Laboratory / LIMS foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 22

## Context

Finished Goods quality workflows may later consume laboratory test results. The product needs a generic LIMS-shaped domain that preserves sample provenance and immutable finalized results without inventing Nelna methods, limits, incubation times, or a positive-release mandate.

Persistence remains **PostgreSQL** (ADR-002). MongoDB/Atlas cutover remains **APR-020 PENDING / CUTOVER BLOCKED**.

## Decision

1. Introduce `apps.laboratory` with:
   - `TestMethodReference` — opaque method/reference catalogue shell
   - `LabTestParameter` — generic parameter (NUMERIC / TEXT / SELECT), optional unit, optional approved bounds, optional `SpecificationParameter` link
   - `LabSample` — sample with provenance links
   - `LabTest` — tests on a sample
   - `LabResult` — revisioned results with amendment chain
   - `LabExternalCertificate` — external lab report metadata (no vendor catalogue)
   - `LabPositiveReleasePolicy` — org policy stub
   - `LabHistoryEntry` — domain history rows (complementing `SecurityAuditEvent`)
2. **Sample status:** REGISTERED → RECEIVED → IN_TESTING → COMPLETED (or CANCELLED).
3. **Result status:** ENTERED → VERIFIED → FINALIZED; amendments create a new revision, mark prior FINALIZED as SUPERSEDED, and require reason / actor / timestamp / previous-result link.
4. **Provenance (optional, same-org):** Organization, Site, Product, batch/sub-lot references, ChecklistSubmission, NonConformance, HoldCase.
5. **Positive-release:** Blocking defaults **OFF**. Runtime blocking requires both `policy_enabled` and `LAB_POSITIVE_RELEASE_BLOCKING_APPROVED` (default False). No silent HOLD/RELEASE disposition.
6. **COA:** Interface/DTO hooks only (`coa.py`) — no certificate template.
7. **RBAC:** Separate permissions for register / enter / verify / finalize / manage / view — no business role auto-mapping.
8. **Evidence:** `EvidenceLinkedKind` extended with `LAB_SAMPLE` and `LAB_EXTERNAL_CERTIFICATE` for future attachment linkage.

## Consequences

- Lab catalogue content and positive-release enablement remain **COMPANY EVIDENCE REQUIRED** (APR-045 / APR-046 / APR-047).
- No microbiological/chemical/physical limits or external lab vendors are seeded.
- Phase 21 production go-live is not implied by this foundation.
- Hold/QA/dispatch modules may later call `evaluate_batch_positive_release_gate` — they must not treat advisory results as disposition.

## Related

- [PHASE_22_LABORATORY_LIMS_FOUNDATION.md](../business/PHASE_22_LABORATORY_LIMS_FOUNDATION.md)
- [MODULE_MAP.md](MODULE_MAP.md)
- APR-020 (Mongo cutover still PENDING)
