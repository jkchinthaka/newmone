# Roadmap — Phase Delivery Plan

**Document status:** Governing roadmap for greenfield delivery
**Canonical status:** [PROJECT_STATUS.md](PROJECT_STATUS.md) (prefer when summaries conflict)
**Phase:** Through Phase **10A** technical foundations on `main`; MASTER-001 / TEMPLATE / role mappings / post-QA workflows still evidence-required
**Last updated:** 2026-08-10 (Phase 41 quality quarantine management)

Branch naming pattern: `foundation/...`, `design/...`, `feature/phase-NN-short-name`, or `hardening/...` as appropriate. Prefer PR review; some authorized units have used direct-`main` quality-first delivery — see [governance/CHANGE_CONTROL.md](governance/CHANGE_CONTROL.md).

**Progress:** Phases **00–10A** technical foundations are on `main` (accounts/RBAC; Shift; FG Product; checklist definition + FG-QA-001 draft loader; ChecklistTask; draft/submit; Supervisor review + correction; QA manual disposition). FG-QA-001 remains **NOT APPROVED** for production (Phase **06N BLOCKED — BUSINESS APPROVAL REQUIRED**). Official master data, role mappings, SoD, batch source/Bileeta, and post-QA RELEASE/HOLD/REJECT operations remain **EVIDENCE REQUIRED**. DEBT-01C-R-NOTO remains **open**. Production readiness **not** claimed. No deployment approval exists. Details: [PROJECT_STATUS.md](PROJECT_STATUS.md).

**Numbering rule:** Preserve roadmap phase numbers. Do **not** rename FG master data, checklist templates, recording, review, or evidence work as Phase 04.

---

## Phase 00 — Discovery and governance

| Field | Content |
| --- | --- |
| Objective | Establish charter, requirements scaffolding, ADRs, risks, security/AI policies, Cursor rules, and delivery control |
| Inputs | Approved technical direction; empty greenfield repository |
| Outputs | Docs tree; Cursor rules; README; decision/assumption/risk registers |
| Approval gate | Manual PR review of foundation docs |
| Branch naming | `foundation/project-discovery` |
| Exit criteria | Required docs and rules merged; no app code; no invented Nelna values |
| Dependencies | None |
| Status | **Complete — merged to main** |

## Phase 01A — User journeys, IA, and low-fidelity specification

| Field | Content |
| --- | --- |
| Objective | Define personas, eight critical journeys, IA, screen inventory, workflow states, lo-fi wireframe specs, language/a11y/responsive rules, Figma build spec, and design approval form |
| Inputs | Phase 00 docs (charter, MVP scope, ADR-003, FIGMA_PLAN, assumptions) |
| Outputs | docs/design/* 01A set; Phase 01A approval form; updated README/ROADMAP/FIGMA_PLAN |
| Approval gate | Manual design review + [PHASE_01A_DESIGN_APPROVAL.md](approvals/PHASE_01A_DESIGN_APPROVAL.md) |
| Branch naming | `design/figma-user-journeys` |
| Exit criteria | Required 01A docs in review/merged; no app code; no false approval claims; no invented Nelna values |
| Dependencies | Phase 00 merged |
| Status | **Complete — merged; owner-approved as proposed baseline (2026-08-04)** |

## Phase 01B — Design tokens and components

| Field | Content |
| --- | --- |
| Objective | Define design tokens and core component system for Figma pages 04â€“05; document build/review/approval path |
| Inputs | Owner-approved 01A baseline; accessibility/content/responsive rules |
| Outputs | DESIGN_TOKENS; COMPONENT_SYSTEM; catalogue/anatomy/patterns; foundations; variables/build guides; tokens JSON; contrast validation; Figma draft file + implementation log; 01B checklist + approval form |
| Approval gate | Design system review + [PHASE_01B_DESIGN_APPROVAL.md](approvals/PHASE_01B_DESIGN_APPROVAL.md) |
| Branch naming | `design/figma-tokens-components` (deviation from planned `design/figma-design-system` — see PHASE_01B_DECISIONS P1B-010) |
| Exit criteria | Token/component specs + artefacts in review; JSON valid; contrast documented; Figma status truthful; no app code; no false approval claims |
| Dependencies | Phase 01A approval |
| Status | **Approved with conditions (2026-08-05) — merged via PR #3** |

## Phase 01C — High-fidelity MVP screens and prototype

| Field | Content |
| --- | --- |
| Objective | High-fidelity MVP screens (pages 06â€“12) and interactive prototype |
| Inputs | 01A journeys/IA; 01B tokens/components; 01B approval conditions |
| Outputs | Hi-fi frames; prototype; developer handoff expansion; continued variable/component/a11y completion |
| Approval gate | Business/QA UX review of MVP flows; [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md) |
| Branch naming | `design/figma-high-fidelity-mvp` |
| Exit criteria | MVP journeys prototype-ready; Sinhala/EN strategy applied with pending translations marked; 01B conditions not omitted; 67 open design decisions resolved or documented |
| Dependencies | Phase 01B approval |
| Status | **Approved with deferred Sinhala typography condition (2026-08-05) — Phase 02 foundation authorized after PR #4 merge; DEBT-01C-R-NOTO remains open** |

## Phase 01 — Figma journeys and design system (umbrella)

| Field | Content |
| --- | --- |
| Objective | Umbrella for 01Aâ€“01C per FIGMA_PLAN |
| Inputs | Charter, MVP scope, questionnaire answers as available |
| Outputs | Complete Figma foundation through hi-fi prototype |
| Approval gate | See 01A/01B/01C gates |
| Branch naming | See sub-phases |
| Exit criteria | Journeys agreed; tokens/components done; hi-fi MVP reviewed |
| Dependencies | Phase 00 |

## Phase 02 — Django/PostgreSQL foundation

| Field | Content |
| --- | --- |
| Objective | Create Django 5.2 project, PostgreSQL, Docker Compose, settings layout, Pytest skeleton, CI gates, frontend build baseline |
| Inputs | ADRs; environment strategy; Phase 01C deferred-condition approval |
| Outputs | Runnable local foundation without business modules; Phase 02 docs/ADRs |
| Approval gate | Technical review — [PHASE_02_TECHNICAL_FOUNDATION_APPROVAL.md](approvals/PHASE_02_TECHNICAL_FOUNDATION_APPROVAL.md) |
| Branch naming | `foundation/django-postgresql` (obsolete planned name `feature/phase-02-django-foundation` **superseded**) |
| Exit criteria | App boots locally; base migrations OK; CI gates defined; no invented business data; approval form signed |
| Dependencies | Phase 01C approved with deferred Sinhala condition |
| Status | **Approved with conditions** — merged via PR #5 / #6; DEBT-01C-R-NOTO remains open |

## Phase 03 — Accounts and RBAC

| Field | Content |
| --- | --- |
| Objective | Employee-code identity, session auth, lockout, org/site/department scope, Django-permission roles, scoped assignments, security audit |
| Inputs | Phase 02 approved foundation; security baseline |
| Outputs | `accounts`, `organizations`, `access_control`, `security_audit`; ADRs 006â€“007; Phase 03 approval form |
| Approval gate | Security-focused PR review — [PHASE_03_ACCOUNTS_RBAC_APPROVAL.md](approvals/PHASE_03_ACCOUNTS_RBAC_APPROVAL.md) |
| Branch naming | `feature/accounts-rbac` |
| Exit criteria | Auth/RBAC/lockout/audit tests pass; no seeded users/orgs/roles; no business workflows; approval form signed |
| Dependencies | Phase 02 |
| Status | **Approved with conditions (2026-08-06)** — merged via PR #7 (and related follow-ups); DEBT-01C-R-NOTO remains open; authentication UI polish merged via PR #8 |

## Phase 03C — Operational role governance

| Field | Content |
| --- | --- |
| Objective | Strengthen operational permission catalogue, RoleTemplate technical bundles, audited role-permission updates, and SoD question register without inventing approved Nelna roles |
| Inputs | Phase 03 RBAC; APR-007..010 open; CHECKLIST_RECORDER_ROLE_MAPPING |
| Outputs | `permission_catalogue.py`; `RoleTemplate`; governance services; PERMISSION_MATRIX; PHASE_03C docs/tests; APR-040 |
| Approval gate | Business role mappings remain EVIDENCE REQUIRED — final status **PHASE 03C BUSINESS ROLE APPROVAL PENDING** |
| Exit criteria | Technical gates pass; no seeded company-approved roles; SoD questions PENDING; manage≠record≠review≠QA preserved |
| Dependencies | Phase 03 |
| Status | **Technical foundation** — BUSINESS ROLE APPROVAL PENDING |

## Phase 04 — Organization hierarchy and shifts

| Field | Content |
| --- | --- |
| Objective | Complete residual organization-hierarchy confirmation and introduce a configurable Shift foundation without inventing official Nelna business values |
| Inputs | Owner provisional technical direction (2026-08-07); later real ASM-004/005/006 evidence for production configuration |
| Outputs | Hierarchy confirmation record; configurable unseeded `organizations.Shift` foundation (Phase 04A); management UI (Phase 04B); real-data config after evidence (remaining) |
| Approval gate | Technical review of 04A/04B; real-data / UAT still blocked until ASM evidence and DEBT-01C-R-NOTO closure |
| Branch naming | Direct-main for 04A/04B quality-first workflow; feature branches optional |
| Exit criteria | Phase 04A: configurable Shift model/services/selectors/audit/admin/tests without seeded business rows. Phase 04B: authorized Shift management UI. Full Phase 04: real Shift values configured after evidence; scoped queries remain sound |
| Dependencies | Phase 03 complete; Phase 04 scope reconciliation (PR #10); owner provisional decision for configurable foundation |
| Status | **04A + 04B + 04C technical foundation implemented** — Phase 04 **not** fully complete; real-data configuration / UAT pending |

### Phase 04 scope statement

Phase 04 completes residual organization-hierarchy confirmation and introduces Shift support. Organization, Site, and Department **already exist** from Phase 03 and are not rebuilt. Phase **04A** delivers a configurable, unseeded Shift domain foundation under owner provisional direction ([PHASE_04_SHIFT_PROVISIONAL_CONFIGURATION.md](decisions/PHASE_04_SHIFT_PROVISIONAL_CONFIGURATION.md), [ADR-008](architecture/ADR-008-CONFIGURABLE-SHIFT-FOUNDATION.md)). Phase **04B** delivers the Shift management UI ([SHIFT_MANAGEMENT_UI.md](design/SHIFT_MANAGEMENT_UI.md)). Phase **04C** adds audited Org/Site/Department lifecycle + controlled hierarchy import (no seeded company values). Administrator entry of real business values after ASM evidence remains outstanding. FG products, checklist definitions, checklist records, review workflows and attachments remain explicitly **outside** Phase 04.

### Phase 04 business gates

| Gate | Requirement | Status |
| --- | --- | --- |
| ASM-004 | Confirm official organization / site / department naming and hierarchy | **DECISION REQUIRED** — remains unresolved for official names/codes; models exist; no inventing Nelna values |
| ASM-005 | Confirm shift names and codes | **EVIDENCE REQUIRED** — remains unresolved for official Shift names/codes; technical configurable foundation provisionally unblocked only |
| ASM-006 | Confirm shift timing, overnight behavior, and effective-date rules | **DECISION REQUIRED** — remains unresolved for official timings/policy; provisional overnight derivation (`end <= start`) is technical only |

Do **not** invent or seed Day/Night shift names, official shift start/end times, official shift codes, site codes, or department codes. Authorized users configure real Shift values later. Production use remains prohibited until real data and UAT are confirmed.

### Phase 04 out of scope

- FG Product / product category
- Checklist builder, definition, or versioning
- Checklist recording, draft/save/submit
- Supervisor review, approval, rejection, return
- Attachments / evidence storage
- Reports / dashboards
- ERP integration
- Offline sync
- Sinhala UI approval
- Deployment / production readiness claims

## Phase 05 — FG operational master data, instruments and training

| Field | Content |
| --- | --- |
| Objective | Minimal FG / operational master data for MVP templates; instruments/training as approved |
| Inputs | Owner provisional Product foundation decision (2026-08-07); later MASTER-001 evidence for real catalogues |
| Outputs | `master_data` FG Product foundation (05A); authz hardening + MASTER-001 intake (05B); expandable optional mapping fields + controlled CSV import (05C); `instruments` equipment + calibration foundation (05D); `training` competency foundation (05E) |
| Approval gate | Data owner review for real data; technical review of 05A/05B/05C/05D/05E |
| Branch naming | Direct-main quality-first for 05A/05B/05C/05D/05E |
| Exit criteria | 05A: configurable unseeded FG Product model/services/selectors/UI/audit without seeded business rows. 05B: object-aware Product UI affordances + MASTER-001 evidence intake readiness. 05C: optional mapping/attribute blanks + controlled import (no official catalogue). 05D: unseeded equipment + calibration records + fitness labels + checklist optional equipment flag (no invented intervals; no overdue block policy). 05E: unseeded training records + currency labels + OFF/WARN/BLOCK policy metadata (no invented matrix; no recording auto-block). Full Phase 05: evidenced entities only after MASTER-001 / calibration / training evidence |
| Dependencies | Phase 04 (04A/04B/04C technical complete; official org/shift values still pending) |
| Status | **05A–05E technical foundations implemented** — MASTER-001 unresolved; training unseeded (no invented matrices); recording training gates default OFF; official catalogues **not** received; Phase 05 **not** fully complete |
| Notes | **Not** Phase 04. Do not invent calibration intervals or training matrices. Site-only RBAC does not imply organization Product/equipment/training management under provisional ownership. No live Bileeta calls in 05C. |

## Phase 06 — Checklist definition and versioning

| Field | Content |
| --- | --- |
| Objective | Versioned checklist definitions/templates for later operational use |
| Inputs | Owner provisional definition-engine decision (2026-08-07); later TEMPLATE / ASM evidence for real forms |
| Outputs | `checklists` definition foundation (06A); governance hardening + TEMPLATE-001 intake (06B); response-definition schema + FG-QA-001 **proposed draft** artifact (06C); explicit DRAFT loader + internal validation worksheet (06D); owner-directed provisional workflow formalization (06E); **real form discovery framework (06F)**; **Checklist Engine v2 architecture design (06G / ADR-019)**; real content later as approved |
| Approval gate | QA content approval for real forms; technical review of 06A–06G |
| Branch naming | Direct-main quality-first for 06A–06G |
| Exit criteria | 06A: configurable unseeded Template/Version/Section/Item with immutable publish, RBAC, UI, audit. 06B: centralized lifecycle, concurrency/immutability hardening, evidence intake readiness. 06C: provisional response-definition primitives + draft proposal artifact (not production content). 06D: explicit Organization-scoped DRAFT load (never publish/auto-seed) + stakeholder validation package. 06E: record owner-directed provisional workflow without claiming formal QA/Production approval. 06F: formal real-company form discovery package with no invented form rows. 06G: Engine v2 architecture ADR + 06H–06M split without schema-shaping implementation. Full Phase 06: evidenced forms only after TEMPLATE evidence and APPROVED FOR DIGITALIZATION |
| Dependencies | Phase 05 technical foundation (Product optional association); TEMPLATE evidence for content |
| Status | **06A-06O** — Engine v2 designed (ADR-019); 06H-06M technical foundations; **06N FG-QA-001 validation BLOCKED**; **06O versioned product specs technical (no seeded limits; APR-006 EVIDENCE REQUIRED)**; inventory NOT RECEIVED; FG-QA-001 remains project-proposed DRAFT; Phase 06 not fully complete |
| Notes | **Not** Phase 04. Definition/versioning + response **definition** schema only for executed code path today. No invented temperature limits; no automatic RELEASE/HOLD/REJECT. FG-QA-001 draft is **NOT APPROVED**. AI industry reports are research inputs only. Engine v2 extends current domain — no parallel engine. Phase 07A technical foundation may proceed under provisional workflow; full Phase 07 production readiness remains evidence-gated. |

## Phase 07 — Scheduling and tasks

| Field | Content |
| --- | --- |
| Objective | Schedules and task assignment |
| Inputs | Owner-directed provisional per-batch trigger (06E); later frequency/applicability evidence for production generation |
| Outputs | **07A:** `scheduling.ChecklistTask` foundation; **07B:** batch-source contract + integration port + `record_checklisttask` permission foundation + production/Phase 08 readiness gates; later recurrence/`schedules` as approved |
| Approval gate | Operations review of due logic for full Phase 07; 07A–07H are technical/readiness only |
| Branch naming | Direct-main quality-first for 07A/07B/07C/07D |
| Exit criteria | **07A:** org-scoped create/cancel/list/detail with RBAC, audit, uniqueness, no recording/HOLD. **07B:** source contract + manage≠record permission architecture; no ERP invention. **07C:** applicability engine without silent multi-match. **07D:** deterministic PUBLISHED effective-version selection (APR-015 as-of still DECISION REQUIRED). **07E:** recurring schedule definitions + idempotent generation (frequencies still EVIDENCE REQUIRED). **07F:** batch-event adapter boundary (live APR-011 contract still REQUIRED). **07G:** task assignment ownership workflow (never grants RBAC). **07H:** due/overdue foundation (derived states; no invented SLA; no auto-NCR). Full Phase 07: operators see correct due work from evidenced batch source + published approved definitions |
| Dependencies | Phase 06 technical + 06E provisional workflow; FG-QA-001 publish + batch source for real generation |
| Status | **07A–07H** — technical foundations; real production task generation still **BLOCKED** (07F live contract required) |

## Phase 08 — Checklist recording and submission (draft → submit)

| Field | Content |
| --- | --- |
| Objective | Online draft and submission UX and record services (DRAFT → SUBMITTED) |
| Inputs | Figma operator screens; published templates; approved recorder role mapping |
| Outputs | **08A:** `recording.ChecklistRecord` / `ChecklistResponse` draft foundation + Save Draft UI; **08B:** `ChecklistSubmission` / `ChecklistSubmissionResponse` immutable snapshots + Submit UI; **08C:** autosave + optimistic `draft_version` + online session recovery + shop-floor UX + optional equipment/evidence hooks |
| Approval gate | Operator UAT sample (Sinhala UAT still blocked by DEBT-01C-R-NOTO); Phase 08 readiness gate for production use |
| Branch naming | Direct-main quality-first for 08A/08B/08C |
| Exit criteria | **08A:** typed draft responses; record permission enforced; partial draft allowed. **08B:** completeness submit; immutable snapshot; post-submit edit blocked; no Submit/HOLD evaluation. **08C:** safe autosave; no silent last-write-wins; online session recovery; UX hardening; no draft leakage. Full Phase 08 production: evidenced published definitions + recorder mapping |
| Dependencies | Phase 07 technical; Phase 01 progress; published pilot definition + recorder mapping for production |
| Notes | **Not** Phase 04. Do not include supervisor approval in this phase. **08A–08C technical foundations complete**; **production recording remains BLOCKED** (FG-QA-001 unpublished; role mapping open). Offline IndexedDB is Phase 14. |
| Status | **08A–08C implemented** — draft + immutable submit + shop-floor hardening; Phase 09+ blocked |

## Phase 09 — Supervisor checking and amendments

| Field | Content |
| --- | --- |
| Objective | Supervisor check workflow (approve / return for correction / related amendments) and amendment history |
| Inputs | SoD rules (EVIDENCE REQUIRED) |
| Outputs | **09A:** `reviews.SupervisorReview` immutable decisions on `ChecklistSubmission` + review UI; **09B:** `ChecklistCorrection` + resubmission as Submission #N+1; **09C:** governance policy (self-review PENDING/PROHIBIT/ALLOW), configured review SLA queues, temporary RBAC delegation |
| Approval gate | QA/operations workflow review |
| Branch naming | Direct-main quality-first for 09A/09B/09C |
| Exit criteria | **09A:** separate review permission; one review per submission; APPROVED/RETURNED without mutating snapshots. **09B:** controlled correction without mutating source submission/review; next submission number race-safe. **09C:** explicit SoD posture (no invented prohibition while PENDING); overdue only from configured SLA; temporary delegation time-bounded; pending/overdue/resubmission queues. Full Phase 09 production: SoD evidence + role mapping + published definitions |
| Dependencies | Phase 08 |
| Notes | **Not** Phase 04. **09A+09B+09C technical foundations complete**; production Supervisor review/correction **BLOCKED**. SoD self-review rule not invented. No QA/HOLD/RELEASE in Phase 09. Ownership locking for correction remains EVIDENCE REQUIRED. |
| Status | **09A + 09B + 09C implemented** — governance hardening; production use blocked |

## Phase 10 — QA verification

| Field | Content |
| --- | --- |
| Objective | QA final review with manual provisional disposition; later operational follow-up only when evidenced |
| Inputs | QA rules evidence |
| Outputs | **10A:** `quality.QAReview` immutable RELEASE/HOLD/REJECT + QA UI; **10B:** derived operational workflow (ADR-022) without duplicated status columns; later units for post-QA warehouse/ERP |
| Approval gate | QA owner |
| Branch naming | Direct-main quality-first for 10A |
| Exit criteria | **10A:** separate QA permission; one immutable QAReview per submission; no auto disposition; no ERP side effects. Full production: follow-up evidence + role mapping + published definitions |
| Dependencies | Phase 09 |
| Notes | Supervisor-owned return/correction remains Phase 09. See PHASE_10_QA_REVIEW_READINESS_GATE and PHASE_10_POST_QA_WORKFLOW_GATE. Production QA **BLOCKED**. |
| Status | **10A + 10B implemented** — QA disposition + derived workflow lifecycle; production use blocked; post-QA warehouse/ERP still not started |

## Phase 11 — Attachments and evidence storage

| Field | Content |
| --- | --- |
| Objective | MinIO/S3 evidence upload, attachment metadata, and controlled access |
| Inputs | Security baseline; volume assumptions (ASM-017) |
| Outputs | `evidence` module — private attachments, SHA-256, auth download, soft-retire, scanner interface |
| Approval gate | IT security review of access patterns |
| Branch naming | Direct-main quality-first for Phase 11 technical foundation |
| Exit criteria | No DB BLOBs; private storage; authorized download; allowlist/size/hash; soft-retire; honest NOT_CONFIGURED scan status. Signed URL / MinIO production IAM remain follow-up |
| Dependencies | Phase 08+ |
| Notes | **Not** Phase 04. Malware scanning and retention remain deferred until decided. See ADR-023. |
| Status | **11 implemented** — production object-store IAM / active malware scanner still EVIDENCE REQUIRED |

## Phase 12 — Non-conformance, holds and CAPA

| Field | Content |
| --- | --- |
| Objective | Configurable quality-case foundation (NCR / HOLD / CAPA) without invented Nelna policies |
| Inputs | QA procedures (still EVIDENCE REQUIRED for production rules) |
| Outputs | Expanded `nonconformance` + `HoldCase`; expanded `capa` + action items + history; ADR-024 |
| Approval gate | QA |
| Branch naming | Direct-main quality-first for Phase 12 technical foundation |
| Exit criteria | Human-only CAPA closure; no FAIL/CCP auto-raise; correction ≠ NCR; separate create/manage/close permissions |
| Dependencies | Phase 10–11 |
| Status | **12 foundation implemented** — severity/resolution catalogues / auto-raise rules still EVIDENCE REQUIRED |

## Phase 13 — Loading, dispatch and cold-chain controls

| Field | Content |
| --- | --- |
| Objective | Loading/dispatch quality foundation without invented release/temperature rules |
| Inputs | Dispatch SOPs (EVIDENCE REQUIRED for production limits/policy) |
| Outputs | `apps.dispatch` (DispatchQualityRecord, cold-chain, quantity lines, release policy); ADR-025 |
| Approval gate | Dispatch + QA (business policy still EVIDENCE REQUIRED) |
| Branch naming | Direct-main quality-first for Phase 13 technical foundation |
| Exit criteria | No AI loading release; QA RELEASE gate configurable default OFF; no ERP writes |
| Dependencies | Phase 10–11 |
| Status | **13 foundation implemented** — SOPs / temperature limits / APR-017 gate enablement still EVIDENCE REQUIRED |

## Phase 14 — Offline PWA and synchronization

| Field | Content |
| --- | --- |
| Objective | Decide and, only if justified, deliver controlled offline checklist drafts |
| Inputs | Wi-Fi/device/hosting/outage/security evidence; APR-022 |
| Outputs | ADR-026 decision; offline client **only if** gate passes |
| Approval gate | IT + QA + Production (APR-022) |
| Branch naming | `feature/phase-14-offline-sync` (implementation deferred) |
| Exit criteria (implementation) | Offline tests; idempotent sync — **not started** |
| Decision (2026-08-10) | **Online-only continues; offline NOT IMPLEMENTED** — evidence gate failed (ASM-009/010/015, APR-021/022/030/031 open) |
| Status | **PHASE 14 ONLINE ONLY APPROVED — OFFLINE NOT IMPLEMENTED** |

## Phase 15 — Notifications

| Field | Content |
| --- | --- |
| Objective | In-app (+ optional email) workflow notifications without sensitive payload leaks |
| Inputs | SMTP env (optional); org policy |
| Outputs | `apps.notifications`; ADR-027 |
| Approval gate | IT + Operations (which events to enable in production) |
| Branch naming | Direct-main quality-first for Phase 15 foundation |
| Exit criteria | In-app inbox; policy default OFF; idempotent email; no SMS; privacy tests |
| Status | **Technical foundation IMPLEMENTED** — production event enablement EVIDENCE REQUIRED |

## Phase 16 — Reports and audit export

| Field | Content |
| --- | --- |
| Objective | Governed operational reports and CSV exports with org RBAC |
| Inputs | Immutable submissions; audit/NCR/CAPA/dispatch domain data |
| Outputs | `apps.reports`; ADR-028; catalogue + ReportRun |
| Approval gate | QA / Internal audit (official packs EVIDENCE REQUIRED) |
| Branch naming | Direct-main quality-first for Phase 16 foundation |
| Exit criteria | Catalogue; org RBAC; immutable historical sources; CSV injection guard; async large runs; tests |
| Dependencies | Audit events from earlier phases |
| Status | **Technical foundation IMPLEMENTED** — official report packs / Excel-PDF EVIDENCE REQUIRED |

## Phase 17 — ERP integration

| Field | Content |
| --- | --- |
| Objective | Approved API integration only — never invent endpoints |
| Inputs | Vendor API docs / sandbox / auth (APR-011/012) — **MISSING** |
| Outputs | `apps.integrations` contracts, mocks, evidence gate (ADR-029) |
| Approval gate | IT + ERP vendor |
| Branch naming | Direct-main quality-first for Phase 17 boundary |
| Exit criteria | No direct ERP DB writes; recording works if ERP down; live calls only with evidence |
| Dependencies | ASM-014 |
| Status | **PHASE 17 BLOCKED — VENDOR API EVIDENCE REQUIRED** (boundary/mocks delivered) |

## Phase 18 — Local AI and anomaly detection

| Field | Content |
| --- | --- |
| Objective | Optional local AI assistance without delegating quality decisions |
| Inputs | AI safety policy |
| Outputs | `apps.ai_assistance`; ADR-030 |
| Approval gate | QA + IT acknowledgement before enabling in non-dev |
| Branch naming | Direct-main quality-first for Phase 18 foundation |
| Exit criteria | Advisory only; core flows work with AI off; safety tests |
| Dependencies | Stable workflows; AI policy acknowledgement |
| Status | **Technical foundation IMPLEMENTED** — enablement / prompt retention EVIDENCE REQUIRED |

## Phase 19 — Security, backup, monitoring and performance

| Field | Content |
| --- | --- |
| Objective | Harden, monitor, backup/restore, performance verify |
| Inputs | NFR approvals; env strategy |
| Outputs | Runbooks; monitoring; restore evidence |
| Approval gate | IT security + ops |
| Branch naming | `hardening/phase-19-security-ops` |
| Exit criteria | Restore drill passed; security review recorded |
| Status | **Technical controls delivered** on `main` (ADR-031); RPO/RTO still COMPANY DECISION REQUIRED |
| Dependencies | Staging-like environment |

## Phase 20 — Pilot, UAT and parallel paper run

| Field | Content |
| --- | --- |
| Objective | Pilot with parallel paper as directed |
| Inputs | Trained users; approved MVP content |
| Outputs | UAT evidence; pilot report |
| Approval gate | Business + QA + IT |
| Branch naming | `pilot/phase-20-uat` (config/docs); code fixes via fix branches |
| Exit criteria | Exit criteria met; critical defects closed |
| Dependencies | Phases through applicable MVP scope + Phase 19 as required |
| Status | **BLOCKED** — UAT package on `main` (`docs/uat/`); business evidence / APR-034 / FG-QA-001 / hosted pilot EVIDENCE REQUIRED; no invented PASS |

## Phase 21 — Production release and handover

| Field | Content |
| --- | --- |
| Objective | Controlled production release and handover |
| Inputs | Approvals; restore + security evidence |
| Outputs | Production release record; admin handover |
| Approval gate | Project + Business + QA + IT owners |
| Branch naming | `release/phase-21-production` |
| Exit criteria | Explicit written approval; no silent go-live |
| Status | **GO-LIVE BLOCKED** — release package on `main` (`docs/release/`); ADR-033; Phase 20 FAIL; no production tag; STOP |
| Dependencies | Phase 20 pass |

## Phase 22 — Laboratory / LIMS foundation

| Field | Content |
| --- | --- |
| Objective | Generic lab sample/test/result foundation linked to FG quality workflows |
| Inputs | QA/lab evidence (catalogue & positive-release policy still open) |
| Outputs | `apps.laboratory`; ADR-032 |
| Approval gate | QA owner for catalogue/positive-release; technical review of foundation |
| Branch naming | Direct-main quality-first for Phase 22 technical foundation |
| Exit criteria | Sample provenance, immutable finalized results + amendment, policy stub default OFF, tests |
| Dependencies | Org/RBAC, product/spec hooks, NCR/Hold, evidence, QA modules |
| Status | **Technical foundation complete** — lab catalogue / positive-release EVIDENCE REQUIRED |

---

**Production readiness is not claimed by the existence of this roadmap.**

## Phase 23 — HACCP / control-point foundation

| Field | Content |
| --- | --- |
| Objective | Versioned HACCP plan architecture (no invented CCPs/limits) |
| Outputs | `apps.haccp`; ADR-035 |
| Approval gate | Actual company HACCP plan EVIDENCE REQUIRED |
| Status | **Technical foundation delivered** on `main` |

## Phase 24 — Configurable sampling engine

| Field | Content |
| --- | --- |
| Objective | Versioned sampling plans without inventing AQL/ISO tables |
| Outputs | `apps.sampling`; ADR-036 |
| Status | **Technical foundation delivered** on `main` |

## Phase 25 — Measurement device traceability

| Field | Content |
| --- | --- |
| Objective | Link measurements to exact device + calibration state |
| Outputs | device_traceability; ADR-037; frozen response snapshots |
| Status | **Technical foundation delivered** on `main` |

## Phase 26 — Foreign body / metal-detector control

| Field | Content |
| --- | --- |
| Objective | Configurable challenge verification without invented limits |
| Outputs | `apps.foreign_body`; ADR-038 |
| Status | **Technical foundation delivered** on main |

## Phase 27 — Sanitation / SSOP checklist workflows

| Field | Content |
| --- | --- |
| Objective | Digital sanitation/SSOP using existing checklist engine + scheduler |
| Outputs | `apps.sanitation`; ADR-039; fail-stop default OFF |
| Status | **Technical foundation delivered** on `main` |

## Phase 28 — Environmental monitoring foundation

| Field | Content |
| --- | --- |
| Objective | Generic EM points, versioned limits, MANUAL/LAB/SENSOR readings |
| Outputs | `apps.environmental`; ADR-040; auto-HOLD default OFF |
| Status | **Technical foundation delivered** on `main` |

## Phase 29 — Packaging label / artwork verification

| Field | Content |
| --- | --- |
| Objective | Versioned packaging artwork linked to product, checklist, and batch history |
| Outputs | `apps.packaging`; ADR-041; manage≠approve; no shelf-life calculation |
| Status | **Technical foundation delivered** on `main` |

## Phase 30 — Allergen / changeover / line-clearance foundation

| Field | Content |
| --- | --- |
| Objective | Configurable allergen declaration, changeover, and checklist-driven line clearance |
| Outputs | `apps.changeover`; ADR-042; production-block dual-gate default OFF |
| Status | **Technical foundation delivered** on `main` |

## Phase 31 — Raw / material receiving quality

| Field | Content |
| --- | --- |
| Objective | Incoming material quality against ERP GRN without owning inventory |
| Outputs | `apps.receiving`; ADR-043; LIMS link; ERP outbound blocked |
| Status | **Technical foundation delivered** on `main` |

## Phase 32 — Supplier quality management foundation

| Field | Content |
| --- | --- |
| Objective | Supplier quality records keyed by ERP supplier reference without a financial supplier master |
| Outputs | `apps.supplier_quality`; ADR-020; QA manage ≠ Procurement view; count-only metrics |
| Status | **Technical foundation delivered** on `main` |

## Phase 33 — Incoming Quality Control (IQC) workflow

| Field | Content |
| --- | --- |
| Objective | Configurable IQC: GRN → task → record → review → local disposition |
| Outputs | `apps.iqc`; ADR-044; sampling/LIMS hooks; ERP dual-gate OFF |
| Status | **Technical foundation delivered** on `main` |

## Phase 34 — In-Process Quality Control (IPQC) workflows

| Field | Content |
| --- | --- |
| Objective | Process checks during production, separate from FG release |
| Outputs | `apps.ipqc`; ADR-045; triggers; measurement/equipment/sampling; fail dual-gate OFF; NCR/HOLD escalate; dashboard |
| Status | **Technical foundation delivered** on `main` |

## Phase 35 — Electronic Batch Quality Dossier (EBR)

| Field | Content |
| --- | --- |
| Objective | Read-only aggregated batch quality dossier without duplicating source data |
| Outputs | `apps.batch_dossier`; ADR-046; timeline; section authz; paginated evidence/audit; PDF export hook dual-gate OFF |
| Status | **Technical foundation delivered** on `main` |

## Phase 36 — Batch Genealogy Traceability

| Field | Content |
| --- | --- |
| Objective | Backward/forward product genealogy from authoritative ERP/production data |
| Outputs | `apps.batch_genealogy`; ADR-047; opaque nodes/edges; rework; cycle prevention; flat Mongo projection dual-gate OFF |
| Status | **Technical foundation delivered** on `main` |

## Phase 37 — Product Recall / Withdrawal Management

| Field | Content |
| --- | --- |
| Objective | Controlled recall/withdrawal case management with genealogy-backed scope |
| Outputs | `apps.recall`; ADR-048; quantity reconciliation; communication refs; initiate SoD; dual-gates OFF |
| Status | **Technical foundation delivered** on `main` |

## Phase 38 — Mock Recall Exercises

| Field | Content |
| --- | --- |
| Objective | Mock recall exercises without affecting real product/inventory status |
| Outputs | `apps.recall` MOCK mode; ADR-049; metrics; isolation guards; findings→NCR/CAPA/improvement |
| Status | **Technical foundation delivered** on `main` |

## Phase 39 — Customer Quality Complaint Management

| Field | Content |
| --- | --- |
| Objective | Traceable customer quality complaint management with batch-trace and investigation links |
| Outputs | `apps.customer_complaints`; ADR-050; privacy redaction; dual-gate auto-send OFF; APR-064 |
| Status | **Technical foundation delivered** on `main` |

## Phase 40 — Returned Product Quality

| Field | Content |
| --- | --- |
| Objective | Controlled returned-product quality workflow keyed to ERP/SFA return references without making stock saleable or moving ERP stock by default |
| Outputs | `apps.product_returns`; ADR-051; quarantine-by-default records; checklist inspection hooks; disposition architecture; ERP stock movement dual-gate OFF; APR-065 |
| Approval gate | Return disposition / quarantine / ERP stock movement evidence approval |
| Branch naming | `feature/phase-40-returned-product-quality` |
| Exit criteria | Return quality records are org-scoped and quarantine-on-create; checklist inspection uses the existing checklist engine; evidence linking is allowlisted; ERP stock movement remains blocked unless both runtime and organization gates are approved; no invented return catalogues, owners, or ERP endpoints |
| Status | **Technical foundation delivered** on `main` — business SOP, disposition catalogue, and ERP stock movement enablement remain **EVIDENCE REQUIRED** |

## Phase 41 ? Quality Quarantine Management

| Field | Content |
| --- | --- |
| Objective | Auditable application-side quarantine state while ERP remains the authoritative inventory ledger |
| Outputs | `apps.quality_quarantine`; ADR-052; source-linked cases; append-only events; policy-gated quantity refs; release and ERP outbound dual-gates; APR-066 |
| Approval gate | Quarantine/release procedure, role mapping, quantity semantics, and ERP adapter evidence |
| Branch naming | `feature/phase-41-quality-quarantine` |
| Exit criteria | Cases are organization-scoped; multiple cases per batch are allowed; history is append-only; release requires scoped permission plus runtime approval; ERP outbound remains fail-closed; no invented operational values |
| Status | **Technical foundation delivered** — business procedure, role mapping, and ERP contract remain **EVIDENCE REQUIRED** |

## Phase 42 — Controlled Rework Management

| Field | Content |
| --- | --- |
| Objective | Controlled rework with source/result genealogy; REJECT never auto-creates rework |
| Outputs | `apps.rework`; ADR-053; create/authorize/execute; genealogy; new reinspection; ERP stock dual-gate OFF; APR-067 |
| Approval gate | Rework authorization SoD, quantity semantics, and ERP adapter evidence |
| Branch naming | `feature/phase-42-controlled-rework` |
| Exit criteria | Cases are org-scoped; create/authorize are separate grants; genealogy preserves source/result/remaining qty; original QA/HOLD/NCR unchanged; reinspection targets resulting batch; ERP outbound remains fail-closed |
| Status | **Technical foundation delivered** on `main` — rework SOP and ERP enablement remain **EVIDENCE REQUIRED** |

## Phase 43 — Quality Document Control

| Field | Content |
| --- | --- |
| Objective | Controlled versioned management of quality procedures |
| Outputs | `apps.document_control`; ADR-054; lifecycle; immutability; effective lookup; historical links; Phase 11 files; optional acknowledgement; APR-068 |
| Approval gate | Document numbering, type catalogue, acknowledgement obligation, and approver SoD |
| Branch naming | `feature/phase-43-document-control` |
| Exit criteria | Org-scoped documents; approved/effective versions immutable; operators see effective only; quality records can cite exact version; ack ≠ competency |
| Status | **Technical foundation delivered** on `main` — document-control SOP remains **EVIDENCE REQUIRED** |

## Phase 44 — Quality Change Control

| Field | Content |
| --- | --- |
| Objective | Formal change-control records for significant quality/process/configuration changes |
| Outputs | `apps.change_control`; ADR-055; impact assessment; affected links; implementation citation; APR-069 |
| Approval gate | Change SOP, numbering, risk scoring, and approval/verification SoD |
| Branch naming | `feature/phase-44-change-control` |
| Exit criteria | Org-scoped requests; impact before approval; engineering ≠ approval; closed historically immutable |
| Status | **Technical foundation delivered** on `main` — change-control SOP remains **EVIDENCE REQUIRED** |

## Phase 45 — Quality Audit Management

| Field | Content |
| --- | --- |
| Objective | Structured QMS audit planning, execution, findings, and follow-up |
| Outputs | `apps.quality_audits`; ADR-056; findings; explicit NCR/CAPA; audit-checklist bind; reports; APR-070 |
| Approval gate | Audit programme, frequency, severity catalogue, and auditor SoD |
| Branch naming | `feature/phase-45-quality-audit-management` |
| Exit criteria | Org-scoped audits; findings do not auto-create CAPA; auditor perms ≠ operational QA; distinct from security_audit |
| Status | **Technical foundation delivered** on `main` — audit programme remains **EVIDENCE REQUIRED** |

## Phase 46 — Compliance Control Mapping

| Field | Content |
| --- | --- |
| Objective | Controlled register mapping system controls to company-applicable sources as evidence support only |
| Outputs | `apps.compliance_mapping`; ADR-057; source editions; mappings; explicit gap actions; APR-071 |
| Approval gate | Official sources/editions, applicability decisions, licensed clause text, owner mapping |
| Branch naming | `feature/phase-46-compliance-control-mapping` |
| Exit criteria | No certification/legal claims; IMPLEMENTED ≠ COMPLIANT; no seeded applicability; explicit gap follow-up |
| Status | **Technical foundation delivered** on `main` — company/external evidence remains **EVIDENCE REQUIRED** |

## Phase 47 — Quality Risk Management

| Field | Content |
| --- | --- |
| Objective | Configurable quality-risk register without inventing Nelna scoring |
| Outputs | `apps.quality_risks`; ADR-058; historical assessments; mitigations; APR-072 |
| Approval gate | Scoring method, category catalogue, review cadence, acceptance criteria |
| Branch naming | `feature/phase-47-quality-risk-management` |
| Exit criteria | No hardcoded 1–5/RAG; scoring default OFF; append-only assessments; accept perm separate |
| Status | **Technical foundation delivered** on `main` — scoring methodology remains **EVIDENCE REQUIRED** |

## Phase 48 — Process FMEA

| Field | Content |
| --- | --- |
| Objective | Structured Process FMEA linked to quality-risk architecture without inventing RPN/AP policy |
| Outputs | `apps.process_fmea`; ADR-059; versioned worksheets; APR-073 |
| Approval gate | PFMEA methodology, rating scales, RPN or Action Priority use, review cadence |
| Branch naming | `feature/phase-48-process-fmea` |
| Exit criteria | Approved versions immutable; scoring default OFF; S×O×D only after configured model; explicit CAPA/change |
| Status | **Technical foundation delivered** on `main` — PFMEA methodology remains **EVIDENCE REQUIRED** |

## Phase 49 — Structured RCA

| Field | Content |
| --- | --- |
| Objective | Optional structured RCA tools for NCR, complaint, audit finding, and CAPA |
| Outputs | `apps.rca`; ADR-060; 5 Why/fishbone/cause table; APR-074 |
| Approval gate | RCA SOP, required method (if any), investigator SoD |
| Branch naming | `feature/phase-49-structured-rca` |
| Exit criteria | Methods optional; AI hypothesis ≠ confirmed; confirm perm separate; explicit CAPA |
| Status | **Technical foundation delivered** on `main` — RCA SOP remains **EVIDENCE REQUIRED** |
