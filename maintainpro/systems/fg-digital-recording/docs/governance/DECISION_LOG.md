# Decision Log

**Document status:** Canonical chronological decision log
**Created:** 2026-08-09
**Companion register:** [docs/decisions/DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md) (original Phase 00 table — still valid for DEC-001+)
**Rule:** Do not fabricate signatures, named approvers, or business approvals.

## How to use

| Field | Meaning |
| --- | --- |
| Decision ID | Stable ID (`DL-…` for this log; `DEC-…` / `ADR-…` for linked artefacts) |
| Question | What was being decided |
| Decision | What was chosen (or “open”) |
| Authority | Role/body that may decide (names OWNER TO BE CONFIRMED unless evidenced) |
| Date | Decision date or “open” |
| Evidence | Doc/ADR/approval path |
| Impact | Delivery / architecture / business impact |
| Superseded decision | Prior ID if replaced |

---

## Technical direction (accepted — named persons mostly TBC)

| Decision ID | Question | Decision | Authority | Date | Evidence | Impact | Superseded decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DL-001 / DEC-001 | Backend language/framework? | Python + Django 5.2 LTS | Technical Lead (TBC name) | 2026-08-04 | DECISION_REGISTER; constitution | Backend stack fixed | — |
| DL-002 / DEC-002 | Service topology? | Modular monolith (no microservices initially) | Technical Lead (TBC) | 2026-08-04 | ADR-001 | Single deployable | — |
| DL-003 / DEC-003 | Primary operational DB? | PostgreSQL (+ JSONB where appropriate) | IT Manager (TBC) | 2026-08-04 | ADR-002 | MongoDB not primary | — |
| DL-004 / DEC-004–005 | Client delivery? | Responsive installable PWA later; no initial native app | Business / IT (TBC) | 2026-08-04 | ADR-003 | PWA not yet implemented | — |
| DL-005 / DEC-006–007 | Cache/jobs? | Redis + Celery | IT Manager (TBC) | 2026-08-04 | DECISION_REGISTER | Ops requires Redis | — |
| DL-006 / DEC-008 | Evidence binaries? | MinIO local; S3-compatible in production | IT Manager (TBC) | 2026-08-04 | ADR-002 | No DB BLOBs | — |
| DL-007 / DEC-009 | UI stack? | Django Templates + HTMX + Tailwind; minimal JS | Technical Lead (TBC) | 2026-08-04 | DECISION_REGISTER | Server-driven UI | — |
| DL-008 / DEC-010–011 | AI role? | Optional local assistance only; never final FS/QA/access decisions | Project Owner / QA (TBC) | 2026-08-04 | AI_SAFETY_POLICY | Human accountability | — |
| DL-009 / DEC-012–013 | Repo & delivery control? | Private GitHub; phase gates | Project Owner (TBC) | 2026-08-04 | DECISION_REGISTER | PR/phase discipline | — |
| DL-010 / ADR-004 | Dependency management? | uv + lockfile | Technical Lead | Phase 02 | ADR-004 | Reproducible installs | — |
| DL-011 / ADR-005 | Settings/environments? | Split Django settings; production fail-closed | Technical Lead / IT | Phase 02 | ADR-005 | No silent prod misconfig | — |
| DL-012 / ADR-006 | Identity? | Employee-code session authentication | Security / Technical Lead | Phase 03 | ADR-006 | Named accounts | — |
| DL-013 / ADR-007 | Authorization model? | Scoped RBAC; deny by default | Security / Technical Lead | Phase 03 | ADR-007 | Org/site/dept scoping | — |

---

## Provisional technical configuration (not business approval of Nelna values)

| Decision ID | Question | Decision | Authority | Date | Evidence | Impact | Superseded decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DL-020 | May Shift be a configurable unseeded foundation before official values? | Yes — provisional technical only | Owner provisional direction | 2026-08-07 | PHASE_04_SHIFT_PROVISIONAL_CONFIGURATION; ADR-008 | 04A/04B coding unblocked; production values still blocked | — |
| DL-021 | May FG Product be configurable unseeded before MASTER-001? | Yes — provisional technical only | Owner provisional direction | 2026-08-07 | PHASE_05_FG_PRODUCT_PROVISIONAL_CONFIGURATION; ADR-009 | 05A/05B unblocked; catalogues still blocked | — |
| DL-022 | May checklist definition engine proceed before TEMPLATE approval? | Yes — provisional technical only | Owner provisional direction | 2026-08-07 | PHASE_06_CHECKLIST_PROVISIONAL_CONFIGURATION; ADR-010 | 06A–06D unblocked; FG-QA-001 draft ≠ approved | — |
| DL-023 | Provisional FG-QA-001 workflow outline? | Recorded provisional (per-batch; recorder categories; Supervisor/QA outline) — **not** formal QA/Production sign-off | Owner-directed provisional | 2026-08 | PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW | Guides later phases; not production policy | — |
| DL-024 | Batch checklist task without ProductionBatch master? | Yes — `batch_reference` + explicit published version | Architecture | Phase 07A | ADR-011 | No invented ERP batch entity | — |
| DL-025 | Batch source & recorder authorization boundary? | Contract + `record_checklisttask`; manage ≠ record | Architecture | Phase 07B | ADR-012 | Integration readiness without connector | — |
| DL-026 | Draft recording model? | ChecklistRecord/Response draft foundation | Architecture | Phase 08A | ADR-013 | Typed drafts; no submit engine | — |
| DL-027 | Submission immutability? | Immutable ChecklistSubmission snapshots | Architecture | Phase 08B | ADR-014 | Post-submit edit blocked | — |
| DL-028 | Supervisor review model? | Immutable SupervisorReview; APPROVED/RETURNED | Architecture | Phase 09A | ADR-015 | No QA disposition in reviews | — |
| DL-029 | Correction/resubmission? | ChecklistCorrection → new submission number | Architecture | Phase 09B | ADR-016 | No mutation of prior snapshots | — |
| DL-030 | QA final disposition? | Immutable QAReview; manual RELEASE/HOLD/REJECT only | Architecture | Phase 10A | ADR-017 | No ERP/auto PASS-FAIL | — |

---

## Open business decisions (not decided)

| Decision ID | Question | Decision | Authority | Date | Evidence | Impact | Superseded decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DL-040 / DEC-014 | Exactly which checklist types in MVP? | Open (proposed: two types) | QA / Business | open | DECISION_REGISTER | MVP content scope | — |
| DL-041 / DEC-015 | Pilot site, users, devices, dates? | Open | Business + QA + IT | open | DECISION_REGISTER | Pilot planning blocked | — |
| DL-042 / DEC-016 | Hosting for non-local envs? | Open | IT Manager | open | ASM-015 | UAT/staging blocked | — |
| DL-043 / DEC-017 | Retention period? | Open | QA / Legal (TBC) | open | ASM-013 | Storage/purge design | — |
| DL-044 | Require MongoDB despite ADR-002? | Open — company requested; **POC REQUIRED** before SoR change | IT / Management | open | APR-020; ADR-002; ADR-018 | Major architecture change if accepted | — |
| DL-048 | May Mongo replace PostgreSQL on `main` without POC? | **No** — blind URI swap forbidden | Technical Lead (assessment) | 2026-08-10 | ADR-018; migration strategy | DB-02 NO-GO until POC | — |
| DL-045 | Bileeta as batch/ERP source? | Open | IT / Vendor | open | APR-012 | Phase 17 / generation | — |
| DL-046 | Offline required for pilot? / implement Phase 14 offline now? | **Phase 14 gate:** do **not** implement offline sync now; retain online-only MVP assumption + paper fallback. Pilot offline *requirement* remains open until APR-022 + Wi-Fi/device evidence | Architecture (gate) / IT+Production+QA (APR-022 still open) | 2026-08-10 | ADR-026; PHASE_14_OFFLINE_DECISION_GATE; APR-022/030/031 | No IndexedDB sync in this phase | — |
| DL-047 | SoD enforcement rules? | Open | QA / Management | open | APR-010 | UAT/pilot blocked | — |

---

## Governance meta-decision (this baseline)

| Decision ID | Question | Decision | Authority | Date | Evidence | Impact | Superseded decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DL-100 | Where is canonical project status kept? | `docs/PROJECT_STATUS.md` | Project governance baseline | 2026-08-09 | This package | README must not contradict without update | Informal README phase tables |
| DL-101 | Where are outstanding approvals tracked? | `docs/governance/APPROVAL_REGISTER.md` | Project governance baseline | 2026-08-09 | APPROVAL_REGISTER | Silence ≠ approval | Ad-hoc checklist only |
| DL-102 | How are scope changes controlled? | Documentation process in CHANGE_CONTROL.md | Project governance baseline | 2026-08-09 | CHANGE_CONTROL | Prevent silent scope creep | — |

---

## Notes

- Provisional technical decisions **do not** approve Nelna operational data or production use.
- When a business decision is approved, add a row here **and** update APPROVAL_REGISTER with Approver + date + evidence path.
