# Response-Type Decision Register — Checklist Items

**Document status:** Provisional technical primitives for **definition schema only** (Phase 06C) — **not** business-content approval
**Created:** 2026-08-07 (Phase 06B)
**Updated:** 2026-08-07 (Phase 06C)
**Requirement link:** TEMPLATE-001 / TEMPLATE-003

## Current implementation (Phase 06C)

Provisional response-definition primitives are approved for the **checklist definition schema** only (not for runtime recording execution, and not as approved Nelna form content):

| Primitive | Definition-schema status | Notes |
| --- | --- | --- |
| YES_NO | Provisional technical — approved for definition schema | Boolean-style yes/no |
| YES_NO_NA | Provisional technical — approved for definition schema | Yes / no / not applicable |
| NUMBER | Provisional technical — approved for definition schema | Optional unit; optional min/max (may remain unset) |
| TEXT | Provisional technical — approved for definition schema | Free text definition support |
| SELECT | Provisional technical — approved for definition schema | Requires ≥1 option at publish |

**Temperature:** modeled as **NUMBER + unit** (proposed unit °C where applicable on FG-QA-001 draft). No temperature-specific type. ASM-001 limits remain unset / EVIDENCE REQUIRED.

**Still deferred (not in 06C definition schema):** PHOTO, SIGNATURE, date/time-specific types, instrument/training-bound types, and any other candidates below until evidenced.

## Business content status

| Topic | Status |
| --- | --- |
| Which types appear on approved Nelna forms | EVIDENCE REQUIRED — FG-QA-001 draft is PROJECT-PROPOSED only |
| Numerical limits / pass-fail thresholds | EVIDENCE REQUIRED — must remain unset until ASM-001 / controlled docs |
| SELECT disposition labels RELEASE/HOLD/REJECT | Proposed workflow labels only — **no** automatic release engine |

## Candidate types still open

| Candidate type | Required for MVP? | Evidence source | Notes |
| --- | --- | --- | --- |
| photo | EVIDENCE REQUIRED | EVIDENCE REQUIRED | Deferred |
| signature | EVIDENCE REQUIRED | EVIDENCE REQUIRED | Deferred |
| date/time | EVIDENCE REQUIRED | EVIDENCE REQUIRED | Deferred |
| other | EVIDENCE REQUIRED | EVIDENCE REQUIRED | Specify |

## Related

- [proposals/FG_QA_001_DRAFT_V0_1.md](proposals/FG_QA_001_DRAFT_V0_1.md)
- [TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md](TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md)
- [ADR-010-CHECKLIST-DEFINITION-VERSIONING.md](../architecture/ADR-010-CHECKLIST-DEFINITION-VERSIONING.md)
- [PHASE_06C_TEST_PLAN.md](../testing/PHASE_06C_TEST_PLAN.md)
