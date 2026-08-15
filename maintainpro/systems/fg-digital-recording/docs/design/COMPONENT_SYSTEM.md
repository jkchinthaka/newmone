# Component System — Phase 01B

**Document status:** Proposed component inventory and behaviour specs for Figma page 05  
**Phase:** 01B-R  
**Last updated:** 2026-08-04  
**Depends on:** [DESIGN_TOKENS.md](DESIGN_TOKENS.md), Phase 01A wireframes/journeys

**Detailed companions (do not treat as contradictory copies):**
- Full catalogue: [COMPONENT_CATALOGUE.md](COMPONENT_CATALOGUE.md)
- Anatomy/states: [COMPONENT_ANATOMY_AND_STATES.md](COMPONENT_ANATOMY_AND_STATES.md)
- Operator patterns: [OPERATOR_COMPONENT_PATTERNS.md](OPERATOR_COMPONENT_PATTERNS.md)
- Critical states: [CRITICAL_STATE_PATTERNS.md](CRITICAL_STATE_PATTERNS.md)
- Django handoff: [DESIGN_TO_DJANGO_HANDOFF.md](DESIGN_TO_DJANGO_HANDOFF.md)

Where this overview and the catalogue differ in depth, prefer the catalogue + anatomy docs. Colour usage must follow the **approved palette** in [DESIGN_SYSTEM_FOUNDATIONS.md](DESIGN_SYSTEM_FOUNDATIONS.md) (semantic roles only).

No Django/HTML implementation in this phase. Components are specified for Figma build and later Tailwind/template mapping. Do not invent checklist field content or Nelna limits.

Naming: `comp/[category]/[name]/[variant]` per [FIGMA_BUILD_SPECIFICATION.md](FIGMA_BUILD_SPECIFICATION.md).

---

## Foundations applied to all components

- Min touch target `size.touch.min` (48px); operator primaries `size.touch.operator` (56px)
- Visible focus ring using `sem.focus.ring`
- Status never colour-only (text + icon + optional pattern)
- Labels visible (not placeholder-only)
- Sinhala string growth: prefer hug/fill auto-layout; avoid fixed widths that clip
- Disabled states must remain perceivable (opacity + text cue)

---

## 1. Actions

### `comp/button/primary`

| Variant | Use |
| --- | --- |
| `default` / `pressed` / `disabled` / `loading` | Main CTA (Submit, Log in, Verify) |
| `operator` | Height 56px for floor flows |

Behaviour: one primary per view region. Loading replaces label with progress + accessible “Working…”.

### `comp/button/secondary`

Outlined/neutral for Cancel, Back, View record.

### `comp/button/danger`

Destructive or irreversible emphasis (Reject, Confirm hold). Always confirm in modal/sheet for irreversible QA decisions.

### `comp/button/ghost`

Low-emphasis text button (Forgot password?). Not for primary submit.

### `comp/icon-button`

48px hit area; accessible name required. Avoid icon-only for critical primary actions on operator flows.

---

## 2. Inputs

### `comp/field/text`, `comp/field/password`, `comp/field/employee-code`

Anatomy: label · input · hint · error. Height 48px. Password: show/hide control labeled.

### `comp/field/numeric`

Forces numeric keyboard intent; unit suffix slot (unit from template — [EVIDENCE REQUIRED], never invent limits).

### `comp/field/select`

Large options list for failure reasons; search optional later.

### `comp/field/textarea`

Only when evidenced as required; otherwise prefer select.

### `comp/control/pass-fail`

Segmented **Pass** / **Fail** — large targets; selected state uses text+icon+fill (not colour alone).

### `comp/control/checkbox`, `comp/control/radio`, `comp/control/switch`

48px hit; attestation uses checkbox + full statement text.

### `comp/control/stepper`

Optional for counts; ± buttons 48px.

---

## 3. Navigation

### `comp/nav/bottom-operator`

≤5 items; active = icon + label + weight; proposed destinations from IA (Home, Tasks, Scan?, Records, More).

### `comp/nav/side-desktop`

QA/Admin/Management/Auditor; section labels; Later items visually `ann/later`.

### `comp/nav/tabs`

Queue filters (All / Failures / Overdue).

### `comp/breadcrumb` (desktop)

Optional admin/audit only.

---

## 4. Feedback and status

### `comp/status/chip`

States: draft-local · waiting-sync · syncing · sync-failed · synchronized · submitted-server · returned · approved · verified · hold · critical · blocked  

Copy must follow [CONTENT_AND_LANGUAGE_GUIDE.md](CONTENT_AND_LANGUAGE_GUIDE.md). **Never** use “Submitted” for pre-ACK local states.

### `comp/banner/info|warn|critical|blocked`

Critical and LOADING BLOCKED use hatch/stripe patterns + icon + title + body + optional actions.

### `comp/alert/inline`

Field-adjacent errors.

### `comp/alert/summary`

Page-level error list with jump targets.

### `comp/toast` (sparingly)

Non-blocking confirmations only; not for critical failures.

### `comp/progress/linear` and `comp/progress/checklist`

Checklist progress “3/10” with text.

---

## 5. Lists and records

### `comp/list/task-row`

Title, due, status chip, chevron; row min height 56px operator.

### `comp/list/queue-row`

Failures-first visual: severity icon+label before title; age meta.

### `comp/card/kpi`

Management: value + label + trend affordance; max 4–6 on dashboard (DES-011).

### `comp/empty-state`

Title + plain explanation + optional CTA. No decorative illustration required.

### `comp/skeleton`

Loading placeholders matching layout.

---

## 6. Evidence

### `comp/evidence/thumbnail`

State: empty · uploading · attached · failed · sync-pending  

### `comp/evidence/capture-bar`

Capture photo / Choose file actions ≥48px.

### `comp/evidence/viewer`

Full image; close control; read-only for auditor.

---

## 7. Overlays

### `comp/modal/confirm`

Title, body, primary/secondary. Used for Verify / irreversible actions.

### `comp/sheet/bottom` (mobile)

Return reason, filters.

### `comp/drawer/admin` (desktop)

Create/edit user/template concepts.

---

## 8. Sync / connectivity

### `comp/connectivity/chip`

Online · Offline — working on this device

### `comp/sync/queue-item`

Maps Journey 6 states with honest labels.

---

## 9. Auth

### `comp/auth/login-form`

Employee code + password + primary Log in + generic error region.

### `comp/auth/locked-panel`, `comp/auth/session-expired`, `comp/auth/access-denied`

Static messaging panels; no enumeration.

---

## 10. Annotation (design-time only)

Retain 01A: `ann/note`, `ann/business-rule`, `ann/decision-required`, `ann/evidence-required`, `ann/assumption`, `ann/mvp`, `ann/later`.

---

## Component states matrix (required in Figma)

For interactive comps document: default · hover (desktop) · focus · pressed · disabled · loading · error · empty (where applicable).

---

## Accessibility checklist per component

- [ ] Name/role/value expressible
- [ ] Focus visible
- [ ] Contrast AA for text/icons on fills
- [ ] Touch target met
- [ ] Error associated with field
- [ ] Status has text equivalent

---

## Out of scope for 01B

- High-fidelity full screens (01C)
- Motion-heavy marketing components
- AI suggestion widgets
- Invented form field libraries beyond generic pass/fail/numeric/select/evidence
- Chart library beyond simple KPI card

---

## Open component decisions

| ID | Topic | Status |
| --- | --- | --- |
| CMP-001 | Include Scan in bottom nav component set | [DECISION REQUIRED] (DES-010) |
| CMP-002 | Soft vs hard delete patterns in admin | Later |
| CMP-003 | Signature capture component | [DECISION REQUIRED] if attestation needs drawn signature |
