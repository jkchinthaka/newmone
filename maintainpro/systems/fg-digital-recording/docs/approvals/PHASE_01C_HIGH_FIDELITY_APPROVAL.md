# Phase 01C High-Fidelity Design Approval Form

**Document status:** Approved with deferred condition  
**Phase:** 01C — High-fidelity MVP screens and prototype  
**Branch:** `design/figma-high-fidelity-mvp`  
**Created:** 2026-08-05  
**Updated:** 2026-08-05

This approval is by the **Project Owner / Developer** only. It does **not** claim approval by QA, IT management, or other Nelna stakeholders.

---

## Purpose

Record review of Phase 01C high-fidelity design deliverables (Figma screens, prototypes, documentation) and authorize Phase 02 technical foundation development under an explicit deferred Sinhala typography condition.

---

## Decision summary

| Field | Entry |
| --- | --- |
| Decision | **Approved with deferred condition** |
| Reviewer | Chinthaka Jayaweera |
| Reviewer role | Project Owner / Developer |
| Date | 2026-08-05 |
| High-fidelity design direction | Approved for technical foundation development |
| Prototype direction | Approved as development reference |
| Sinhala typography | **Not finally verified** |
| Deferred condition | Noto Sans Sinhala must be manually applied and verified before operator UAT, pilot, or production |
| Application-development permission | Phase 02 backend and platform foundation may begin **after PR #4 merge** |
| QA / IT / other Nelna stakeholder approval | **Not claimed** |

### Reason for deferred condition

The project owner has decided not to delay Django/PostgreSQL technical foundation development for the remaining manual Figma Noto Sans Sinhala verification (01C-F evidence check failed against the cloud file; debt remains open by design).

---

## Verified Figma account

| Field | Value |
| --- | --- |
| Authenticated email | chinthakajayaweera1@gmail.com |
| Account handle | chinthaka |
| Plan name | CHINTHAKA JAYAWEERA's team |
| Seat type | Full |
| Figma file owner | chinthaka |
| Figma file | https://www.figma.com/design/jnn8Xhsg1zFEHxYShCUb4M |
| Library published | No |

---

## Technical design validation (owner)

| Item | Status |
| --- | --- |
| Technical design validation | **Passed, subject to manual owner approval recorded herein** |
| Blocking design debt for Phase 02 foundation | **None** (Sinhala debt reclassified — see below) |
| Remaining design debt | Non-blocking for Phase 02 foundation; **DEBT-01C-R-NOTO remains open** |

---

## Deferred condition — DEBT-01C-R-NOTO

| Classification | Applies |
| --- | --- |
| Debt status | **OPEN** — not verified, not closed |
| Non-blocking for Phase 02 technical foundation | Yes |
| Non-blocking for backend-only development | Yes |
| Blocking before final operator-facing Sinhala UI approval | Yes |
| Blocking before operator UAT | Yes |
| Blocking before pilot | Yes |
| Blocking before production release | Yes |

**Restrictions:**

- Do not claim final Sinhala UI approval
- Do not claim Noto Sans Sinhala verification passed
- Do not treat Abhaya Libre as the approved production font
- Do not begin operator UAT
- Do not begin pilot
- Do not release production operator screens
- Do not close DEBT-01C-R-NOTO without file evidence of Noto Sans Sinhala applied and verified

---

## Documents reviewed (owner)

- [x] Phase 01C design documentation set on branch `design/figma-high-fidelity-mvp`
- [x] Figma file: https://www.figma.com/design/jnn8Xhsg1zFEHxYShCUb4M
- [x] [DESIGN_DEBT_REGISTER.md](../design/DESIGN_DEBT_REGISTER.md) — Sinhala debt remains open
- [x] [FIGMA_01C_IMPLEMENTATION_LOG.md](../design/FIGMA_01C_IMPLEMENTATION_LOG.md) — 01C-F failed verification recorded
- [x] Phase 01A and 01B baselines still in force

---

## Decision (selected)

| Outcome | Mark |
| --- | --- |
| Approved | ☐ |
| Approved with conditions | ☑ |
| Rejected | ☐ |

**Outcome:** Approved with deferred condition

---

## Conditions

1. **DEBT-01C-R-NOTO** remains open until Noto Sans Sinhala is manually applied in Figma Desktop, interim Abhaya Libre is archived or marked non-production, wrapping/clipping are verified at 360px and 430px, and evidence is recorded.
2. Phase 02 may proceed only for **technical foundation** (Django/PostgreSQL/platform) after PR #4 is merged.
3. Operator-facing Sinhala UI final approval, operator UAT, pilot, and production remain blocked until condition 1 is closed with evidence.
4. Figma component library remains unpublished until final design-system review.
5. Open Nelna operational values remain proposed / decision-required — not final business approvals.

---

## Comments

Accepted-risk deferral: foundation engineering may proceed in parallel with unfinished manual Sinhala font verification. This does **not** resolve Sinhala accessibility completeness.

---

## Signature / confirmation

| Field | Entry |
| --- | --- |
| Signature / typed confirmation | Chinthaka Jayaweera |
| Role | Project Owner / Developer |
| Date | 2026-08-05 |

---

## Post-approval actions

- [x] Update docs/approvals/README.md with Phase 01C approval-with-deferred-condition status
- [ ] Merge PR #4 (`design/figma-high-fidelity-mvp` → `main`) manually when ready
- [ ] Begin Phase 02 Django/PostgreSQL technical foundation after merge
- [ ] Keep DEBT-01C-R-NOTO open until evidenced
- [ ] Do not publish Figma library until final design-system review
- [ ] Do not start operator UAT / pilot / production until Noto debt closed

---

**Related documentation:** Phase 01C design docs; [DESIGN_DEBT_REGISTER.md](../design/DESIGN_DEBT_REGISTER.md); [DJANGO_FOUNDATION_DESIGN_HANDOFF.md](../design/DJANGO_FOUNDATION_DESIGN_HANDOFF.md)
