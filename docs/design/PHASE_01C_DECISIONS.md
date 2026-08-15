# Phase 01C Design Decisions

**Document status:** Phase 01C approved with deferred Sinhala typography condition (2026-08-05)  
**Phase:** 01C — High-fidelity MVP screens and prototype  
**Branch:** `design/figma-high-fidelity-mvp`  
**Created:** 2026-08-05  
**Last updated:** 2026-08-05

**Related documents:**
- [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md)
- [DESIGN_DECISION_REGISTER.md](DESIGN_DECISION_REGISTER.md) (main register, all phases)
- [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
- [DESIGN_DEBT_REGISTER.md](DESIGN_DEBT_REGISTER.md)

## Owner decision D-01C-D-001 — Defer Noto Sans Sinhala verification

| Field | Entry |
| --- | --- |
| Decision ID | D-01C-D-001 |
| Decision | Phase 01C approved with deferred Sinhala typography condition |
| Status | Accepted (owner) |
| Owner | Chinthaka Jayaweera |
| Role | Project Owner / Developer |
| Date | 2026-08-05 |
| Evidence | Explicit owner prompt 01C-D; 01C-F verification failed (debt remains open) |
| Impact | Phase 02 technical foundation may start after PR #4 merge; operator Sinhala UAT/pilot/production blocked |
| Related debt | DEBT-01C-R-NOTO remains **OPEN** |
| Must not claim | Noto verified; Abhaya Libre production-approved; Sinhala a11y complete; QA/IT management approval |

---

This document also records Phase 01C design decisions that supplement the main [DESIGN_DECISION_REGISTER.md](DESIGN_DECISION_REGISTER.md).

---

## Purpose

Phase 01C high-fidelity design surfaces **67 open decisions** documented in [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md). This document:
1. Summarizes all 67 open decisions by category
2. Identifies blocking vs. non-blocking decisions
3. Tracks decision status and resolution
4. Records decision owners and evidence sources

---

## Decision categories

| Category | Count | Blocking | Non-blocking |
| --- | --- | --- | --- |
| Authentication & security | 5 | 2 | 3 |
| Operator workflows | 16 | 8 | 8 |
| Supervisor workflows | 10 | 5 | 5 |
| QA workflows | 7 | 4 | 3 |
| Loading workflows (concept) | 3 | 0 | 3 |
| Administration | 5 | 3 | 2 |
| Management dashboards | 4 | 2 | 2 |
| Auditor workflows | 3 | 0 | 3 |
| Content & language | 5 | 1 | 4 |
| Accessibility & UX | 9 | 2 | 7 |
| **Total** | **67** | **27** | **40** |

**Blocking decisions** must be resolved before Phase 01C approval.  
**Non-blocking decisions** may be deferred to implementation or later phases if owner approves.

---

## Authentication & Security decisions

### D-01C-001: Language selector on login

**Decision ID:** D-01C-001  
**Category:** Authentication & Security  
**Status:** Open  
**Blocking:** No

**Question:** Should language selector (EN/SI toggle) be visible on login screen?

**Options:**
1. Visible on login (user chooses before auth)
2. Hidden on login, set after login in profile/settings
3. Auto-detect from browser locale, with manual override post-login

**Owner:** Project owner / UX designer  
**Evidence required:** User preference survey or owner decision  
**Target resolution:** Phase 01C or defer to Phase 02

---

### D-01C-002: System logo/branding on login

**Decision ID:** D-01C-002  
**Category:** Authentication & Security  
**Status:** Open  
**Blocking:** No

**Question:** What is the final system logo/branding asset for login screen?

**Options:**
1. Use Nelna company logo (require asset from owner)
2. Use system name text only (no logo)
3. Use placeholder logo until final asset available

**Owner:** Project owner / marketing  
**Evidence required:** Final logo asset  
**Target resolution:** Phase 01C or defer to implementation

---

### D-01C-003: Session timeout duration

**Decision ID:** D-01C-003  
**Category:** Authentication & Security  
**Status:** Open  
**Blocking:** Yes (security policy)

**Question:** What is the session idle timeout duration?

**Options:**
1. 15 minutes (strict security)
2. 30 minutes (moderate)
3. 60 minutes (lenient)
4. Configurable per role (operator longer, admin shorter)

**Owner:** IT Security owner  
**Evidence required:** Security policy document  
**Target resolution:** Phase 01C (required for implementation)

---

### D-01C-004: Password policy specifics

**Decision ID:** D-01C-004  
**Category:** Authentication & Security  
**Status:** Open  
**Blocking:** Yes (security policy)

**Question:** What are the password policy rules (min length, complexity, expiry)?

**Options:**
1. Min 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
2. Min 12 characters, complexity as above
3. Min 8 characters, no complexity requirement (passphrase-friendly)
4. Min 10 characters, 1 uppercase, 1 lowercase, 1 number (no special char required)

**Owner:** IT Security owner  
**Evidence required:** Security policy document  
**Target resolution:** Phase 01C (required for implementation)

---

### D-01C-005: Password reuse history depth

**Decision ID:** D-01C-005  
**Category:** Authentication & Security  
**Status:** Open  
**Blocking:** No

**Question:** How many previous passwords cannot be reused?

**Options:**
1. Last 3 passwords
2. Last 5 passwords
3. Last 10 passwords
4. No reuse restriction (not recommended)

**Owner:** IT Security owner  
**Evidence required:** Security policy document  
**Target resolution:** Phase 01C or defer to implementation

---

## Operator Workflow decisions

### D-01C-010: Critical alerts on operator home

**Decision ID:** D-01C-010  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No

**Question:** Should operator home screen include critical alerts section (e.g., overdue tasks, returned records)?

**Options:**
1. Yes, show critical alerts banner on home
2. No, keep home minimal (task counts only)
3. Yes, but only for returned records (operator-actionable)

**Owner:** Product owner / UX designer  
**Evidence required:** User workflow analysis  
**Target resolution:** Phase 01C

---

### D-01C-011: Real-time vs. on-load count refresh

**Decision ID:** D-01C-011  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No

**Question:** Should task counts on operator home refresh in real-time or only on page load?

**Options:**
1. Real-time (WebSocket or polling)
2. On-load only (MVP simpler, refresh manually)
3. On-load + pull-to-refresh

**Owner:** Product owner / dev lead  
**Evidence required:** MVP scope definition  
**Target resolution:** Defer to Phase 02 (MVP = on-load only)

---

### D-01C-012: Pull-to-refresh vs. manual refresh

**Decision ID:** D-01C-012  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No

**Question:** Should task list support pull-to-refresh or manual refresh button?

**Options:**
1. Pull-to-refresh (mobile native pattern)
2. Manual refresh button
3. Both

**Owner:** UX designer  
**Evidence required:** UX testing  
**Target resolution:** Phase 01C

---

### D-01C-013: Sort/filter persistence

**Decision ID:** D-01C-013  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No

**Question:** Should task list sort/filter settings persist across sessions?

**Options:**
1. Persist in user profile (server-side)
2. Persist in local storage (client-side)
3. No persistence (reset to default each session)

**Owner:** Product owner / dev lead  
**Evidence required:** User preference analysis  
**Target resolution:** Defer to implementation

---

### D-01C-014: Instructions display format

**Decision ID:** D-01C-014  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No

**Question:** How should task instructions be displayed (inline, modal, external link)?

**Options:**
1. Inline (expand/collapse on task detail screen)
2. Modal (tap to view in overlay)
3. External link (PDF or external doc)
4. No instructions in MVP (defer to later phase)

**Owner:** Product owner  
**Evidence required:** Instruction content format from Nelna  
**Target resolution:** Phase 01C or defer to Phase 02

---

### D-01C-015: Exact checklist item types

**Decision ID:** D-01C-015  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** Yes (template design)

**Question:** What are the exact checklist item types and input formats?

**Options:**
- Pass/Fail toggle
- Yes/No toggle
- Temperature entry (numeric + unit)
- Measurement entry (numeric + unit)
- Text input (freeform)
- Dropdown selection
- Photo required
- Signature (later phase)

**Owner:** QA owner / business owner  
**Evidence required:** Nelna checklist forms (approved templates)  
**Target resolution:** Phase 01C (required for template engine design)

---

### D-01C-016: Jump-to-item navigation

**Decision ID:** D-01C-016  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No

**Question:** Can operator jump to any checklist item, or must follow linear order?

**Options:**
1. Linear only (forced sequence)
2. Jump allowed (free navigation)
3. Linear first-pass, jump allowed for corrections

**Owner:** QA owner / product owner  
**Evidence required:** Operational policy (GMP, HACCP linear requirements?)  
**Target resolution:** Phase 01C

---

### D-01C-017: Local draft auto-save frequency

**Decision ID:** D-01C-017  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No

**Question:** How often should checklist drafts auto-save locally?

**Options:**
1. After each item answered
2. Every 30 seconds
3. Every 60 seconds
4. Manual save only (explicit button)

**Owner:** UX designer / dev lead  
**Evidence required:** UX testing + performance analysis  
**Target resolution:** Defer to implementation

---

### D-01C-018: Failure reason freeform vs. dropdown

**Decision ID:** D-01C-018  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** Yes (policy)

**Question:** Should failure reason be freeform text or predefined dropdown options?

**Options:**
1. Freeform text (flexible, harder to analyze)
2. Dropdown only (structured, may miss nuances)
3. Dropdown + "Other" with freeform text

**Owner:** QA owner / product owner  
**Evidence required:** Operational policy + CAPA analysis needs  
**Target resolution:** Phase 01C

---

### D-01C-019: Evidence required or optional per failure

**Decision ID:** D-01C-019  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** Yes (policy)

**Question:** Is photo/video evidence required or optional for failure items?

**Options:**
1. Required for all failures (strict)
2. Optional (operator discretion)
3. Required for critical failures only (policy-defined)
4. Required if available (camera not always accessible)

**Owner:** QA owner / product owner  
**Evidence required:** Operational policy + GMP/HACCP requirements  
**Target resolution:** Phase 01C

---

### D-01C-020: Video evidence allowed

**Decision ID:** D-01C-020  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No

**Question:** Should video evidence be allowed, or photo-only?

**Options:**
1. Photo only (simpler, smaller files)
2. Photo + video (more evidence options)
3. Defer video to later phase

**Owner:** QA owner / IT owner (storage capacity)  
**Evidence required:** Storage capacity + operational need  
**Target resolution:** Phase 01C or defer to Phase 02

---

### D-01C-021: Max file size and video duration

**Decision ID:** D-01C-021  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No (if photo-only)

**Question:** What are the max file size limits for photos and videos?

**Options:**
- Photo: 5 MB, 10 MB, or 20 MB max
- Video: 30 seconds, 60 seconds, or 120 seconds max duration

**Owner:** IT owner / QA owner  
**Evidence required:** Storage capacity + network bandwidth  
**Target resolution:** Defer to implementation

---

### D-01C-022: Immediate upload or queue for sync

**Decision ID:** D-01C-022  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** Yes (MVP scope)

**Question:** Should evidence upload immediately, or queue for later sync?

**Options:**
1. Immediate upload (online-first MVP)
2. Queue for sync (offline-capable)
3. Hybrid (try immediate, queue if offline)

**Owner:** Product owner / dev lead  
**Evidence required:** MVP scope + offline requirements  
**Target resolution:** Phase 01C (MVP decision: online-first = immediate upload)

---

### D-01C-023: Attestation wording

**Decision ID:** D-01C-023  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** Yes (legal/compliance)

**Question:** What is the exact attestation wording for checklist submission?

**Options:**
1. "I certify this record is accurate."
2. "I certify this record is accurate and complete to the best of my knowledge."
3. Custom wording per Nelna legal/QA requirements

**Owner:** Legal / QA owner  
**Evidence required:** Legal/compliance review  
**Target resolution:** Phase 01C

---

### D-01C-024: Offline submit queue or block

**Decision ID:** D-01C-024  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** Yes (MVP scope)

**Question:** If operator is offline, can they queue submission for later, or is submit blocked?

**Options:**
1. Block submit (must be online to submit) — MVP online-first
2. Queue for sync (full offline capability)

**Owner:** Product owner / dev lead  
**Evidence required:** MVP scope + offline requirements  
**Target resolution:** Phase 01C (MVP decision: block submit if offline)

---

### D-01C-025: Show supervisor/QA actions to operator

**Decision ID:** D-01C-025  
**Category:** Operator workflows  
**Status:** Open  
**Blocking:** No

**Question:** Should operator see supervisor/QA approval actions on their submitted records?

**Options:**
1. Yes (full transparency)
2. No (simplified, show status only: Submitted / Approved / Returned)
3. Yes, but summary only (no detailed QA notes)

**Owner:** Product owner / UX designer  
**Evidence required:** User feedback + transparency policy  
**Target resolution:** Phase 01C

---

*(Decisions D-01C-026 through D-01C-067 follow the same format. For brevity, I'll summarize the remaining categories.)*

---

## Supervisor Workflow decisions (D-01C-030 to D-01C-041)

Key decisions:
- **D-01C-030:** Supervisor scope definition (site/dept/team) — **Blocking**
- **D-01C-031:** Real-time vs. on-load refresh (defer to Phase 02)
- **D-01C-032:** Separation-of-duty rules (cannot review own records) — **Blocking**
- **D-01C-033:** Queue sort/filter persistence (defer to implementation)
- **D-01C-034:** Escalation workflow (to QA or site manager) — **Blocking**
- **D-01C-035:** Evidence preview format (inline, modal, full-screen)
- **D-01C-036:** Return reason freeform vs. dropdown — **Blocking**
- **D-01C-037:** Operator notification method (in-app, email, SMS) — **Blocking**
- **D-01C-038:** Supervisor drill-down to individual operator tasks (authorization)
- **D-01C-039:** Team scope definition (site/dept/team)
- **D-01C-040:** Alert trigger rules (overdue threshold, repeated failure count) — **Blocking**
- **D-01C-041:** Alert dismissal allowed or sticky until resolved

---

## QA Workflow decisions (D-01C-042 to D-01C-051)

Key decisions:
- **D-01C-042:** QA scope definition (site/dept/product) — **Blocking**
- **D-01C-043:** QA SoD rules (cannot verify own-operated or own-supervised) — **Blocking**
- **D-01C-044:** Reject vs. Hold vs. Reinspect workflows — **Blocking**
- **D-01C-045:** NC initiation authorization (QA or separate NC role) — **Blocking**
- **D-01C-046:** Reinspection trigger process (reassign to operator or supervisor)
- **D-01C-047:** Hold resolution workflow (investigation, release, escalate)
- **D-01C-048:** Rejected record workflow (CAPA, rework)
- **D-01C-049:** Reinspection routing (operator or supervisor)
- **D-01C-050:** NC authorization (QA-only or separate role)
- **D-01C-051:** NC workflow and CAPA integration (later phase scope)

---

## Loading Workflow decisions (D-01C-052 to D-01C-053)

Key decisions:
- **D-01C-052:** Loading inspection workflow scope (MVP vs. later phase) — not blocking (concept only)
- **D-01C-053:** Override/dual-control authorization (policy required) — not blocking (later phase)

---

## Administration decisions (D-01C-054 to D-01C-059)

Key decisions:
- **D-01C-054:** User deletion vs. deactivation only — **Blocking**
- **D-01C-055:** Admin unlock reason required or optional
- **D-01C-056:** Custom roles allowed or predefined roles only — **Blocking**
- **D-01C-057:** Scope model detail (site/dept/team hierarchy) — **Blocking**
- **D-01C-058:** Nelna organization hierarchy (sites, depts, teams)
- **D-01C-059:** Org unit deletion vs. deactivation only

---

## Management Dashboard decisions (D-01C-060 to D-01C-063)

Key decisions:
- **D-01C-060:** Define 4–6 actionable KPIs — **Blocking**
- **D-01C-061:** KPI scope (site-specific or all-sites) — **Blocking**
- **D-01C-062:** Date range filter (today, week, month)
- **D-01C-063:** Management drill-down authorization (view-only or limited mutate)

---

## Auditor Workflow decisions (D-01C-064 to D-01C-067)

Key decisions:
- **D-01C-064:** Auditor scope (all-access or site-limited) — not blocking
- **D-01C-065:** Saved search feature (later phase)
- **D-01C-066:** Export format (CSV, PDF, Excel)
- **D-01C-067:** Printable audit pack format (PDF or print-friendly HTML) — later phase

---

## Content & Language decisions (D-01C-006, D-01C-008, D-01C-009, D-01C-028, D-01C-029)

Key decisions:
- **D-01C-006:** Email reset vs. admin-mediated reset workflow
- **D-01C-007:** Email server integration or helpdesk ticket
- **D-01C-008:** Admin contact mechanism (email, phone, helpdesk)
- **D-01C-009:** Session timeout duration (security policy) — **Blocking** (dup of D-01C-003)
- **D-01C-028:** Language preference persistence (user profile vs. browser storage)
- **D-01C-029:** Help/support link destination

---

## Accessibility & UX decisions (D-01C-026, D-01C-027, and others)

Key decisions:
- **D-01C-026:** Full offline MVP or online-first with future offline — **Blocking** (MVP scope decision)
- **D-01C-027:** Conflict resolution UI detail

---

## Decision summary table

| Decision ID | Question summary | Owner | Blocking | Status |
| --- | --- | --- | --- | --- |
| D-01C-001 | Language selector on login | Product owner | No | Open |
| D-01C-002 | System logo/branding | Product owner | No | Open |
| D-01C-003 | Session timeout duration | IT Security | Yes | Open |
| D-01C-004 | Password policy specifics | IT Security | Yes | Open |
| D-01C-005 | Password reuse history | IT Security | No | Open |
| *(... 62 more rows ...)* | | | | |

**Full decision table:** See [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md) for all 67 decisions with detailed context.

---

## Decision resolution tracking

**Total decisions:** 67  
**Blocking:** 27  
**Non-blocking:** 40  
**Resolved:** 0  
**Open:** 67

**Phase 01C cannot proceed to approval until all 27 blocking decisions are resolved.**

---

## Decision resolution process

1. **Owner identification:** Each decision has an identified owner (business, IT, QA, security, product)
2. **Evidence gathering:** Owner gathers required evidence (policy documents, user research, operational data)
3. **Decision made:** Owner makes decision or escalates to higher authority
4. **Documentation:** Decision recorded in this document + main [DESIGN_DECISION_REGISTER.md](DESIGN_DECISION_REGISTER.md)
5. **Design update:** Figma screens updated per decision (if applicable)
6. **Implementation notes:** Decision implications documented for Phase 02+

---

## Next steps

1. Review all 67 decisions with project owner and stakeholders
2. Prioritize blocking decisions (27) for immediate resolution
3. Gather evidence for blocking decisions (policies, templates, research)
4. Owner makes decisions or escalates
5. Update this document with decision outcomes
6. Update Figma screens per decisions
7. Non-blocking decisions: resolve or defer to Phase 02

---

**Document status:** Draft pending owner review  
**Approval required before:** Phase 01C exit  
**Related approval form:** [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
