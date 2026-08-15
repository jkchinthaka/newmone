# Change Control

**Document status:** Process baseline (documentation-first; no software workflow engine yet)
**Created:** 2026-08-09
**Related:** [PROJECT_STATUS.md](../PROJECT_STATUS.md), [APPROVAL_REGISTER.md](APPROVAL_REGISTER.md), [ROADMAP.md](../ROADMAP.md)

## Purpose

Prevent silent scope creep, invented business rules, and unapproved production claims while allowing controlled technical delivery.

## Baseline scope

The current delivery baseline is:

1. Technical direction in constitution + ADRs (modular Django monolith, PostgreSQL, Redis/Celery, templates/HTMX/Tailwind).
2. Implemented phases through **Phase 10A** technical foundations as recorded in [PROJECT_STATUS.md](../PROJECT_STATUS.md).
3. Explicit non-goals until approved: ERP connectors, offline sync, NC/CAPA automation, loading/dispatch modules, AI final decisions, MongoDB primary store, production deployment.

Anything outside the current roadmap phase authorization or that invents Nelna operational values is a **change**.

## Change types

| Type | Examples | Minimum approval |
| --- | --- | --- |
| Documentation / governance | Registers, status truthfulness | Technical Lead review; commit to repo |
| Technical defect fix | Authz bug, migration fix, test gap | Technical Lead; re-run relevant gates |
| Technical foundation within authorized phase | Already-scoped phase unit | Phase exit criteria + PR/direct-main discipline as currently practiced |
| Business configuration | Real shifts, products, roles, FG-QA-001 publish | Named business owner written approval (APPROVAL_REGISTER) |
| Scope expansion | New module, ERP write, offline MVP, MongoDB | Management Sponsor + impacted owners (QA/IT/Production as applicable) |
| Production release | Go-live | Management Sponsor + IT + QA + Production written approval |

## How changes are proposed

1. Write a short proposal (can be a PR description, ADR draft, or note under `docs/`).
2. State: problem, proposed change, alternatives, business impact, technical impact, risks, validation plan.
3. Link related APPROVAL_REGISTER IDs if evidence/approval is needed.
4. Do **not** implement business values “temporarily” as if approved.

## Business impact assessment (minimum questions)

- Does this change food-safety, QA disposition, hold/release, or dispatch meaning?
- Does it require new or changed SOPs?
- Does it need new role mappings or SoD rules?
- Does it affect pilot/UAT scope or training?
- Is evidence already available, or must status remain EVIDENCE REQUIRED?

## Technical impact assessment (minimum questions)

- Which modules/migrations/APIs are touched?
- Does it weaken deny-by-default authorization or audit completeness?
- Does it couple recording to ERP availability?
- Does it store binaries in PostgreSQL or log secrets/PII inappropriately?
- What tests and coverage gates must pass?

## Approval requirement

| If change includes… | Required before merge/release |
| --- | --- |
| Invented org/shift/product/checklist/limit values | **Stop** — obtain evidence/approval first |
| New automated RELEASE/HOLD/REJECT side effects | QA (+ Warehouse/Dispatch as applicable) written rules |
| Production environment / secrets / hosting | IT Manager (+ System Administrator) |
| Claiming UAT PASSED / PRODUCTION READY | Explicit written approvals in `docs/approvals/` |

No response from an owner is **not** approval.

## Implementation

- Prefer phase branches and PR review where practical.
- If direct-`main` delivery is used for an authorized unit, still require: coherent commit message, quality gates, and documentation truthfulness.
- Keep business logic in domain services; preserve immutability/audit invariants already established.

## Validation

- Run repository quality gates appropriate to the change (at minimum the docs/check subset for documentation-only).
- For application changes: lint, typecheck, Django check, pytest, coverage threshold, and Docker test path when the engine is healthy.
- Update PROJECT_STATUS / APPROVAL_REGISTER / DECISION_LOG when status labels change.

## Release

- Local/dev Compose is not production release.
- Production release requires Phase 19–21 style evidence (restore, security, UAT) and written go-live approval.
- Do not deploy on the strength of technical IMPLEMENTED status alone.

## Record keeping

Material approved changes should leave durable artefacts:

- ADR or DECISION_LOG row
- APPROVAL_REGISTER update
- Approval form under `docs/approvals/` when phase/go-live relevant
- PROJECT_STATUS update when capability status labels change
