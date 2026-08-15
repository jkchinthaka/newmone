# Design Decision Register

**Document status:** Living register for design decisions
**Phase:** 01C Approved with deferred Sinhala condition · Phase 02 under implementation (pending approval)
**Last updated:** 2026-08-05

Statuses: Proposed · Accepted (design direction) · Accepted (01A baseline) · Deferred · Rejected · Superseded

**01A note:** Owner approved Phase 01A as the proposed journey/IA/lo-fi baseline on 2026-08-04. Items still marked Proposed / Decision required are **not** final Nelna operational approvals.

**01C note:** Phase 01C approved with deferred Sinhala typography condition (D-01C-D-001 / DES-031). DEBT-01C-R-NOTO remains open.

**02 note:** Phase 02 active branch is `foundation/django-postgresql`. Obsolete planned name `feature/phase-02-django-foundation` is superseded (DES-032). Phase 02 approval form remains unsigned.

| ID | Decision | Status | Owner | Reason | Alternatives | Impact | Evidence | Review trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DES-001 | One responsive PWA; no native app in initial phases | Accepted (aligns ADR-003) | Project owner | Single codebase | Native dual apps | Mobile = responsive web | ADR-003 | Pilot PWA failure |
| DES-002 | Operator bottom nav ≤5 items; proposed Home/Tasks/Scan/Records/More | Proposed | Business/UX (TBC) | Cognitive load | 4 items without Scan | IA + Figma frames | INFORMATION_ARCHITECTURE | Usability test |
| DES-003 | Failures-first supervisor queue ordering | Proposed | QA/Operations (TBC) | Safety visibility | Strict FIFO | Queue sort | USER_JOURNEYS J3 | Ops review |
| DES-004 | Never label pre-ACK local data as submitted | Accepted (design direction) | QA/IT (TBC) | Prevent false assurance | Ambiguous “pending” | Copy + sync UI | CONTENT guide; J6 | Sync wording change |
| DES-005 | Critical status = text + icon + pattern (colour optional) | Accepted (design direction) | UX (TBC) | A11y | Colour-only | All status components | ACCESSIBILITY; tokens | Design system change |
| DES-006 | Touch targets min 48px; operator primary 48–56px | Accepted (01A baseline + 01B tokens) | UX (TBC) | Gloves/factory | 44px only | Tokens + components | ACCESSIBILITY; DESIGN_TOKENS | Device pilot |
| DES-007 | Sinhala-first operator labels; EN admin terms | Proposed | Business (TBC) | Constitution + ASM-008 | Full bilingual always | Content + layout | CONTENT guide | Language survey |
| DES-008 | Employee code login field label | Proposed | IT (TBC) | Factory familiarity | Username/email | Login | J1 | Identity source |
| DES-009 | Loading dual-authorization override | Deferred / Decision required | QA (TBC) | High risk | Single override | Journey 5 | WORKFLOW_STATE_MAP | Loading phase |
| DES-010 | Scan in operator primary nav | Proposed / optional | Operations (TBC) | Speed | Manual only | Nav + bottom nav comp | IA-01 | Evidence of need |
| DES-011 | Management dashboard limited to 4–6 KPIs | Proposed | Management (TBC) | Actionability | Large KPI walls | KPI card usage | IA | KPI workshop |
| DES-012 | NC/CAPA in QA nav as Later-labeled | Proposed | QA (TBC) | Honest roadmap | Hide until Phase 12 | QA IA | MVP_SCOPE | MVP approval |
| DES-013 | Lo-fi grayscale in 01A; tokens/components in 01B | Accepted (phase plan) | Project owner | Sequence control | Jump to hi-fi | Pages 04–05 | FIGMA_PLAN | 01B complete |
| DES-014 | Attestation required before operator submit | Assumption | QA (TBC) | Accountability | Submit without attestation | OP-REV | J1.8 | QA policy |
| DES-015 | Date/time display format | Decision required | IT/QA (TBC) | Consistency | Locale-only | Timestamps | CONTENT guide | Locale policy |
| DES-016 | Phase 01A journeys/IA/lo-fi adopted as proposed design baseline | Accepted (owner review 2026-08-04) | Project owner | Enables 01B | Rework 01A | All later design | PHASE_01A approval | Scope change |
| DES-017 | Operational visual direction: approved green/gold industrial palette (`#216E39` primary); avoid purple marketing and cream/terracotta editorial defaults | Accepted (palette direction) | Project owner | Owner-directed palette | Token palette supersedes teal draft | DESIGN_SYSTEM_FOUNDATIONS; P1B-001 | Brand book |
| DES-018 | Typography: Inter + Noto Sans Sinhala | Proposed (01B) | IT / UX (TBC) | Sinhala coverage | Font hosting | DESIGN_TOKENS | Font hosting decision |
| DES-021 | Branch `design/figma-tokens-components` retained instead of renaming to `design/figma-design-system` | Accepted (harmless deviation) | Project owner | PR #3 already open | Docs note only | P1B-010 | None |
| DES-022 | Figma file created for Product Design; incomplete library items remain manual | Recorded | Agent / owner | Connector available | Draft URL in implementation log | FIGMA_IMPLEMENTATION_LOG | 01B approval |
| DES-019 | Light mode only in 01B; dark mode deferred | Proposed (01B) | UX (TBC) | Reduce scope | Ship dark now | Variable modes | TOK-002 | Accessibility request |
| DES-020 | Component library scoped to MVP recording/review/auth/evidence/sync shells | Proposed (01B) | UX (TBC) | Match MVP | Build full enterprise kit | Page 05 | COMPONENT_SYSTEM | 01C needs |
| DES-023 | Figma project-owner account verified: chinthaka / chinthakajayaweera1@gmail.com; Full seat; MCP + browser auth verified | Accepted | Project owner | Owner verification 2026-08-05 | Account mismatch resolved | FIGMA_IMPLEMENTATION_LOG; whoami | Auth change |
| DES-024 | Phase 01B Approved with conditions; remaining variable/component/a11y work continues into 01C; no library publication yet | Accepted | Chinthaka Jayaweera | Owner approval 2026-08-05 | 01C after PR #3 merge; conditions mandatory | PHASE_01B_DESIGN_APPROVAL | Condition closure |
| DES-025 | Phase 01C representative hi-fi screens, P1–P7 prototypes, and docs under review; full inventory gaps tracked in debt register | Recorded | Cursor agent / owner pending | 2026-08-05 Figma + docs pass | HIGH_FIDELITY_SCREEN_SPEC; FIGMA_01C_IMPLEMENTATION_LOG; DESIGN_DEBT_REGISTER | Owner review + debt closure before 01C approval |
| DES-031 | Phase 01C approved with deferred Sinhala typography condition; DEBT-01C-R-NOTO stays open; Phase 02 foundation may proceed; operator UAT/pilot/production blocked until Noto evidenced | Accepted | Chinthaka Jayaweera | Owner decision 01C-D 2026-08-05; 01C-F failed verification | PHASE_01C_HIGH_FIDELITY_APPROVAL; DESIGN_DEBT_REGISTER; PHASE_01C_DECISIONS | Close Noto debt with evidence before UAT/pilot/production |
| DES-032 | Phase 02 branch name `foundation/django-postgresql` supersedes obsolete planned name `feature/phase-02-django-foundation` | Accepted | Project owner | Align with foundation/ branch pattern; avoid obsolete feature/ name | ROADMAP; PHASE_02_TECHNICAL_BASELINE | Branch rename / docs drift |
| DES-026 | MVP foundation screens identified for Phase 02 Django handoff (AUTH-LGN, OP-HOME, OP-TASKS, OP-CHK core, SV-OVR, SV-QUE, SV-REV, QA-OVR, QA-QUE, QA-VER, AD-SHL, AD-USR) | Proposed | Dev lead / owner (TBC) | Phase 02 cannot start until foundation screens complete | Full hi-fi MVP can proceed in parallel | DJANGO_FOUNDATION_DESIGN_HANDOFF | 02 kickoff |
| DES-027 | MVP is online-first; offline capability deferred to Phase 03+ | Proposed (01C decision D-01C-022, D-01C-024, D-01C-026) | Product owner (TBC) | Simplified Phase 02 scope | Full offline MVP | Operator offline states designed as concept | PHASE_01C_DECISIONS; MVP_SCOPE | Offline requirement change |
| DES-028 | Sample data only in Phase 01C screens (EMP-XXXX, SAMPLE-BATCH, XX.X°C); no invented Nelna operational values | Accepted (design direction) | Compliance reviewer | Project rules 09, 12 | Real data | All 01C screen specs | Rule enforcement |
| DES-029 | Proposed Sinhala translations marked PROPOSED; linguistic and domain review pending | Recorded | Content owner (TBC) | Translations require expert review | Skip Sinhala in design | SCREEN_CONTENT_MATRIX | Linguistic approval |
| DES-030 | 21 design debt items tracked (6 blocking, 15 non-blocking); blocking debt must resolve before 01C approval | Recorded | Design owner | Phase 01B conditions + 01C gaps | Silent omission | DESIGN_DEBT_REGISTER | Debt closure |
