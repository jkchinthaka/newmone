# Approvals

Place approved charter, scope, UAT, design, and release approval records in this directory.

## Recorded approvals

| Record | Status | Date |
| --- | --- | --- |
| [PHASE_01A_DESIGN_APPROVAL.md](PHASE_01A_DESIGN_APPROVAL.md) | **Approved** as proposed design baseline | 2026-08-04 |
| [PHASE_01B_DESIGN_APPROVAL.md](PHASE_01B_DESIGN_APPROVAL.md) | **Approved with conditions** (Project Owner / Developer) | 2026-08-05 |
| [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](PHASE_01C_HIGH_FIDELITY_APPROVAL.md) | **Approved with deferred condition** — Sinhala typography (DEBT-01C-R-NOTO) remains open | 2026-08-05 |
| [PHASE_02_TECHNICAL_FOUNDATION_APPROVAL.md](PHASE_02_TECHNICAL_FOUNDATION_APPROVAL.md) | **Approved with conditions** — merged via PR #5 / #6 | 2026-08-05 |
| [PHASE_03_ACCOUNTS_RBAC_APPROVAL.md](PHASE_03_ACCOUNTS_RBAC_APPROVAL.md) | **Approved with conditions** — merged via PR #7; DEBT-01C-R-NOTO remains open | 2026-08-06 |
| [PHASE_04_SCOPE_RECONCILIATION_APPROVAL.md](PHASE_04_SCOPE_RECONCILIATION_APPROVAL.md) | **Approved with conditions** — documentation-only scope reconciliation on PR #10 (reviewed commit `3251c5c`); PR not merged by this record | 2026-08-07 |
| [PR_10_DOCUMENTATION_CI_EXCEPTION.md](PR_10_DOCUMENTATION_CI_EXCEPTION.md) | **Approved** — one-time documentation-only CI exception for PR #10 head baseline `b1c3f18`; approved for final merge verification; PR not merged by this record | 2026-08-07 |

## Related merged work (not separate approval forms)

| Item | Status | Notes |
| --- | --- | --- |
| Authentication UI polish (PR #8) | **Merged** | Design/docs note: [AUTHENTICATION_UI_POLISH.md](../design/AUTHENTICATION_UI_POLISH.md). English foundation screens only. Not Sinhala UI approval. Not production approval. |

## Notes

- Phase 01A approval does **not** approve open Nelna operational values (limits, sites, forms, SoD matrices, etc.).
- Phase 01B and 01C approvals are Project Owner / Developer only — not QA, IT management, or other Nelna stakeholder approval.
- Phase 01C deferred condition: Noto Sans Sinhala is **not** verified; Abhaya Libre is **not** production-approved; operator UAT / pilot / production remain blocked until DEBT-01C-R-NOTO is closed with evidence.
- Phase 02 is **approved with conditions** (see form). PostgreSQL remains authoritative.
- Phase 03 is **approved with conditions** and merged. Organization, Site, and Department models exist. Later phases through **10A** technical foundations also exist on `main` — see [PROJECT_STATUS.md](../PROJECT_STATUS.md). Those later units do **not** have production go-live approvals in this folder.
- Authentication UI polish local and Docker validation passed. GitHub Actions evidence was unavailable during a GitHub Actions incident for PR #8 — **do not claim the missing CI check passed**; do not create retroactive approval claims.
- Phase 04 scope reconciliation is **approved with conditions** (see form). Official Shift **values** remain blocked by ASM-004 / ASM-005 / ASM-006 even though Shift technical foundation was later implemented under provisional direction.
- A **one-time documentation-only CI exception** for PR #10 baseline head `b1c3f18` is recorded in [PR_10_DOCUMENTATION_CI_EXCEPTION.md](PR_10_DOCUMENTATION_CI_EXCEPTION.md). Missing CI remains missing and is not treated as passed.
- Outstanding business approvals are tracked in [APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md). Silence is not approval.
- Phase 20 UAT/pilot signoff form (blank until real evidence): [../uat/BUSINESS_SIGNOFF.md](../uat/BUSINESS_SIGNOFF.md). Agents must not invent signatures.
- No deployment or production-readiness approval exists.
- Do not treat other draft documents as approved unless listed here with a completed approval form.
- Do not publish the Figma library without final design-system review.
