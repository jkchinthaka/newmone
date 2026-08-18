# Project Status — Nelna FG Digital Recording System

**Document status:** Canonical project-status baseline
**Authority:** Prefer this document over README phase summaries when they conflict
**Authored:** 2026-08-09
**Implementation baseline SHA (pre-governance commit):** `a1f4ef7af0572c1ddfc2487ebc9a2ab57b2f1ba2`
**Branch:** `main`

This document records **repository evidence**. It does not invent Nelna operational values, role holders, or approvals.

---

## Status vocabulary (do not treat as equivalent)

| Label | Meaning |
| --- | --- |
| **IMPLEMENTED** | Code/docs exist on `main` for the named capability |
| **TECHNICALLY VALIDATED** | Quality gates / tests / Docker validation recorded as passed for that unit |
| **BUSINESS APPROVED** | Named business/QA/IT owner approval exists in writing |
| **PRODUCTION CONFIGURED** | Real Nelna master data, roles, and environment config loaded for production use |
| **UAT PASSED** | Operator/business UAT evidence recorded and accepted |
| **PRODUCTION READY** | Explicit written go-live approval after UAT, restore test, security review |

**Silence is not approval.** Missing forms are not approvals.

---

## Snapshot

| Item | Evidence-based status |
| --- | --- |
| Current DB platform | **PostgreSQL** (authoritative; ADR-002). Redis for cache/Celery. MongoDB/Atlas **requested by company** — DB-01 ADR-018; DB-02 isolated POC evidence in `docs/migration/MONGODB_POC_RESULTS.md` (**CUTOVER BLOCKED / DO NOT MIGRATE**); **not** application SoR |
| Current deployment | **Local / developer Docker Compose only**. No staging/UAT/production deployment recorded |
| Feature continuation | RCA + Daily Records + print/history + NCR/CAPA/Lab/HACCP operator URLs **merged to `main`** (gates green @ `303831d`; docs close-out @ `4b5914e`). |
| Production readiness | **NOT claimed** |
| FG-QA-001 | Project-proposed **DRAFT** only — Phase 06N **BLOCKED — BUSINESS APPROVAL REQUIRED**; **NOT APPROVED**; not auto-published |
| Phase 10A QA foundation | **IMPLEMENTED** on `main` at baseline SHA above |
| Phase 10A Docker full validation | **NOT confirmed complete** in this governance pass (prior Docker Desktop engine failures reported; re-validation remains outstanding) |
| Business role mappings (recorder / Supervisor / QA) | **NOT BUSINESS APPROVED** — Phase 03C technical governance exists; permissions unassigned; mapping tables empty |
| Segregation of duties | **EVIDENCE REQUIRED** — not invented in code as Nelna policy |
| Offline / PWA | **Offline NOT IMPLEMENTED** — Phase 14 gate retained online-only MVP (ADR-026); installable PWA still longer-term (ADR-003) |
| ERP / Bileeta connector | **BLOCKED** — `apps.integrations` contracts/mocks only; live HTTP gated (ADR-029); APR-011/012 EVIDENCE REQUIRED |

---

## Implemented Django apps (code on `main`)

| App | Phase units | Status labels |
| --- | --- | --- |
| `core` | 02+ / **10B** | IMPLEMENTED - foundation + derived checklist workflow |
| `accounts` | 03 | IMPLEMENTED · Phase 03 **Approved with conditions** (not production-configured) |
| `organizations` (incl. Shift) | 03 + 04A/04B | IMPLEMENTED · official org/site/dept/shift values **EVIDENCE REQUIRED** |
| `access_control` | 03 + **03C** | IMPLEMENTED · RoleTemplate + permission catalogue + governance services; **no** seeded business roles; **PHASE 03C BUSINESS ROLE APPROVAL PENDING** |
| `security_audit` | 03–10A | IMPLEMENTED |
| `master_data` (FG Product + specs) | 05A/05B/05C + **06O** | IMPLEMENTED foundation · MASTER-001 **EVIDENCE REQUIRED**; versioned ProductSpecification (06O) unseeded — APR-006 **EVIDENCE REQUIRED** |
| `instruments` | 05D + **25** | IMPLEMENTED foundation · unseeded equipment + calibration; device traceability + OFF/WARN/BLOCK (default OFF); intervals/enforcement **EVIDENCE REQUIRED** (APR-041/051) |
| `training` | 05E | IMPLEMENTED foundation · unseeded competency records; gate OFF by default; matrix/WARN-BLOCK **EVIDENCE REQUIRED** (APR-042) |
| `checklists` | 06A–06O + **07D** | IMPLEMENTED · FG-QA-001 **NOT BUSINESS APPROVED**; Phase **06N BLOCKED**; optional `SPECIFICATION_PARAMETER` evaluation pin (06O); Engine v2 **designed** (ADR-019); real forms **NOT RECEIVED**; optional `requires_equipment_reference` (05D); **07D** effective-version selection |
| scheduling | 07A–07H | IMPLEMENTED · due/overdue foundation + assignment + schedules + batch-event adapter; live generation **BLOCKED** (APR-011/012) |
| `recording` | 08A–08C + 09B | IMPLEMENTED · shop-floor hardening + draft/submit; production recording **BLOCKED** |
| `reviews` | 09A–09C | IMPLEMENTED · governance hardening + immutable review; production Supervisor review **BLOCKED** |
| `quality` | 10A | IMPLEMENTED · production QA **BLOCKED**; no ERP/warehouse/dispatch side effects |
| `notifications` | **15** | IMPLEMENTED foundation · in-app + optional SMTP email; events/email default OFF; no SMS |
| `dispatch` | **13** | IMPLEMENTED foundation · loading/dispatch quality + cold-chain temps + quantity lines; QA RELEASE gate default OFF; no ERP writes |
| `evidence` | **11** | IMPLEMENTED · private attachments + SHA-256 + soft-retire; malware scanner NOT_CONFIGURED; object-store IAM **EVIDENCE REQUIRED** |
| `nonconformance` | **12** | IMPLEMENTED foundation · NCR + HoldCase + history; no FAIL/CCP auto-raise; policies **EVIDENCE REQUIRED** |
| `capa` | **12** | IMPLEMENTED foundation · CAPA + actions + verification/effectiveness; human-only close; matrices **EVIDENCE REQUIRED** |
| `dispatch` | **13** | IMPLEMENTED foundation · loading/dispatch quality + cold-chain temps + qty reconciliation; QA RELEASE gate **disabled by default**; no ERP writes; SOPs/limits **EVIDENCE REQUIRED** |
| `notifications` | **15** | IMPLEMENTED foundation · in-app + optional SMTP; events default OFF; no SMS; privacy-safe payloads only |
| `reports` | **16** | IMPLEMENTED foundation · catalogue + org-scoped CSV runs; immutable submission sources; Excel/PDF not implemented |
| `integrations` | **17** | BOUNDARY ONLY · contracts/mocks/dead-letter/reconciliation; **live Bileeta blocked** (APR-011/012) |
| `ai_assistance` | **18** | IMPLEMENTED foundation · optional advisory AI (default OFF); never final quality decisions |
| `laboratory` | **22** | IMPLEMENTED foundation · sample/test/result; positive-release stub default OFF; catalogue EVIDENCE REQUIRED |
| `haccp` | **23** | IMPLEMENTED foundation · versioned plan shells; no Nelna CCPs/limits; auto HOLD/NCR default OFF; company plan EVIDENCE REQUIRED |
| `sampling` | **24** | IMPLEMENTED foundation · versioned sampling plans; no ISO/AQL tables; sampling REJECT ≠ QA REJECT; company tables EVIDENCE REQUIRED |
| `foreign_body` | **26** | IMPLEMENTED foundation · metal-detector challenge shells; no invented Fe/SS sizes; auto-HOLD default OFF (APR-052) |
| `sanitation` | **27** | IMPLEMENTED foundation · checklist-bound SSOP programs; no invented chemicals/frequencies; fail-stop default OFF (APR-053) |
| `environmental` | **28** | IMPLEMENTED foundation · monitoring points/params/versioned limits; MANUAL/LAB/SENSOR; auto-HOLD default OFF (APR-054) |
| `packaging` | **29** | IMPLEMENTED foundation · versioned artwork; checklist bind; date-code shells; manage≠approve (APR-055) |
| `changeover` | **30** | IMPLEMENTED foundation · allergen shells; changeover/line-clearance; block dual-gate default OFF (APR-056) |
| `receiving` | **31** | IMPLEMENTED foundation · ERP-mapped materials; receipt quality; LIMS link; ERP outbound blocked (APR-057) |
| `supplier_quality` | **32** | IMPLEMENTED foundation · ERP supplier refs; certificates/events; NCR/CAPA links; count-only metrics (APR-039) |
| `iqc` | **33** | IMPLEMENTED foundation · GRN ingest; ChecklistTask IQC; sampling/lab/review; local disposition; ERP dual-gate OFF (APR-058) |
| `ipqc` | **34** | IMPLEMENTED foundation · process-check defs; triggers; measurement/equipment/sampling; fail dual-gate OFF; NCR/HOLD escalate; dashboard (APR-059) |
| `batch_dossier` | **35** | IMPLEMENTED foundation · read-only batch dossier; timeline; section authz; paginated evidence/audit; PDF export hook dual-gate OFF (APR-060) |
| `batch_genealogy` | **36** | IMPLEMENTED foundation · ERP-sourced nodes/edges; backward/forward; rework; cycle prevention; flat Mongo projection dual-gate OFF; partner redaction (APR-061) |
| `recall` | **37–38** | IMPLEMENTED foundation · recall/withdrawal + MOCK exercises (APR-062/063) |
| `customer_complaints` | **39** | IMPLEMENTED foundation · complaint cases; batch-trace; evidence; RCA/NCR/CAPA links; privacy redaction; auto-send dual-gate OFF (APR-064) |
| `product_returns` | **40** | IMPLEMENTED foundation · returned-product quality records; quarantine; checklist inspection; disposition architecture; ERP stock dual-gate OFF (APR-065) |
| `quality_quarantine` | **41** | IMPLEMENTED foundation · application quality state; source-linked cases; append-only history; quantity/release/ERP gates OFF by default (APR-066) |
| `rework` | **42** | IMPLEMENTED foundation · create/authorize/execute; source/result genealogy; new reinspection; ERP stock dual-gate OFF (APR-067) |
| `document_control` | **43** | IMPLEMENTED foundation · versioned QMS documents; immutability; effective lookup; historical links; Phase 11 files; ack ≠ competency (APR-068) |
| `change_control` | **44** | IMPLEMENTED foundation · change requests; impact assessment; affected links; implementation citation; engineering ≠ approval (APR-069) |
| `quality_audits` | **45** | IMPLEMENTED foundation · QMS audit plans/findings/follow-up; explicit NCR/CAPA; Phase 11 evidence; reports; distinct from security_audit (APR-070) |
| `compliance_mapping` | **46** | IMPLEMENTED foundation · source register; clause→control mapping; evidence citations; explicit gap follow-up; no certification/legal claims (APR-071) |
| `quality_risks` | **47** | IMPLEMENTED foundation · configurable risk register; historical assessments; mitigations; scoring default OFF; no invented matrix (APR-072) |
| `process_fmea` | **48** | IMPLEMENTED foundation · versioned Process FMEA; S/O/D assessments; S×O×D only after owner-cited policy; no invented thresholds (APR-073) |
| `rca` | **49** | IMPLEMENTED foundation · structured RCA; optional 5 Why/fishbone; human confirm; explicit CAPA (APR-074) |

Not started (by MODULE_MAP): _(none for MODULE_MAP apps through 38 except gaps noted elsewhere)._ (`loading` controls are delivered inside `dispatch` for Phase 13 — see ADR-025.)

---

## Technical completion by phase (evidence)

| Phase | Technical code/docs | Business / production |
| --- | --- | --- |
| 00 Discovery | Complete | Governance living |
| 01A–01C Design | Complete; 01C deferred Sinhala condition | Design approvals recorded; DEBT-01C-R-NOTO **open** |
| 02 Foundation | Complete | Approved with conditions |
| 03 Accounts/RBAC | Complete | Approved with conditions; no seeded users/orgs/roles |
| 03C Operational role governance | Technical foundation (catalogue, RoleTemplate, audited permission/template services, docs) | **PHASE 03C BUSINESS ROLE APPROVAL PENDING** — SoD all PENDING; APR-007..010/040 EVIDENCE REQUIRED |
| 04A/04B Shift | Complete | Official Shift values unresolved (ASM-005/006) |
| 04C Org/Shift configuration foundation | Technical complete | Real company values pending (ASM-004/005/006); controlled import only |
| 05A/05B FG Product | Complete | MASTER-001 unresolved |
| 05C FG Product master foundation | Technical complete | Optional mapping fields + import; official catalogue **not** received |
| 05D Equipment / calibration foundation | Technical complete | Unseeded equipment + calibration; no invented intervals; overdue block/warn **EVIDENCE REQUIRED** |
| 05E Training / competency foundation | Technical complete | Unseeded training records; gate modes metadata only; no invented matrices |
| 06A–06E Checklist definition | Complete (06E provisional docs) | TEMPLATE / FG-QA-001 approval unresolved |
| 06N FG-QA-001 business validation | Validation recorded; **not published** | **BLOCKED — BUSINESS APPROVAL REQUIRED**; matrix 42 × PENDING DECISION; APR-001 EVIDENCE REQUIRED |
| 06F Real form discovery framework | Docs complete (templates + registers) | Inventory **NOT RECEIVED**; no forms APPROVED FOR DIGITALIZATION |
| 06G Checklist Engine v2 design | ADR-019 + 06H–06M split | Design complete; evidence still required for business values |
| 06H Repeating / sample foundation | Schema + recording/snapshot/correction/Supervisor/QA render | Technical foundation complete; **no invented sample counts**; not BUSINESS APPROVED / not UAT |
| 06I Calculated fields | Closed operators + Decimal + frozen snapshot context | Technical foundation; **no business formulas seeded**; not BUSINESS APPROVED |
| 06J Conditional rules | VISIBLE_IF / REQUIRED_IF / EVIDENCE_REQUIRED_IF (fail-closed evidence stub) | Technical foundation; **no seeded predicates**; not BUSINESS APPROVED |
| 06K Item evaluation | Explicit bounds/choice/option/calculated rules → PASS/FAIL/WARN/NOT_EVALUATED | Technical foundation; **PASS≠RELEASE / FAIL≠HOLD/REJECT**; never auto-creates QAReview; **no seeded limits**; not BUSINESS APPROVED |
| 06L Control-point metadata | `control_point_class` + `criticality` + frozen `control_point_context` | Technical schema on `main`; default NONE; **no invented CCP/OPRP**; metadata ≠ disposition; **APR-027 / ASM-002 still EVIDENCE REQUIRED**; not BUSINESS APPROVED |
| 06M Measurement semantics | `decimal_precision` + `rounding_mode` + unit catalog + inclusivity + frozen `measurement_context` | Technical schema on `main`; Decimal-safe; **no product limits seeded**; informational bounds ≠ disposition; not BUSINESS APPROVED |
| 06N FG-QA-001 business validation | Validation matrix + evidence gap review; **no publish** | **BLOCKED — BUSINESS APPROVAL REQUIRED**; APR-001 unresolved; forms NOT RECEIVED |
| 06O Product specifications | Versioned ProductSpecification + optional checklist pin | Technical complete; **no invented limits**; APR-006/ASM-001 still EVIDENCE REQUIRED |
| 07A/07B Scheduling foundation | Complete | Real generation blocked (batch source, applicability, roles) |
| 07C Checklist applicability engine | Technical complete — version-safe rules + preview | APR-013/014/015 EVIDENCE REQUIRED; no Line/Process masters; production generation still BLOCKED |
| 07D Effective version policy | Technical complete — PUBLISHED-only selection; overlap/NO_ELIGIBLE blocked; audited effectivity | APR-015 as-of event still DECISION REQUIRED; historical pins never auto-upgrade |
| 07E Recurring tasks | Technical complete — BATCH/SHIFT_*/SCHEDULED/MANUAL; idempotent occurrence keys; Celery Beat catch-up; OVERDUE/MISSED without auto-NCR | Frequencies EVIDENCE REQUIRED; production generation still BLOCKED |
| 07F Batch event → task | Adapter boundary complete — mapping / applicability / effective version / idempotent task; no live connector | **APR-011 LIVE CONTRACT REQUIRED**; production generation still BLOCKED |
| 07G Task assignment | Technical complete — USER/ROLE/DEPT/SHIFT/TEAM ownership; append-only history; My/Unassigned/Assigned queues; assign ≠ RBAC | Future auto-assign policies EVIDENCE REQUIRED |
| 07H Due / overdue foundation | Technical complete — configured due_from/due_at/due_soon; derived NOT_DUE/DUE/DUE_SOON/OVERDUE; overdue ≠ NCR; no invented SLAs | Company SLA durations EVIDENCE REQUIRED |
| 08A/08B Recording/submit | Complete | Production recording blocked |
| 08C Recording hardening | Technical complete — autosave, optimistic concurrency, session recovery (online), UX | Production recording still BLOCKED; offline IndexedDB is Phase 14 |
| 09A/09B Supervisor review + correction | Complete | Production review/correction blocked |
| 09C Supervisor governance | Technical complete — PENDING/PROHIBIT/ALLOW self-review; configured review_sla_minutes; temporary delegation; queues | APR-010 / SOD-01 EVIDENCE REQUIRED |
| 10A QA disposition | Complete (manual RELEASE/HOLD/REJECT only) | Production QA blocked; post-QA workflows not started |
| 10B Workflow lifecycle | Technical complete - derived operational workflow (ADR-022); no duplicated status columns | Production still BLOCKED; QA does not close warehouse/ERP/dispatch |
| 10C+ Post-QA operational | Not started | EVIDENCE REQUIRED |
| 11 Evidence attachments | Technical complete — private store, SHA-256, auth download, soft-retire, scanner NOT_CONFIGURED | Object-store IAM / active malware scanner EVIDENCE REQUIRED |
| 12 NCR / HOLD / CAPA | Technical complete — proposed NCR lifecycle, HoldCase, CAPA actions/verification/effectiveness; no auto-raise | Severity/resolution catalogues / auto-raise rules EVIDENCE REQUIRED |
| 13 Loading / dispatch | Technical complete — DispatchQualityRecord, vehicle checklist links, cold-chain Decimal temps, qty reconciliation, QA RELEASE gate default OFF (ADR-025) | Dispatch SOPs / temperature limits / APR-017 gate enablement EVIDENCE REQUIRED |
| 14 Offline PWA | **Decision gate complete** — offline **not** implemented (ADR-026); online-only MVP retained + paper fallback | APR-022 / Wi-Fi / device / logout-wipe evidence still required to reopen |
| 15 Notifications | Technical complete — in-app notifications + optional SMTP; events default OFF; SMS not integrated (ADR-027) | Event matrix / SMTP / SMS provider EVIDENCE REQUIRED |
| 16 Reporting | Technical complete — catalogue, org RBAC, immutable submission sources, CSV + formula injection guard, async ReportRun (ADR-028) | Official report packs / Excel-PDF need EVIDENCE REQUIRED |
| 17 ERP / Bileeta | Adapter boundary complete — contracts/mocks, evidence gate, dead-letter, reconciliation, outbound prepare-only (ADR-029) | **BLOCKED — VENDOR API EVIDENCE REQUIRED** (APR-011/012/016/017) |
| 18 Safe AI assistance | Technical complete — optional advisory AI default OFF; provider abstraction; safety gates (ADR-030) | QA/IT policy acknowledgement + prompt retention EVIDENCE REQUIRED |
| 19 Security / backup / monitoring / performance | Technical complete - hardening, health, backup/restore harness, runbooks (ADR-031) | RPO/RTO + staging load/pen-test EVIDENCE REQUIRED |
| 22 Laboratory / LIMS | Technical complete — sample/test/result foundation, immutability, external cert hook, positive-release policy stub default OFF (ADR-032) | Lab catalogue / role mapping / positive-release policy EVIDENCE REQUIRED |
| 23 HACCP / control-point | Technical complete — versioned plan shells, CCP/OPRP/PRP metadata, limit/monitoring/CA references, checklist binding (ADR-035) | Company HACCP plan / CCP identification / limits EVIDENCE REQUIRED |
| 24 Sampling engine | Technical complete — versioned plans/rules/requirements, lot resolution, checklist binding, advisory accept/reject (ADR-036) | Company sampling tables / external-standard adoption EVIDENCE REQUIRED |
| 25 Device traceability | Technical complete — device eligibility, OFF/WARN/BLOCK settings (default OFF), frozen calibration snapshot (ADR-037) | Company calibration enforcement / override policy EVIDENCE REQUIRED |
| 26 Foreign body control | Technical complete — challenge tests, configurable pieces, advisory containment (ADR-038) | Company piece/frequency/HOLD policy EVIDENCE REQUIRED |
| 27 Sanitation / SSOP | Technical complete — checklist-bound programs, scopes, schedule kinds, chemical shells, fail-stop default OFF (ADR-039) | Company SSOP content / production-stop policy EVIDENCE REQUIRED |
| 28 Environmental monitoring | Technical complete — points, versioned limits, MANUAL/LAB/SENSOR, trend index, auto-HOLD default OFF (ADR-040) | Company EM catalogue / limits / HOLD policy EVIDENCE REQUIRED |
| 29 Packaging artwork verification | Technical complete — versioned artwork, checklist binding, date-code shells, line-clearance hook, historical freeze (ADR-041) | Company artwork / date-code / shelf-life policy EVIDENCE REQUIRED (APR-055) |
| 30 Allergen / changeover / line clearance | Technical complete — allergen shells, product declarations, changeover + checklist clearance, dual-gate block default OFF (ADR-042) | Company allergen lists / cleaning / sequencing / matrix policy EVIDENCE REQUIRED (APR-056) |
| 31 Raw / material receiving quality | Technical complete — ERP-mapped materials, receipt quality, local disposition, LIMS link, ERP outbound blocked (ADR-043) | Company material catalogues / specs / ERP stock effect EVIDENCE REQUIRED (APR-057) |
| 32 Supplier quality management | Technical complete — ERP supplier refs, certificates/events, NCR/CAPA links, count-only metrics, QA≠Procurement (ADR-020) | Official certificate types / status labels / scorecards EVIDENCE REQUIRED (APR-039) |
| 33 Incoming Quality Control (IQC) | Technical complete — idempotent GRN ingest, ChecklistTask generation, sampling/lab/review gate, local disposition, ERP dual-gate OFF (ADR-044) | Company IQC checklists / sampling / ERP contract EVIDENCE REQUIRED (APR-058) |
| 34 In-Process Quality Control (IPQC) | Technical complete — process-check definitions, trigger shells, measurement/equipment/sampling/HACCP metadata, fail dual-gate OFF, controlled NCR/HOLD, dashboard (ADR-045) | Company IPQC frequencies / stop-line / SoD EVIDENCE REQUIRED (APR-059) |
| 35 Electronic Batch Quality Dossier (EBR) | Technical complete — read-only aggregation by batch_reference, timeline, section authz, paginated evidence/audit, PDF export hook dual-gate OFF (ADR-046) | Company batch identity / retention / export SoD EVIDENCE REQUIRED (APR-060) |
| 36 Batch Genealogy Traceability | Technical complete — ERP adjacency nodes/edges, forward/backward trace, rework, cycle prevention, capped Mongo projection, party dual-gate OFF (ADR-047) | Company ERP genealogy mapping / party SoD EVIDENCE REQUIRED (APR-061) |
| 37 Product Recall / Withdrawal | Technical complete — recall cases, genealogy expansion, qty reconciliation, communication refs, high-risk initiate, dual-gate notify/ERP OFF (ADR-048) | Company recall procedure / notify SOP / ERP distribution EVIDENCE REQUIRED (APR-062) |
| 38 Mock Recall Exercises | Technical complete — MOCK_EXERCISE mode, metrics, isolation (no ERP/notify/dispatch), findings→NCR/CAPA/improvement explicit (ADR-049) | Company mock-drill SOP / finding SoD EVIDENCE REQUIRED (APR-063) |
| 39 Customer Quality Complaints | Technical complete — complaint cases, batch-trace, evidence, RCA/NCR/CAPA links, privacy redaction, dual-gate auto-send OFF (ADR-050) | Complaint SOP / taxonomy / response EVIDENCE REQUIRED (APR-064) |
| 40 Returned Product Quality | Technical complete — ERP/SFA return mapping, quarantine, checklist inspection, disposition architecture, ERP stock movement dual-gate OFF (ADR-051) | Return disposition / quarantine / ERP stock movement EVIDENCE REQUIRED (APR-065) |
| 41 Quality Quarantine Management | Technical complete — source-linked local cases, append-only events, policy-gated quantity refs, release/ERP dual-gates, fail-closed outbound (ADR-052) | Quarantine/release SOP, role mapping, quantity semantics, and ERP adapter EVIDENCE REQUIRED (APR-066) |
| 42 Controlled Rework Management | Technical complete — explicit create/authorize, source/result genealogy, quantity conservation, new reinspection, ERP stock dual-gate OFF (ADR-053) | Rework SOP / SoD / ERP adapter EVIDENCE REQUIRED (APR-067) |
| 43 Quality Document Control | Technical complete — versioned documents, immutability, effective lookup, historical links, Phase 11 files, optional acknowledgement (ADR-054) | Document numbering / type catalogue / SoD / acknowledgement obligation EVIDENCE REQUIRED (APR-068) |
| 44 Quality Change Control | Technical complete — formal change records, impact assessment, affected-area links, implementation citation, verify/close SoD (ADR-055) | Change SOP / numbering / risk scoring / role mapping EVIDENCE REQUIRED (APR-069) |
| 45 Quality Audit Management | Technical complete — audit plans, audit-only checklist bindings, findings, explicit NCR/CAPA, reports (ADR-056) | Audit programme / frequency / severity catalogue / SoD EVIDENCE REQUIRED (APR-070) |
| 46 Compliance Control Mapping | Technical complete — source register, edition citations, control mappings, evidence links, explicit gap actions (ADR-057) | Official sources / applicability / licensed clause text / owner mapping EVIDENCE REQUIRED (APR-071). No ISO/FSSC/HACCP/SLS/legal claim |
| 47 Quality Risk Management | Technical complete — risk register, append-only assessments, reviews, mitigations, policy-gated high-rated dashboard (ADR-058) | Scoring method / category catalogue / acceptance criteria EVIDENCE REQUIRED (APR-072) |
| 48 Process FMEA | Technical complete — versioned PFMEA, failure-mode structure, configured S×O×D only, explicit CAPA/change (ADR-059) | PFMEA method / rating scale / RPN or AP use EVIDENCE REQUIRED (APR-073) |
| 49 Structured RCA | Technical complete — RCA record, optional 5 Why/fishbone/cause table, human confirm, explicit CAPA (ADR-060) | RCA SOP / required method / investigator SoD EVIDENCE REQUIRED (APR-074) |
| 20–21 Pilot / production release | Not started | Depends on business gates + Phase 19 ops evidence |
| 20 UAT / Pilot | Package opened — **BLOCKED** pending business evidence ([uat/README.md](uat/README.md)) | Pilot scope APR-034, FG-QA-001, roles/SoD, hosted env EVIDENCE REQUIRED |
| 21 Production release | Package opened — **GO-LIVE BLOCKED** ([release/README.md](release/README.md)) | Phase 20 FAIL + hosting/config/support gates |

---

## Readiness gates (business / UAT)

| Gate document | Status |
| --- | --- |
| [PHASE_07_PRODUCTION_READINESS_GATE.md](business/PHASE_07_PRODUCTION_READINESS_GATE.md) | OPEN — production task generation BLOCKED |
| [PHASE_08_RECORDING_READINESS_GATE.md](business/PHASE_08_RECORDING_READINESS_GATE.md) | OPEN — production recording BLOCKED |
| [PHASE_09_SUPERVISOR_REVIEW_READINESS_GATE.md](business/PHASE_09_SUPERVISOR_REVIEW_READINESS_GATE.md) | OPEN — production Supervisor use BLOCKED |
| [PHASE_10_QA_REVIEW_READINESS_GATE.md](business/PHASE_10_QA_REVIEW_READINESS_GATE.md) | OPEN — production QA use BLOCKED |
| [PHASE_10_POST_QA_WORKFLOW_GATE.md](business/PHASE_10_POST_QA_WORKFLOW_GATE.md) | OPEN — all downstream items EVIDENCE REQUIRED |

**UAT PASSED:** No — Phase 20 package opened; business execution **NOT STARTED** ([PHASE_20_UAT_PILOT.md](business/PHASE_20_UAT_PILOT.md))  
**PRODUCTION READY:** No — Phase 21 **GO-LIVE BLOCKED** ([PHASE_21_FINAL_REPORT.md](release/PHASE_21_FINAL_REPORT.md)) — Phase 21 release gate **STOP** ([PHASE_21_PRODUCTION_RELEASE.md](business/PHASE_21_PRODUCTION_RELEASE.md))

---

## Recorded design / technical approvals (not production)

See [docs/approvals/README.md](approvals/README.md). Phase 01A–03 and selected documentation approvals exist. They do **not** approve:

- Official Nelna master data
- FG-QA-001 production content
- Role mappings
- SoD policy
- Hosting/production go-live

---

## Unresolved assumptions (summary)

Full detail: [ASSUMPTION_REGISTER.md](business/ASSUMPTION_REGISTER.md). **No assumption row is APPROVED.**

High-impact open items include ASM-001–006, ASM-008–016, MASTER-001, TEMPLATE-001 / FG-QA-001, batch source / Bileeta, recorder/Supervisor/QA mappings, SoD, retention, hosting, offline requirement.

Tracked for request/approval workflow: [governance/APPROVAL_REGISTER.md](governance/APPROVAL_REGISTER.md).

---

## Technical debt (selected)

| ID / topic | Status | Blocks |
| --- | --- | --- |
| DEBT-01C-R-NOTO (Noto Sans Sinhala) | Open | Operator Sinhala UAT / pilot / production UI claim |
| Phase 10A Docker re-validation | Outstanding | Claiming TECHNICALLY VALIDATED for 10A in Docker |
| Direct-main delivery vs PR-only rule text | Process debt | Consistency of contribution docs |
| Unseeded permissions without role assignment | By design until owners map | Operational use |
| Evidence module | Phase 11 technical complete (ADR-023) | Object-store IAM / active malware scan EVIDENCE REQUIRED |

---

## Business blockers

1. FG-QA-001 final content approval and publish policy
2. Complete paper-form inventory (ASM-003 / APR-028 / APR-036) — discovery framework exists; forms still **NOT RECEIVED**
3. Official Organization / Site / Department values (ASM-004)
4. Official Shift names/codes/times (ASM-005/006)
5. Official Product catalogue and specification limits (MASTER-001 / ASM-001)
6. Recorder / Supervisor / QA business-role mapping
7. Segregation-of-duties policy evidence
8. Product / Site / Shift / Department applicability rules
9. Checklist effective-version **as-of business event** (APR-015) — technical engine exists (07D); policy still DECISION REQUIRED
10. RELEASE / HOLD / REJECT operational meaning and downstream authority

---

## Integration blockers

1. Production batch source identity (system/API/event) — EVIDENCE REQUIRED
2. Bileeta API / sandbox availability — DECISION / EVIDENCE REQUIRED (no connector implemented)
3. Organization mapping from external batch identity — EVIDENCE REQUIRED
4. ERP write prohibition remains in force (no direct ERP DB writes)

---

## UAT blockers

1. DEBT-01C-R-NOTO open (Sinhala operator UI)
2. No approved published checklist content for pilot
3. No approved role assignments / SoD matrix
4. No hosted UAT environment decision (ASM-015)
5. Device / Wi-Fi / hygiene evidence incomplete (ASM-009–011)
6. Production readiness gates for Phases 07–10 remain OPEN
7. Phase 20 package: pilot scope / signoff empty ([docs/uat/](uat/README.md)) — **NO-GO**

---

## Governance package

| Document | Path |
| --- | --- |
| Approval register | [governance/APPROVAL_REGISTER.md](governance/APPROVAL_REGISTER.md) |
| Decision log | [governance/DECISION_LOG.md](governance/DECISION_LOG.md) |
| Risk register | [governance/RISK_REGISTER.md](governance/RISK_REGISTER.md) |
| RACI | [governance/RACI.md](governance/RACI.md) |
| Change control | [governance/CHANGE_CONTROL.md](governance/CHANGE_CONTROL.md) |
| Continuity / handover | [operations/CONTINUITY_AND_HANDOVER_PLAN.md](operations/CONTINUITY_AND_HANDOVER_PLAN.md) |
| Real form discovery (06F) | [business/form-discovery/README.md](business/form-discovery/README.md) |
| Checklist Engine v2 design (06G) | [architecture/ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md](architecture/ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md) |

---

## Recommended next engineering focus (not authorization)

1. Drive owners to return paper-form inventory via [form-discovery/](business/form-discovery/) (APR-028 / APR-036) — do **not** invent forms for Checklist Engine v2.
2. Keep Engine v2 business values evidence-gated (ADR-019). **06H–06M** technical foundations are on main (06M measurement semantics technical only — no seeded product limits; 06L HACCP classifications still EVIDENCE REQUIRED).
3. Complete Phase 10A Docker/host validation when Docker engine is healthy (**no new business features** required for that gate).
4. Drive APPROVAL_REGISTER items with named owners (especially FG-QA-001, mappings, batch source).
5. Do **not** start Phase 11+ operational features until owners prioritize and evidence gates allow.

**Production readiness is not claimed by this document.**

---

## Phase 04C delivery status

**STATUS: PHASE 04C REAL COMPANY VALUES PENDING**

Technical foundation (permissions, audited lifecycle, historical hard-delete refusal, controlled CSV import, admin search/filter) is implemented. ASM-004 / ASM-005 / ASM-006 and APR-002 / APR-003 / APR-004 remain unresolved — no official Nelna Organization/Site/Department/Shift catalogue was loaded.

---

## Phase 05C delivery status

**STATUS: PHASE 05C FG PRODUCT MASTER FOUNDATION COMPLETE**

Optional mapping/attribute blanks, effective dates, historical hard-delete refusal, controlled CSV import, and expanded search/filter are implemented. MASTER-001 / APR-005 remain **EVIDENCE REQUIRED** — official Product catalogue was **not** received or loaded.

---

## Phase 05D delivery status

**STATUS: PHASE 05D EQUIPMENT CALIBRATION FOUNDATION COMPLETE**

Unseeded equipment master, calibration records, fitness labels (no block policy), checklist optional equipment-reference flag, RBAC separation, and audits are implemented. Calibration intervals and overdue block/warn remain **EVIDENCE REQUIRED** — no fake assets seeded.

---

## Phase 05E delivery status

**STATUS: PHASE 05E TRAINING FOUNDATION COMPLETE**

Technical training/competency foundation is implemented without seeded company matrices. Recording WARN/BLOCK gates remain OFF by default until APR evidence approves policy.

---

## Phase 06N delivery status

**STATUS: PHASE 06N BLOCKED — BUSINESS APPROVAL REQUIRED**

FG-QA-001 Draft v0.1 was reviewed against real-evidence gates. No company forms, owner issue log entries, or APR-001 written approval were available. The proposal remains DRAFT; no PUBLISHED version was created; no numeric limits were invented. Item validation matrix: 42 × PENDING DECISION.

---

## Phase 06O delivery status

**STATUS: PHASE 06O PRODUCT SPECIFICATIONS COMPLETE**

Versioned ProductSpecification / SpecificationVersion / SpecificationParameter foundation is implemented with immutability, effectivity overlap policy, org-scoped high-privilege RBAC, audit events, and optional checklist SPECIFICATION_PARAMETER pins. No Nelna limits were seeded — APR-006 / ASM-001 remain **EVIDENCE REQUIRED**. OUT_OF_SPEC does not auto HOLD/REJECT.

---

## Phase 07D delivery status

**STATUS: PHASE 07D EFFECTIVE VERSION POLICY COMPLETE**

Technical effective-version selection is implemented: optional inclusive `effective_from` / `effective_to` on `ChecklistVersion`, deterministic `ONE_ELIGIBLE_VERSION` resolution, explicit `NO_ELIGIBLE_VERSION` / `OVERLAPPING_ELIGIBLE_VERSIONS` blocks (never silent fallback or arbitrary pick), audited effectivity updates, and optional task helper that pins the resolved PUBLISHED version. APR-015 (which business event supplies `as_of`) remains **DECISION REQUIRED** — not invented. Existing `ChecklistTask` pins never auto-upgrade.

## Phase 07E delivery status

**STATUS: PHASE 07E RECURRING TASKS COMPLETE**

## Phase 07F delivery status

**STATUS: PHASE 07F LIVE BATCH CONTRACT REQUIRED**

Adapter/service boundary implemented: external identity (`source_system`, `source_event_id`, `external_batch_id`), configured mappings, applicability ONE_MATCH, Phase 07D effective-version selection, idempotent `ChecklistTask` creation with safe retry and concurrency controls. No live Bileeta/ERP connector, webhooks, or credentials. APR-011 remains **EVIDENCE REQUIRED**.

## Phase 07G delivery status

**STATUS: PHASE 07G TASK ASSIGNMENT COMPLETE**

Checklist task ownership workflow is implemented: assign / reassign / unassign with append-only history, VIEW-scoped My/Unassigned/Assigned queues, and `assign_checklisttask` permission. Assignment never grants RBAC. Team master remains EVIDENCE REQUIRED (opaque team code only).

## Phase 07H delivery status

**STATUS: PHASE 07H DUE MANAGEMENT COMPLETE**

Due/overdue foundation: configured `due_from` / `due_at` (`due_to`) / optional `due_soon_minutes`; derived display states (`NOT_DUE` / `DUE` / `DUE_SOON` / `OVERDUE`) without persisted redundant state; overdue queue + UI badges/filters. No invented SLA durations. Overdue never auto-creates NCR.

## Phase 08C delivery status

**STATUS: PHASE 08C RECORDING HARDENING COMPLETE**

Shop-floor recording hardening: preserved start → Save Draft → submit → immutable snapshot; safe autosave; optimistic `draft_version` (no silent last-write-wins); online session recovery (not IndexedDB); sticky save / section progress / validation summary / touch targets; optional equipment + Phase 11 evidence hooks. Production recording remains BLOCKED.

## Phase 09C delivery status

**STATUS: PHASE 09C SUPERVISOR GOVERNANCE COMPLETE**

Supervisor review governance hardening: Phase 03C permission mappings (no invented Supervisor titles); self-review PENDING by default (PROHIBIT/ALLOW only with evidence_reference); optional configured `review_sla_minutes` for overdue; temporary time-bounded review delegation via ScopedRoleAssignment; pending / overdue / resubmission queues; immutable audited decisions. Production Supervisor review remains BLOCKED.

## Phase 10B delivery status

**STATUS: PHASE 10B WORKFLOW LIFECYCLE COMPLETE**

Derived operational workflow (ADR-022): authoritative state remains on Task / Record / Submission / SupervisorReview / Correction / QAReview. One read-time lifecycle label (`PENDING` … `QA_*` / `CANCELLED`) with consistent badges and queue filters. QA terminals are provisional in-app dispositions only — they do not close warehouse / ERP / dispatch.

## Phase 11 delivery status

**STATUS: PHASE 11 EVIDENCE ATTACHMENTS COMPLETE**

Secure quality evidence attachments (ADR-023): private storage, allowlisted types, SHA-256 integrity, authorized download, soft-retire only, malware scanner interface defaulting to NOT_CONFIGURED. Production MinIO/S3 IAM and active scanning remain EVIDENCE REQUIRED.

## Phase 12 delivery status

**STATUS: PHASE 12 NCR HOLD CAPA FOUNDATION COMPLETE**

Configurable quality-case foundation (ADR-024): formal NCR lifecycle + HoldCase + CAPA actions/verification/effectiveness with human-only closure; append-only history and audit; separate create/manage/close permissions; no FAIL/CCP auto-raise; checklist correction remains distinct from NCR. Production severity/resolution/auto-raise policies remain EVIDENCE REQUIRED.

## Phase 13 delivery status

**STATUS: PHASE 13 DISPATCH QUALITY FOUNDATION COMPLETE**

Loading/dispatch quality foundation (ADR-025): DispatchQualityRecord with vehicle inspection checklist links, cold-chain Decimal temperature readings, released/loaded/remaining quantity lines (not ERP ledger), configurable QA RELEASE gate disabled by default, append-only history and audit. No AI loading release; no ERP writes; production SOPs/limits remain EVIDENCE REQUIRED.

## Phase 14 delivery status

**STATUS: PHASE 14 ONLINE ONLY APPROVED — OFFLINE NOT IMPLEMENTED**

Offline decision gate (ADR-026): Wi-Fi survey, device plan, hosting, outage profile, and APR-022 remain EVIDENCE REQUIRED / open. Standing MVP direction is online-only recording with paper fallback. No IndexedDB draft sync, service worker offline queue, or offline QA/HOLD/REJECT paths were implemented. Re-open Phase 14 only after IT + Production + QA clear APR-022 with supporting evidence.

## Phase 15 delivery status

**STATUS: PHASE 15 NOTIFICATIONS COMPLETE**

Workflow notifications foundation (ADR-027): in-app notifications with privacy-safe titles/messages; org event policy default OFF; optional SMTP email when configured (no credentials in repo); Celery idempotent email delivery; SMS not integrated. Production event matrices and SMS remain EVIDENCE REQUIRED.

## Phase 16 delivery status

**STATUS: PHASE 16 REPORTING COMPLETE**

Governed quality reporting foundation (ADR-028): org-scoped catalogue and `ReportRun` CSV generation; historical submission/review/QA/correction paths use immutable snapshots (never draft responses); formula-injection protection; background generation for large runs; export/download audited. Official Nelna report packs and Excel/PDF remain EVIDENCE REQUIRED / not implemented.

## Phase 17 delivery status

**STATUS: PHASE 17 BLOCKED — VENDOR API EVIDENCE REQUIRED**

Bileeta/ERP adapter boundary (ADR-029): `apps.integrations` with inbound contracts mapped only to the Phase 07F consumer, mock sandbox behaviours, live HTTP hard-gated, idempotent attempts + dead-letter, reconciliation, outbound disposition interface prepare-only (APR-017). No invented endpoints, no live connector, no ERP DB writes. Re-open live calls only after APR-011/012 artefacts land in the vendor evidence register.

## Phase 18 delivery status

**STATUS: PHASE 18 SAFE AI FOUNDATION COMPLETE**

Safe quality AI assistance foundation (ADR-030): optional advisory assistance behind env flag (default OFF); allowed summarization/search/trend use cases with advisory anomaly hints; hard deny of RELEASE/HOLD/REJECT and other prohibited actions; org RBAC before context; provider abstraction (null/mock); audited usage without full prompt storage by default. Core workflows do not depend on AI.

## Phase 19 delivery status

**STATUS: PHASE 19 TECHNICAL PRODUCTION READINESS COMPLETE**

Technical production-readiness controls (ADR-031): security headers, expanded health/readiness, structured logging enrichment, backup/restore harness + evidence template, monitoring/DR/incident runbooks, synthetic perf + concurrency/e2e/security regressions. RPO/RTO and final session policy remain COMPANY DECISION REQUIRED. Business production go-live is NOT claimed.

## Phase 20 delivery status

**STATUS: PHASE 20 UAT/PILOT BLOCKED**

UAT/pilot package delivered under `docs/uat/` with prerequisites, scenarios, test record (all NOT EXECUTED), pilot scope template, baseline/parallel/defect/signoff registers, and NO-GO final report. Cursor did not invent business PASS or signatures. Re-open PASS only when real business evidence is attached.

## Phase 22 delivery status

**STATUS: PHASE 22 LAB LIMS FOUNDATION COMPLETE**

Laboratory / LIMS technical foundation (ADR-032): `apps.laboratory` with sample provenance, tests/parameters/results, finalized immutability + amendment revisions, external certificate metadata, COA interface hooks, and positive-release policy stub that remains non-blocking by default. PostgreSQL remains SoR (APR-020 Mongo cutover still PENDING). Lab catalogues, role mappings, and positive-release enablement remain COMPANY EVIDENCE REQUIRED.

## Phase 21 delivery status

**STATUS: PHASE 21 GO-LIVE BLOCKED**

Hard prerequisites failed (Phase 20 UAT/pilot not passed; production hosting, approved configuration, support owner, vault/ownership, and production-custody backup targets incomplete). No production deploy, no release tag, no paper decommission. Package: `docs/release/`.

## Phase 23 delivery status

**STATUS: PHASE 23 HACCP FOUNDATION COMPLETE**

Versioned HACCP/control-point technical foundation (ADR-035): `apps.haccp` with plan/version immutability, generic hazard categories, CCP/OPRP/PRP control points, critical-limit and monitoring reference shells, corrective-action references (auto HOLD/NCR default OFF), and checklist bindings with frozen historical context. No Nelna CCPs/limits/actions invented. Company HACCP plan remains EVIDENCE REQUIRED.

## Phase 24 delivery status

**STATUS: PHASE 24 SAMPLING ENGINE COMPLETE**

Configurable sampling engine (ADR-036): `apps.sampling` with versioned plans, optional match dimensions, sample-requirement shells (no invented AQL/ISO tables), deterministic resolution, REPEATING_GROUP bindings with frozen context, and sampling ACCEPT/REJECT that never auto QA disposition. Company sampling configuration remains EVIDENCE REQUIRED.

## Phase 25 delivery status

**STATUS: PHASE 25 DEVICE TRACEABILITY COMPLETE**

Measurement device traceability (ADR-037): eligibility (org/site/active/type), calibration fitness mapped through OFF/WARN/BLOCK settings (default OFF), frozen `device_trace_context` on draft and submission responses, calibration-certificate evidence kind, and audited override path gated by company approval flag. Device fitness never implies QA disposition.

## Phase 26 delivery status

**STATUS: PHASE 26 FOREIGN BODY CONTROL COMPLETE**

Foreign-body / metal-detector challenge foundation (ADR-038): device-linked challenge records, configurable test-piece shells (no invented sizes), deterministic PASS/FAIL, schedule-rule shells, and containment-interval architecture with auto-HOLD default OFF (APR-052).

## Phase 27 delivery status

**STATUS: PHASE 27 SANITATION MANAGEMENT COMPLETE**

Sanitation / SSOP checklist workflows (ADR-039): programs bind to existing ChecklistTemplate (no separate form engine), configurable site/department/line/work-area/equipment scopes, schedule kinds via ChecklistSchedule links, unseeded ChemicalReference, verification modes mapping to existing self/Supervisor/QA workflows, and FAIL production-stop gated OFF by default (APR-053).

## Phase 28 delivery status

**STATUS: PHASE 28 ENVIRONMENTAL MONITORING COMPLETE**

Environmental monitoring foundation (ADR-040): reusable MonitoringPoint locations, versioned limit shells (no invented bounds), MANUAL/LAB/SENSOR readings, scheduler links, trend index, optional equipment device trace, and excursion auto-HOLD dual-gated OFF by default (APR-054).

## Phase 29 delivery status

**STATUS: PHASE 29 LABEL ARTWORK CONTROL COMPLETE**

Packaging label / artwork verification foundation (ADR-041): versioned PackagingArtwork / ArtworkVersion linked to FG Product and pack-configuration labels, checklist binding to exact approved versions, date-coding shells (MFG/EXP/batch/format references without shelf-life calculation), line-clearance hook stub, historical frozen artwork context on submissions, and Product Master manage vs Document Control approve separation (APR-055).

## Phase 30 delivery status

**STATUS: PHASE 30 ALLERGEN CHANGEOVER FOUNDATION COMPLETE**

Allergen / changeover / line-clearance foundation (ADR-042): unseeded AllergenReference shells, ProductAllergenDeclaration association, ChangeoverRecord (previous/next product, line, time, checklist cleaning refs, packaging hook, verification, evidence), checklist-engine LineClearanceRecord with frozen dossier-ready context, and allergen-matrix production-block dual-gated OFF by default (APR-056).

## Phase 31 delivery status

**STATUS: PHASE 31 RAW MATERIAL QUALITY COMPLETE**

Raw / material receiving quality foundation (ADR-043): ERP-mapped MaterialReference shells (not inventory master), ReceiptQualityRecord keyed to GRN/supplier lot/material with checklist and evidence, versioned material specification shells without invented limits, Phase 22 LIMS sample linking, local PENDING/ACCEPTED/HOLD/REJECTED states that do not update ERP stock, and prepare-only ERP outbound always blocked pending Phase 17 contract (APR-057).

## Phase 32 delivery status

**STATUS: PHASE 32 SUPPLIER QUALITY COMPLETE**

Supplier quality management foundation (ADR-020): ERP-referenced SupplierQualityProfile (not a financial supplier master), free-form certificates with expiry/verification/evidence keys, quality events (defect/audit/complaint/other) linking existing NCR/CAPA domains, count-only metrics with no invented scores/thresholds, and QA manage vs Procurement view separation (APR-039).

## Phase 33 delivery status

**STATUS: PHASE 33 IQC COMPLETE**

Incoming Quality Control workflow (ADR-044): idempotent ERP receipt/GRN event ingest, IqcInspectionCase orchestration over ChecklistTask (PUBLISHED checklist versions only — no hardcoded questions), Phase 24 sampling resolve, Phase 22 lab links, optional Supervisor APPROVED disposition gate, frozen lot→receipt→inspection→decision traceability, and ERP outbound dual-gated OFF by default (APR-058).

## Phase 34 delivery status

**STATUS: PHASE 34 IPQC COMPLETE**

In-Process Quality Control workflows (ADR-045): configurable process-check definitions over PUBLISHED checklist templates (no hardcoded questions), trigger shells (time interval / shift / production order / batch / manual), process context (product / line / step / shift / batch/order), ProductSpecification measurement + equipment device trace + sampling (`IN_PROCESS`) + HACCP metadata snapshots, failure without automatic line stop (dual-gate OFF), controlled NCR/HOLD escalation, and due/overdue/failure dashboard visibility — completing IPQC is not Finished Goods RELEASE (APR-059).

## Phase 35 delivery status

**STATUS: PHASE 35 ELECTRONIC BATCH RECORD COMPLETE**

Electronic batch quality dossier (ADR-046): read-only aggregation of authorized references for one opaque `batch_reference` spanning FG checklist tasks, immutable submissions/corrections, Supervisor/QA reviews, IPQC, lab results, equipment/calibration snapshots, NCR/HOLD/CAPA, loading/dispatch, evidence, integration shells, and audit references — chronological timeline, object-level section gates, paginated evidence/audit, and PDF evidence-pack export hook dual-gated OFF (APR-060). Mutable draft responses are not duplicated; viewing a dossier is not FG RELEASE.

## Phase 36 delivery status

**STATUS: PHASE 36 BATCH GENEALOGY COMPLETE**

Batch / product genealogy (ADR-047): opaque ERP-sourced genealogy nodes and directed edges (raw/supplier/production/rework/FG/sub-lot/shipment), backward and forward BFS traces with depth caps, rework parent→child preservation, cycle prevention on ingest, supplier/customer field restriction (`view_genealogy_partner`), and flat Mongo edge-list projection dual-gated OFF — no invented genealogy and no unbounded embedded graphs (APR-061).

## Phase 37 delivery status

**STATUS: PHASE 37 RECALL MANAGEMENT COMPLETE**

Product recall / withdrawal case management (ADR-048): organization-scoped cases (ID, type/ref, reason, initiator, status, scope, owner, closure), affected products/batches, Phase 36 genealogy expansion, opaque quantity reconciliation (no invented variance), communication reference shells without auto-send, explicit scoped `initiate_recall` (not System Admin / staff / superuser by default), immutable timeline + audit events, and dual-gated OFF external notification / ERP distribution pull (APR-062).

## Phase 38 delivery status

**STATUS: PHASE 38 MOCK RECALL COMPLETE**

Mock recall exercises (ADR-049): explicit `MOCK_EXERCISE` mode with `MOCK-` code prefix and banner so exercises cannot be confused with real recalls; exercise metrics (started/completed, scope, traceback/forward completeness, quantity reconciliation, gaps, actions); hard isolation from ERP stock, real customer/regulatory notifications, and dispatch blocking; findings may open NCR/CAPA/improvement only via explicit user action (`run_mock_recall` ≠ `initiate_recall`) (APR-063).

## Phase 39 delivery status

**STATUS: PHASE 39 CUSTOMER COMPLAINTS COMPLETE**

Customer quality complaint management (ADR-050): organization-scoped cases with ERP customer references, configurable category/severity shells, batch-known/unknown, batch-trace to dossier/genealogy/QA/lab/dispatch, evidence links, explicit investigation/RCA/NCR/CAPA links, communication references without auto-send, and privacy-restricted customer-sensitive fields (APR-064).

## Phase 40 delivery status

**STATUS: PHASE 40 PRODUCT RETURNS QUALITY COMPLETE**

Returned product quality workflow (ADR-051): organization-scoped return quality records keyed to opaque ERP/SFA return references, default quarantine with `not_saleable_via_app=True`, checklist-engine inspection task hooks, configurable local disposition architecture (RELEASE/HOLD/REWORK/REJECT), allowlisted evidence links, and ERP stock movement blocked behind dual-gate approval by default. Company return disposition catalogue, quarantine procedure, and ERP movement enablement remain **EVIDENCE REQUIRED** (APR-065); local RELEASE does not make stock saleable in ERP.


## Phase 41 delivery status

**STATUS: PHASE 41 QUARANTINE MANAGEMENT COMPLETE**

Quality quarantine management (ADR-052): organization-scoped local quality state linked through opaque batch and source references, multiple open cases per batch, append-only history, policy-gated quantity references, release permission plus runtime approval, local ERP sync status tracking, and a fail-closed ERP boundary. ERP remains the authoritative inventory ledger. Company procedure, owners, role mapping, quantity semantics, and ERP adapter evidence remain **EVIDENCE REQUIRED** (APR-066).

## Phase 42 delivery status

**STATUS: PHASE 42 REWORK MANAGEMENT COMPLETE**

Controlled rework management (ADR-053): organization-scoped rework cases with explicit create and authorize permissions, source/result genealogy, quantity conservation, and a new published-version reinspection on the resulting batch. REJECT does not automatically create rework. Original QA review, HOLD, REJECT, and NCR history is never rewritten. ERP quantity/status updates remain blocked behind dual-gate approval. Company rework SOP, SoD mapping, and ERP adapter evidence remain **EVIDENCE REQUIRED** (APR-067).

## Phase 43 delivery status

**STATUS: PHASE 43 DOCUMENT CONTROL COMPLETE**

Quality document control (ADR-054): organization-scoped versioned QMS documents with generic architectural kinds only (SOP, work instruction, specification, test method, policy, form reference). Approved, effective, and retired versions are immutable. Operators see only currently effective documents and files. Quality records may cite an exact approved/effective/retired version. Files use Phase 11 private evidence storage. Optional acknowledgement is not competency training. Document numbering, type catalogue, and role mapping remain **EVIDENCE REQUIRED** (APR-068).

## Phase 44 delivery status

**STATUS: PHASE 44 CHANGE CONTROL COMPLETE**

Quality change control (ADR-055): organization-scoped change requests with owner-supplied identifiers, impact assessment (quality, food-safety, technical, training, validation, data migration), generic affected-area links, and implementation citations of deployed configuration/versions. Engineering completion is never business approval. Requester cannot self-approve; approver cannot also close. Closed records are historically immutable. Company change SOP, numbering, risk scoring, and role mapping remain **EVIDENCE REQUIRED** (APR-069).

## Phase 45 delivery status

**STATUS: PHASE 45 AUDIT MANAGEMENT COMPLETE**

Quality audit management (ADR-056): organization-scoped QMS audit plans with owner-supplied identifiers, generic architectural types, participants, and audit-checklist bindings that do not reuse operational FG checklists automatically. Findings are generic and do not invent a severity taxonomy. NCR/CAPA may be linked or created only by explicit authorized action. Auditor permissions are separate from operational QA review. This module is not the security event log. Company audit programme, frequency, and classification catalogue remain **EVIDENCE REQUIRED** (APR-070).

## Phase 46 delivery status

**STATUS: PHASE 46 COMPLIANCE MAPPING COMPLETE**

Compliance control mapping (ADR-057): organization-scoped source register and versioned editions that record official citations only. Control mappings link owner-supplied clause references to system controls and evidence citations. Statuses are truthful; `IMPLEMENTED` is not `COMPLIANT`. Gaps may create Risk / Change / NCR / CAPA / Action only by explicit authorized action. Administration is restricted; auditor read access is separate. Software implementation supports compliance evidence and does **not** prove ISO, FSSC, HACCP, SLS/SLSI, legal, or regulatory compliance. Official sources, applicability, and licensed clause text remain **EVIDENCE REQUIRED** (APR-071).

## Phase 47 delivery status

**STATUS: PHASE 47 QUALITY RISK MANAGEMENT COMPLETE**

Quality risk management (ADR-058): organization-scoped risks with owner-supplied identifiers and generic cause/impact/control/owner fields. Assessments are append-only historical snapshots. Likelihood/severity/detectability/exposure/residual inputs are stored as owner text. Scoring is **OFF** until an owner-cited company method is configured. The application does not invent a 1–5 matrix, RAG thresholds, or acceptance criteria. Residual acceptance is a separate permission. High-rated dashboard membership uses only owner-configured residual codes on an enabled policy. Company scoring methodology remains **EVIDENCE REQUIRED** (APR-072).

## Phase 48 delivery status

**STATUS: PHASE 48 PROCESS FMEA COMPLETE**

Process FMEA (ADR-059): organization-scoped FMEA headers with numbered versions. Process steps, failure modes, effects, causes, current controls, and recommended actions are recorded on a version. Approved, superseded, and withdrawn versions are historically immutable; changes create a new revision. Severity, occurrence, and detection are stored as owner inputs. Scoring is **OFF** until an owner-cited method is configured. `SOD_PRODUCT` multiplies whole-number S×O×D only and does not invent thresholds or Action Priority bands. Recommended actions become CAPA or change requests only by explicit authorized action. Company PFMEA methodology remains **EVIDENCE REQUIRED** (APR-073).

## Phase 49 delivery status

**STATUS: PHASE 49 RCA TOOLKIT COMPLETE**

Structured RCA (ADR-060): organization-scoped investigation records with owner-supplied identifiers, optional 5 Why / fishbone / cause-evidence tools, and separated edit vs confirm permissions. Cause states are POSSIBLE, SUPPORTED, and CONFIRMED. Software and AI may record hypotheses only. A human investigator confirms a root cause with evidence. Confirmed causes may generate CAPA only by explicit authorized action. Company RCA SOP remains **EVIDENCE REQUIRED** (APR-074).

