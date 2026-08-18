# Design Debt Register

**Document status:** Living debt register — DEBT-01C-R-NOTO remains open
**Phase:** Design debt still open while application foundations through Phase 10A exist on `main`
**Branch:** originated on design phases; track against `main`
**Created:** 2026-08-05
**Last updated:** 2026-08-09
**Canonical project status:** [../PROJECT_STATUS.md](../PROJECT_STATUS.md)

**Related documents:**
- [PHASE_01B_DESIGN_APPROVAL.md](../approvals/PHASE_01B_DESIGN_APPROVAL.md)
- [DESIGN_ACCEPTANCE_CRITERIA_01C.md](DESIGN_ACCEPTANCE_CRITERIA_01C.md)
- [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md)

This document tracks design debt: incomplete design work, deferred items, and Phase 01B remaining conditions. Design debt must be resolved before phase exit or explicitly deferred to later phases.

---

## Purpose

Design debt register:
1. Tracks Phase 01B remaining conditions (carried into Phase 01C)
2. Tracks Phase 01C incomplete work or deferred items
3. Identifies blocking vs. non-blocking debt
4. Records required resolution phase and owner
5. Prevents silent omission of design work

---

## Debt status definitions

| Status | Definition |
| --- | --- |
| Open | Not started or incomplete |
| In Progress | Work underway |
| Complete | Resolved and closed |
| Deferred | Explicitly deferred to later phase (with owner approval) |
| Cancelled | No longer needed (with reason) |

---

## Blocking vs. Non-blocking debt

| Type | Definition | Phase exit allowed |
| --- | --- | --- |
| **Blocking** | Must resolve before phase exit | No |
| **Non-blocking** | Can defer to later phase (with owner approval) | Yes (if approved) |

---

## Phase 01B conditions (carried into Phase 01C)

From [PHASE_01B_DESIGN_APPROVAL.md](../approvals/PHASE_01B_DESIGN_APPROVAL.md), approved with conditions on 2026-08-05:

### DEBT-01B-001: Complete typography Figma variables

**Debt ID:** DEBT-01B-001
**Phase:** 01B (carried to 01C)
**Category:** Design tokens
**Blocking:** No (can build screens with available vars, but must complete before 01C exit)
**Status:** Open

**Description:** Complete typography Figma variable collections per [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md):
- Font family variables (sans, mono)
- Font size variables (12, 14, 16, 18, 20, 24, 28)
- Font weight variables (400, 500, 600, 700)
- Line height variables (1.25, 1.45, 1.6)

**Required resolution phase:** 01C
**Owner:** Design owner
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-002: Complete spacing Figma variables

**Debt ID:** DEBT-01B-002
**Phase:** 01B (carried to 01C)
**Category:** Design tokens
**Blocking:** No
**Status:** Open

**Description:** Complete spacing Figma variable collections per [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md):
- Base spacing scale (4px base)
- Spacing values: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128

**Required resolution phase:** 01C
**Owner:** Design owner
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-003: Complete radius Figma variables

**Debt ID:** DEBT-01B-003
**Phase:** 01B (carried to 01C)
**Category:** Design tokens
**Blocking:** No
**Status:** Open

**Description:** Complete border-radius Figma variable collections per [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md):
- Radius values: 0, 4, 8, 12

**Required resolution phase:** 01C
**Owner:** Design owner
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-004: Complete elevation Figma variables

**Debt ID:** DEBT-01B-004
**Phase:** 01B (carried to 01C)
**Category:** Design tokens
**Blocking:** No
**Status:** Open

**Description:** Complete elevation (shadow) Figma variable collections per [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md):
- Elevation levels: 0, 1, 2, 3
- Minimal shadow design (operational clarity, not decorative)

**Required resolution phase:** 01C
**Owner:** Design owner
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-005: Complete motion Figma variables

**Debt ID:** DEBT-01B-005
**Phase:** 01B (carried to 01C)
**Category:** Design tokens
**Blocking:** No
**Status:** Open

**Description:** Complete motion (animation duration/easing) Figma variable collections per [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md):
- Duration values: 120ms (fast), 200ms (normal), 320ms (slow)
- Easing: ease-in-out (or specify cubic-bezier if needed)

**Required resolution phase:** 01C
**Owner:** Design owner
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-006: Complete component-dimension Figma variables

**Debt ID:** DEBT-01B-006
**Phase:** 01B (carried to 01C)
**Category:** Design tokens
**Blocking:** No
**Status:** Open

**Description:** Complete component dimension Figma variable collections per [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md):
- Touch target min: 48px (general), 56px (operator-critical)
- Input height: 48px, 56px
- Button height: 48px, 56px
- Card min-width, max-width, etc.

**Required resolution phase:** 01C
**Owner:** Design owner
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-007: Convert core specimens to reusable component sets

**Debt ID:** DEBT-01B-007
**Phase:** 01B (carried to 01C)
**Category:** Components
**Blocking:** No (can build hi-fi with local components, but must convert before 01C exit)
**Status:** Open

**Description:** Convert core component specimens into reusable Figma component sets with documented variants per [COMPONENT_SYSTEM.md](COMPONENT_SYSTEM.md):
- Button (primary, secondary, tertiary, critical; default, hover, disabled, loading states)
- Input (text, number, select, textarea; default, focus, error, disabled states)
- Card (default, elevated, interactive)
- Status badge (success, warning, critical, info; with icon variants)
- Evidence uploader (idle, uploading, uploaded, error states)
- Modal (small, medium, large)
- Toast notification (success, error, info)
- Banner (offline, warning, critical)
- (other core components per COMPONENT_CATALOGUE)

**Required resolution phase:** 01C
**Owner:** Design owner
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-008: Complete keyboard navigation annotations

**Debt ID:** DEBT-01B-008
**Phase:** 01B (carried to 01C)
**Category:** Accessibility
**Blocking:** Yes (required for Phase 01C acceptance)
**Status:** Open

**Description:** Add keyboard navigation annotations to all hi-fi screens per [ACCESSIBILITY_AND_USABILITY.md](ACCESSIBILITY_AND_USABILITY.md):
- Tab order annotations
- Keyboard shortcuts (if any)
- Escape / Enter behavior
- Focus trap boundaries (modals, drawers)

**Required resolution phase:** 01C
**Owner:** Design owner + a11y reviewer
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-009: Complete visible-focus indicator annotations

**Debt ID:** DEBT-01B-009
**Phase:** 01B (carried to 01C)
**Category:** Accessibility
**Blocking:** Yes
**Status:** Open

**Description:** Add visible focus indicator annotations to all interactive elements per [ACCESSIBILITY_AND_USABILITY.md](ACCESSIBILITY_AND_USABILITY.md):
- Focus ring: 2px solid green (#216E39)
- Focus visible on all buttons, links, inputs, cards, rows

**Required resolution phase:** 01C
**Owner:** Design owner + a11y reviewer
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-010: Complete screen-reader label annotations

**Debt ID:** DEBT-01B-010
**Phase:** 01B (carried to 01C)
**Category:** Accessibility
**Blocking:** Yes
**Status:** Open

**Description:** Add screen-reader label annotations to all interactive elements and dynamic content per [ACCESSIBILITY_AND_USABILITY.md](ACCESSIBILITY_AND_USABILITY.md):
- Button labels (visible + screen-reader)
- Link labels
- Form input labels (visible + aria-label if icon-only)
- Status announcements (e.g., "Loading", "Error", "Success")
- Image alt text (evidence photos, icons)

**Required resolution phase:** 01C
**Owner:** Design owner + a11y reviewer
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-011: Complete Sinhala wrapping tests

**Debt ID:** DEBT-01B-011
**Phase:** 01B (carried to 01C)
**Category:** Accessibility / Localization
**Blocking:** Yes
**Status:** Open

**Description:** Add Sinhala text wrapping tests to operator screens per [ACCESSIBILITY_AND_USABILITY.md](ACCESSIBILITY_AND_USABILITY.md):
- Test long Sinhala words in buttons (wrap or truncate?)
- Test multi-line Sinhala labels in forms
- Test Sinhala in status badges (ensure readable)
- Test Sinhala in navigation (bottom nav labels)

**Required resolution phase:** 01C
**Owner:** Design owner + linguistic reviewer
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-012: Complete responsive behavior annotations

**Debt ID:** DEBT-01B-012
**Phase:** 01B (carried to 01C)
**Category:** Responsive design
**Blocking:** Yes
**Status:** Open

**Description:** Add responsive behavior annotations to all screens per [RESPONSIVE_SCREEN_MATRIX.md](RESPONSIVE_SCREEN_MATRIX.md):
- Component reflow notes (single-column → two-column → sidebar)
- Navigation pattern changes (bottom nav → sidebar)
- Table → card list changes
- Modal → full-screen sheet changes

**Required resolution phase:** 01C
**Owner:** Design owner
**Target date:** Before Phase 01C exit
**Resolution notes:** (to be filled when resolved)

---

### DEBT-01B-013: Enforce contrast validation

**Debt ID:** DEBT-01B-013
**Phase:** 01B (carried to 01C)
**Category:** Accessibility
**Blocking:** Yes (ongoing enforcement during 01C screen build)
**Status:** In Progress (must enforce during 01C)

**Description:** Do not use warning `#B76E00` or gold `#C7A94B` as normal-sized text on backgrounds where [CONTRAST_VALIDATION.md](CONTRAST_VALIDATION.md) records a failure (WCAG 2.2 AA 4.5:1 for normal text).

**Required resolution phase:** 01C (enforce during screen build)
**Owner:** Design owner
**Target date:** Ongoing throughout Phase 01C
**Resolution notes:** (to be filled when resolved)

---

## Phase 01C new debt items

### DEBT-01C-001: Content translations not approved

**Debt ID:** DEBT-01C-001
**Phase:** 01C
**Category:** Content / Localization
**Blocking:** No (can build screens with proposed translations, linguistic review deferred)
**Status:** Open

**Description:** Proposed Sinhala translations in [SCREEN_CONTENT_MATRIX.md](SCREEN_CONTENT_MATRIX.md) are **PROPOSED** only, not approved. Linguistic review and domain-expert review required.

**Required resolution phase:** 01C or defer to Phase 02 (if owner approves)
**Owner:** Content owner + linguistic reviewer + domain expert
**Target date:** Before Phase 01C exit (or defer to Phase 02)
**Resolution notes:** (to be filled when resolved or deferred)

---

### DEBT-01C-002: Open design decisions not resolved

**Debt ID:** DEBT-01C-002
**Phase:** 01C
**Category:** Design decisions
**Blocking:** Partial (27 blocking, 40 non-blocking)
**Status:** Open

**Description:** 67 open design decisions documented in [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md) and [PHASE_01C_DECISIONS.md](PHASE_01C_DECISIONS.md). 27 are blocking (must resolve before 01C exit), 40 are non-blocking (can defer if approved).

**Required resolution phase:** 01C (blocking decisions), Phase 02+ (non-blocking, if deferred)
**Owner:** Project owner + stakeholders (IT, QA, security, product)
**Target date:** Before Phase 01C exit (blocking decisions)
**Resolution notes:** (to be filled when decisions resolved)

---

### DEBT-01C-003: Sample data not replaced with real data

**Debt ID:** DEBT-01C-003
**Phase:** 01C
**Category:** Content / Data
**Blocking:** No (sample data acceptable for design phase)
**Status:** Open

**Description:** All screens use **SAMPLE DATA** placeholders (EMP-XXXX, SAMPLE-BATCH, XX.X°C, etc.). Real Nelna operational values required for implementation.

**Required resolution phase:** Phase 02 (implementation)
**Owner:** Business owner + data owner
**Target date:** Before Phase 02 implementation
**Resolution notes:** Design phase uses sample data intentionally per project rules (no invented Nelna facts)

---

### DEBT-01C-004: Loading workflow screens (concept only)

**Debt ID:** DEBT-01C-004
**Phase:** 01C
**Category:** Screen completeness
**Blocking:** No (later phase scope)
**Status:** Open

**Description:** Loading workflow screens (LD-BLK, LD-*) are **concept only** in Phase 01C. Full loading inspection workflow deferred to later phase.

**Required resolution phase:** Phase 03 or later (per MVP scope)
**Owner:** Product owner
**Target date:** Deferred to post-MVP
**Resolution notes:** (to be filled when loading workflow scope confirmed)

---

### DEBT-01C-005: NC creation workflow (concept only)

**Debt ID:** DEBT-01C-005
**Phase:** 01C
**Category:** Screen completeness
**Blocking:** No (later phase scope)
**Status:** Open

**Description:** NC (Non-Conformance) creation screen (QA-NC) is **concept only** in Phase 01C. Full NC/CAPA workflow deferred to later phase.

**Required resolution phase:** Phase 03 or later (per MVP scope)
**Owner:** Product owner + QA owner
**Target date:** Deferred to post-MVP
**Resolution notes:** (to be filled when NC/CAPA workflow scope confirmed)

---

### DEBT-01C-006: Offline/sync workflow (concept only)

**Debt ID:** DEBT-01C-006
**Phase:** 01C
**Category:** Screen completeness
**Blocking:** No (MVP online-first)
**Status:** Open

**Description:** Offline/sync workflow screens (OP-SYNC, offline states) are **design concept only** in Phase 01C. MVP is online-first. Full offline capability deferred to later phase.

**Required resolution phase:** Phase 03 or later (per MVP scope)
**Owner:** Product owner + dev lead
**Target date:** Deferred to post-MVP
**Resolution notes:** MVP decision is online-first (block submit/mutate if offline)

---

### DEBT-01C-007: Management KPIs not defined

**Debt ID:** DEBT-01C-007
**Phase:** 01C
**Category:** Content / Business rules
**Blocking:** No (KPIs marked [PROPOSED])
**Status:** Open

**Description:** Management dashboard KPIs (MG-KPI) are **PROPOSED** only, not approved. Owner must define 4–6 actionable KPIs.

**Required resolution phase:** 01C or defer to Phase 02
**Owner:** Business owner / management stakeholder
**Target date:** Before Phase 01C exit (or defer if screen is concept-only)
**Resolution notes:** (to be filled when KPIs approved)

---

### DEBT-01C-008: Printable audit pack not designed

**Debt ID:** DEBT-01C-008
**Phase:** 01C
**Category:** Screen completeness
**Blocking:** No (later phase scope)
**Status:** Open

**Description:** Printable audit pack format (AU-PCK print/export) is **concept only** in Phase 01C. Print stylesheet and PDF export deferred to later phase.

**Required resolution phase:** Phase 03 or later
**Owner:** Product owner + auditor stakeholder
**Target date:** Deferred to post-MVP
**Resolution notes:** (to be filled when audit export scope confirmed)

---

## Debt summary table

| Debt ID | Description | Phase | Blocking | Status | Required phase | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| **Phase 01B conditions (carried to 01C)** |
| DEBT-01B-001 | Complete typography variables | 01B | No | Open | 01C | Design owner |
| DEBT-01B-002 | Complete spacing variables | 01B | No | Open | 01C | Design owner |
| DEBT-01B-003 | Complete radius variables | 01B | No | Open | 01C | Design owner |
| DEBT-01B-004 | Complete elevation variables | 01B | No | Open | 01C | Design owner |
| DEBT-01B-005 | Complete motion variables | 01B | No | Open | 01C | Design owner |
| DEBT-01B-006 | Complete component-dimension variables | 01B | No | Open | 01C | Design owner |
| DEBT-01B-007 | Convert to reusable component sets | 01B | No | Open | 01C | Design owner |
| DEBT-01B-008 | Keyboard navigation annotations | 01B | Yes | Open | 01C | Design + a11y |
| DEBT-01B-009 | Visible-focus annotations | 01B | Yes | Open | 01C | Design + a11y |
| DEBT-01B-010 | Screen-reader label annotations | 01B | Yes | Open | 01C | Design + a11y |
| DEBT-01B-011 | Sinhala wrapping tests | 01B | Yes | Open | 01C | Design + linguistic |
| DEBT-01B-012 | Responsive behavior annotations | 01B | Yes | Open | 01C | Design owner |
| DEBT-01B-013 | Enforce contrast validation | 01B | Yes | In Progress | 01C | Design owner |
| **Phase 01C new debt** |
| DEBT-01C-001 | Content translations not approved | 01C | No | Open | 01C or defer | Content owner |
| DEBT-01C-002 | Open design decisions (67 total) | 01C | Partial | Open | 01C (27 blocking) | Project owner |
| DEBT-01C-003 | Sample data placeholders | 01C | No | Open | Phase 02 | Business owner |
| DEBT-01C-004 | Loading workflow (concept) | 01C | No | Open | Phase 03+ | Product owner |
| DEBT-01C-005 | NC creation (concept) | 01C | No | Open | Phase 03+ | Product owner |
| DEBT-01C-006 | Offline/sync (concept) | 01C | No | Open | Phase 03+ | Product owner |
| DEBT-01C-007 | Management KPIs not defined | 01C | No | Open | 01C or defer | Business owner |
| DEBT-01C-008 | Printable audit pack (concept) | 01C | No | Open | Phase 03+ | Product owner |

**Total debt items:** 21 (+ tracked partial completions below)
**Blocking for Phase 02 technical foundation:** No — owner deferred Sinhala verification (2026-08-05)
**Still blocking:** Operator Sinhala UI final approval, operator UAT, pilot, production
**01C-R Figma progress (2026-08-05):** Required screen coverage expanded; component sets completed; P1–P7 hi-fi prototype clones wired; coverage matrix with node IDs. See [FIGMA_01C_COVERAGE_MATRIX.md](FIGMA_01C_COVERAGE_MATRIX.md) and [FIGMA_01C_IMPLEMENTATION_LOG.md](FIGMA_01C_IMPLEMENTATION_LOG.md).

### Status updates after 01C-R remediation (2026-08-05)

| Debt ID | Updated status | Notes |
| --- | --- | --- |
| DEBT-01B-001 Typography vars | Mostly complete | 30 Typography variables including weights/line-heights |
| DEBT-01B-007 Component sets | Mostly complete | Actions/forms/overlays/review/ops sets present; legacy singles remain |
| DEBT-01C-R-NOTO | **Open — deferred classification** | See 01C-D below; **not verified**, **not closed** |
| Screen inventory / prototypes | Mostly complete | Coverage matrix COMPLETE rows with node IDs; a11y representative only |

### 01C-F verification attempt (2026-08-05) — FAILED

Owner reported Noto Sans Sinhala applied via Figma Desktop. **Figma file evidence does not support closure:**

| Check | Result |
| --- | --- |
| Node `31:23` exists | Yes — still titled blocking / manual completion instructions |
| Representative text uses font family `Noto Sans Sinhala` | **No** — zero Noto Sans Sinhala text nodes on pages 04 / 06 / 99 |
| Interim Abhaya Libre `31:33` archived or non-production | **No** — still on Page 04 Design Tokens; all 8 Sinhala samples use Abhaya Libre |
| 360px / 430px wrapping examples | Partial 360 only in interim frame; no 430 Noto examples found |
| Owner review annotation of completion | **Not found** — frame still says “Do NOT mark Phase 01C complete until this is verified” |
| Archive page contains retired interim | **No** — Page 99 Archive empty |
| P1–P7 start nodes intact | Yes |

**DEBT-01C-R-NOTO was not closed by 01C-F.** Cloud file still lacked Noto evidence.

### 01C-D owner deferral (2026-08-05) — accepted risk

| Field | Entry |
| --- | --- |
| Decision | Phase 01C approved with deferred Sinhala typography condition |
| Owner | Chinthaka Jayaweera |
| Role | Project Owner / Developer |
| Debt ID | DEBT-01C-R-NOTO |
| Debt status | **OPEN** (do not delete; do not claim verified) |
| Non-blocking for Phase 02 technical foundation | Yes |
| Non-blocking for backend-only development | Yes |
| Blocking before final operator-facing Sinhala UI approval | Yes |
| Blocking before operator UAT | Yes |
| Blocking before pilot | Yes |
| Blocking before production release | Yes |
| Abhaya Libre production-approved? | **No** |
| Noto Sans Sinhala verified? | **No** |

**Status:** Phase 01C **Approved with deferred condition**. Phase 02 **Approved with conditions** (merged). Phase 03 accounts/RBAC **Approved with conditions** (merged via PR #7). Authentication UI polish **merged** via PR #8 without claiming Sinhala completion. Phase 04 remains hierarchy confirmation + Shift after ASM evidence — FG modules are Phase 05+. Operator UAT / pilot / production remain blocked until DEBT-01C-R-NOTO is closed with evidence.

### Phase 02 note on DEBT-01C-R-NOTO (2026-08-05)

| Field | Entry |
| --- | --- |
| Debt status | **Still OPEN** — not closed; not verified |
| Phase 02 CSS | May list `"Noto Sans Sinhala"` in the font **stack** only |
| Font binaries in repo | **None** |
| Verification claim | **Forbidden** until Figma/evidence closure |
| Docs | [FRONTEND_FOUNDATION.md](../frontend/FRONTEND_FOUNDATION.md) |

### Phase 03 note on DEBT-01C-R-NOTO (2026-08-06)

| Field | Entry |
| --- | --- |
| Debt status | **Still OPEN** |
| Phase 03 impact | Non-blocking for backend auth/RBAC and authentication UI polish; **blocking** for final Sinhala operator UI approval, UAT, pilot, production |
| Font binaries | **None** |
| Verification claim | **Forbidden** |

### Authentication UI polish note (2026-08-06)

| Field | Entry |
| --- | --- |
| Debt status | **Still OPEN** |
| UI polish | English foundation screens only; see [AUTHENTICATION_UI_POLISH.md](AUTHENTICATION_UI_POLISH.md) |
| Merge status | Merged via PR #8 |
| Validation | Local and Docker validation passed |
| GitHub Actions | Evidence unavailable during a GitHub Actions incident — **do not claim the missing CI check passed** |
| Sinhala UI claim | **Forbidden** |

### Phase 04 note on DEBT-01C-R-NOTO (2026-08-07)

| Field | Entry |
| --- | --- |
| Debt status | **Still OPEN** |
| Phase 04A impact | Non-blocking for configurable unseeded Shift technical foundation |
| Phase 04 impact | Non-blocking for hierarchy confirmation docs; **blocking** for final Sinhala operator UI, UAT, pilot, production |
| FG modules | Still Phase 05+ — not Phase 04 |

---

## Debt resolution process

1. **Identification:** Debt items identified during phase work or from approval conditions
2. **Documentation:** Debt recorded in this register with ID, description, blocking status, owner, target phase
3. **Prioritization:** Blocking debt must resolve before phase exit; non-blocking debt can defer (with approval)
4. **Resolution:** Owner resolves debt or explicitly defers to later phase
5. **Verification:** Reviewer verifies debt resolution
6. **Closure:** Debt status updated to Complete or Deferred

---

## Phase 01C exit criteria (debt)

Phase 01C cannot proceed to approval until:
- All **blocking debt** is resolved (6 items currently)
- All **non-blocking debt** is either resolved or explicitly deferred with owner approval
- Design debt register updated with resolution notes

---

## Next steps

1. Review debt register with design owner and stakeholders
2. Prioritize blocking debt resolution
3. Begin work on Phase 01B variable/component/a11y conditions
4. Resolve blocking design decisions (27 decisions)
5. Update debt register as items are resolved
6. Phase 01C approval only after blocking debt resolved

---

**Document status:** Draft pending owner review
**Approval required before:** Phase 01C exit
**Related approval form:** [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
