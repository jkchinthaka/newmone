# FG-QA-001 Draft Loading (Phase 06D)

**Document status:** Operations guide for explicit DRAFT proposal loading — **not** production approval
**Last updated:** 2026-08-07
**Proposal:** [FG_QA_001_DRAFT_V0_1.md](../business/proposals/FG_QA_001_DRAFT_V0_1.md) — **NOT APPROVED** for production

## Purpose

Load the repository-controlled FG-QA-001 project proposal into **one** Organization as a checklist **DRAFT** for review only.

This is an operator-controlled management command. It does **not** auto-seed on migrate, startup, or fixture load. It does **not** publish. It does **not** assign Products.

## Prerequisites

- An existing Organization (UUID known from your environment — do not invent values).
- An active User with `checklists.manage_checklist` scoped to that Organization.
- Proposal CSV at `docs/business/proposals/FG_QA_001_DRAFT_V0_1.csv` (canonical loader source).

## Safe usage

Always dry-run first:

```text
python manage.py load_fg_qa_001_draft --organization <ORGANIZATION_UUID> --actor <USER_UUID> --dry-run
```

If dry-run reports success and the intended Organization/actor are correct, load without `--dry-run`:

```text
python manage.py load_fg_qa_001_draft --organization <ORGANIZATION_UUID> --actor <USER_UUID>
```

Replace `<ORGANIZATION_UUID>` and `<USER_UUID>` with real UUIDs from your local or controlled environment. This document does **not** invent example UUIDs.

## Safety invariants

| Rule | Behavior |
| --- | --- |
| Never publishes | Loaded version status remains `DRAFT`. No `--publish` flag. |
| Never auto-seeds | Command must be run explicitly; migrations/startup do not load FG-QA-001. |
| Organization required | `--organization` UUID is mandatory; no default / first-org guess. |
| Actor required | `--actor` UUID must be an active user with manage permission for that Organization. |
| No Product assignment | Loader leaves Product unset (`product=None`). |
| Org isolation | Does not mutate another Organization's templates. |
| Transactional | Populate failure rolls back; no partial Template/Version/Section/Item rows. |

## Idempotent behavior summary

Identity key: Organization + template code `FG-QA-001`.

| Situation | Result |
| --- | --- |
| No FG-QA-001 template | Creates Template + DRAFT version from proposal. |
| Template exists, no DRAFT | Creates a new DRAFT version from proposal. |
| DRAFT exists and structure matches proposal fingerprint | No-op (`noop`); no duplicate DRAFT. |
| DRAFT exists but structure differs | **Stops** with validation error — does not overwrite. Manual review / new-version workflow required. |
| PUBLISHED (or historical) version exists | Never modifies it. New proposal content loads only as a new DRAFT when no conflicting DRAFT exists. |

## Divergent DRAFT stop behavior

If an existing FG-QA-001 DRAFT fingerprint does not match the proposal CSV structure, the loader raises an error and makes **no** changes. Resolve divergence manually (review edits, retire/publish path, or create a fresh DRAFT through normal UI/services after clearing the conflicting draft). Do not expect silent overwrite.

## NOT APPROVED warning

FG-QA-001 remains **PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED**.

- Loading a DRAFT is **not** business approval.
- Loading a DRAFT is **not** authorization for pilot, UAT, or production use.
- Command output reminds: PROPOSED / NOT APPROVED FOR PRODUCTION USE.
- Management UI shows a proposal review banner on FG-QA-001 versions.

## SELECT RELEASE / HOLD / REJECT

Item FGQA-41 SELECT options `RELEASE`, `HOLD`, and `REJECT` are **definition labels only**.

They do **not** implement automatic release, stock release, HOLD, REJECT, or ERP inventory actions.

## Review

After a successful load, authorized users review the DRAFT in the checklist definition management UI (version detail). See [CHECKLIST_DEFINITION_MANAGEMENT_UI.md](../design/CHECKLIST_DEFINITION_MANAGEMENT_UI.md) and [FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md](../business/FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md).

## Related

- [PHASE_06D_TEST_PLAN.md](../testing/PHASE_06D_TEST_PLAN.md)
- [ADR-010-CHECKLIST-DEFINITION-VERSIONING.md](../architecture/ADR-010-CHECKLIST-DEFINITION-VERSIONING.md)
- [PHASE_07_READINESS_GATE.md](../business/PHASE_07_READINESS_GATE.md)
