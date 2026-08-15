# Project Charter — Nelna FG Digital Recording System

**Document status:** Draft — requires owner approval  
**Phase:** 00 — Discovery and governance  
**Last updated:** 2026-08-04

## Project name

Nelna FG Digital Recording System

## Business problem

Finished Goods recording, checking, verification, evidence capture, and related quality controls currently depend on paper or fragmented processes that are slower to complete, harder to audit, and difficult to reconcile consistently across shifts and roles. The organization needs a controlled digital system that preserves history, enforces named-account accountability, and supports operator speed without inventing unapproved food-safety rules.

## One-sentence system purpose

Provide a secure, auditable, responsive Progressive Web Application for Finished Goods digital recording, review, evidence, and related quality controls using approved business rules only.

## Business objectives

1. Replace paper-first Finished Goods recording for approved checklist types with a faster digital operator workflow.
2. Enforce individual accountability through named accounts and scoped roles.
3. Preserve immutable history for submitted and approved records, with amendments for corrections.
4. Support supervisor checking and QA verification with separation of duties.
5. Capture evidence outside the database in object storage with controlled access.
6. Produce audit-ready exports without unsupported compliance claims.
7. Remain usable on the factory floor when ERP is unavailable.
8. Deliver Sinhala-capable operator-facing content.

## Success measures

| Measure | Target status |
| --- | --- |
| Operator cycle time vs paper for approved MVP checklists | To be baseline-measured and approved |
| Percentage of pilot records completed digitally during parallel run | To be set by owners |
| Audit export completeness for pilot scope | To be defined with QA / Internal Audit |
| Critical defects open at pilot exit | Zero unresolved critical defects (proposed) |
| Restore test success before production | Required — not yet executed |
| Owner approval to exit pilot / enter production | Required — not yet granted |

All numerical targets remain **PROPOSED** until approved. See [NON_FUNCTIONAL_REQUIREMENTS.md](../requirements/NON_FUNCTIONAL_REQUIREMENTS.md).

## Stakeholders

| Role | Interest | Status |
| --- | --- | --- |
| Project owner | Delivery control, phase gates, repository governance | OWNER REQUIRED — name not confirmed |
| Business owner | Business problem, MVP scope, pilot success | OWNER REQUIRED — name not confirmed |
| QA owner | Food-safety rules, verification, UAT, continuity | OWNER REQUIRED — name not confirmed |
| IT owner | Hosting, identity, networks, backups, integrations | OWNER REQUIRED — name not confirmed |
| Finished Goods operations | Operator and supervisor workflows | Stakeholder group — contacts TBC |
| Dispatch / loading | Loading and cold-chain controls (later phases) | Stakeholder group — contacts TBC |
| HR | Training records linkage (as approved) | Stakeholder group — contacts TBC |
| Internal audit | Auditability and evidence | Stakeholder group — contacts TBC |
| ERP vendor | Integration contracts (later phases) | External dependency — contacts TBC |
| Management | Dashboards and release decisions | Stakeholder group — contacts TBC |

## Named ownership placeholders

| Function | Name | Status |
| --- | --- | --- |
| Project owner | _Not confirmed_ | OWNER REQUIRED |
| Business owner | _Not confirmed_ | OWNER REQUIRED |
| QA owner | _Not confirmed_ | OWNER REQUIRED |
| IT owner | _Not confirmed_ | OWNER REQUIRED |

Do not invent personal names for unconfirmed owners.

## Constraints

- Greenfield repository; do not reuse previous project code.
- Documentation and governance first; no Django application in Phase 00.
- Modular monolith; Django 5.2 LTS; PostgreSQL; responsive PWA only for initial delivery.
- No invented Nelna operational values.
- No AI final decisions for food safety, QA, loading release, CAPA closure, or access control.
- No production deployment without explicit approval.
- Private GitHub repository and phase-by-phase delivery.

## Assumptions

See [ASSUMPTION_REGISTER.md](ASSUMPTION_REGISTER.md). Key open assumptions include site hierarchy, shift definitions, checklist inventory, language mix, device ownership, Wi-Fi coverage, retention, hosting, and RPO/RTO.

## Dependencies

- Confirmed business owners for rules and checklist content
- Access to current paper forms and controlled documents (evidence)
- IT decisions on hosting, identity, and network readiness
- Figma Professional for design handoff (Phase 01)
- Later: PostgreSQL, Redis, object storage, email/SMS providers as approved
- Later: ERP API availability for integration phases only

## Initial pilot concept

**Proposed (requires approval):** Run a limited pilot for a small set of users, devices, and **two approved checklist types** with online operator submission, supervisor checking, QA verification, evidence upload, and basic audit export, in parallel with paper as directed by QA.

Pilot site(s), user counts, devices, and dates are **DECISION REQUIRED**.

## Out of scope (initial)

- Native mobile applications (Flutter, React Native, iOS/Android native)
- Microservices architecture
- Direct ERP database writes
- Paid external AI APIs as a core dependency
- AI-authorized release, CAPA closure, or access control
- Unapproved temperature limits or CCP classifications embedded as facts
- Full multi-site rollout before pilot exit criteria are met
- Production claims without UAT, restore testing, security review, and owner approval

## Approval table

| Item | Approver role | Name | Date | Decision |
| --- | --- | --- | --- | --- |
| Project charter | Project owner | _TBC_ | _TBC_ | Pending |
| MVP scope | Business owner + QA owner | _TBC_ | _TBC_ | Pending |
| Pilot authorization | Business owner + QA owner + IT owner | _TBC_ | _TBC_ | Pending |
| Production release | Project owner + Business owner + QA owner + IT owner | _TBC_ | _TBC_ | Pending |

**This charter is not approved.** It is a Phase 00 draft for manual review.
