# Django Foundation Design Handoff

**Document status:** Phase 01C approved with deferred Sinhala condition — Phase 02 foundation authorized after PR #4 merge  
**Phase:** 01C → 02 handoff  
**Branch:** `design/figma-high-fidelity-mvp`  
**Created:** 2026-08-05  
**Last updated:** 2026-08-05

**Related documents:**
- [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md)
- [DESIGN_TO_DJANGO_HANDOFF.md](DESIGN_TO_DJANGO_HANDOFF.md) (Phase 01A baseline)
- [DESIGN_TOKENS.md](DESIGN_TOKENS.md)
- [COMPONENT_SYSTEM.md](COMPONENT_SYSTEM.md)
- [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
- [DESIGN_DEBT_REGISTER.md](DESIGN_DEBT_REGISTER.md)

## Phase 02 authorization (01C-D)

| Item | Status |
| --- | --- |
| Phase 01C | Approved with deferred Sinhala typography condition (2026-08-05) |
| Phase 02 start | Authorized after PR #4 merge — **technical foundation only** |
| Scope allowed | Django/PostgreSQL/platform foundation, backend-only work |
| DEBT-01C-R-NOTO | **OPEN** — non-blocking for foundation; blocking for operator Sinhala UAT/pilot/production |
| Noto Sans Sinhala verified | **No** |
| Abhaya Libre production-approved | **No** |
| Operator UAT / pilot / production | **Blocked** until Noto debt closed with evidence |
| Figma library published | **No** |
| Application code started | **Not yet** |

This document specifies which high-fidelity screens are the design reference for Phase 02 Django foundation implementation.

---

## Purpose

Phase 02 Django foundation implementation cannot begin until:
1. Required foundation screens are complete in Figma (high-fidelity)
2. Foundation screens are reviewed and approved
3. Design tokens are exported or export-ready
4. Component specifications are documented for Django templates
5. Django/HTMX implementation notes are annotated

This document defines which screens are **foundation screens** (required before Phase 02 start) vs. **non-foundation screens** (can be built in parallel or later).

---

## Foundation vs. Non-foundation screens

| Category | Definition |
| --- | --- |
| **Foundation screens** | Core screens required for Phase 02 MVP foundation. Implementation blocked until these are designed and approved. |
| **Non-foundation screens** | Screens that can be designed in parallel with Phase 02 implementation, or deferred to later phases. |

---

## Foundation screens (required before Phase 02 start)

### Authentication foundation (AUTH)

| Screen ID | Screen name | Breakpoint | Foundation | Status |
| --- | --- | --- | --- | --- |
| AUTH-LGN | Login | 360px | ✅ Yes | Not started |
| AUTH-FPC | Forced password change | 360px | ✅ Yes | Not started |
| AUTH-DEN | Access denied | 360px | ✅ Yes | Not started |
| AUTH-EXP | Session expired | 360px | ✅ Yes | Not started |

**Rationale:** Authentication is the entry point for all users. Phase 02 Django foundation requires login, session management, and basic auth error states.

**Implementation notes:**
- Django auth backend (`django.contrib.auth`)
- Login view: POST to `/auth/login/` → session cookie → redirect to persona home
- Password change view: POST to `/auth/password-change/` → validation → redirect
- Session middleware: timeout enforcement, session-expired redirect
- Access denied: 403 Forbidden view
- CSRF protection on all forms

---

### Operator foundation (OP)

| Screen ID | Screen name | Breakpoint | Foundation | Status |
| --- | --- | --- | --- | --- |
| OP-HOME | Operator home | 360px | ✅ Yes | Not started |
| OP-TASKS | Task list | 360px | ✅ Yes | Not started |
| OP-TASK | Task detail | 360px | ✅ Yes | Not started |
| OP-CHK | Checklist (core flow) | 360px | ✅ Yes | Not started |
| OP-FAIL | Failure details | 360px | 🔶 Partial | Not started |
| OP-EVD | Evidence capture | 360px | 🔶 Partial | Not started |
| OP-REV | Review before submit | 360px | ✅ Yes | Not started |
| OP-RES | Submission result | 360px | ✅ Yes | Not started |

**Foundation scope:** OP-HOME, OP-TASKS, OP-TASK, OP-CHK (pass/fail only), OP-REV, OP-RES (success/failure)

**Partial/deferred:** OP-FAIL (basic failure capture in Phase 02, full evidence in Phase 03), OP-EVD (defer to Phase 03 if evidence upload complex)

**Rationale:** Operator workflow is the core MVP recording flow. Phase 02 foundation must support task assignment, checklist completion (basic pass/fail), review, and submit.

**Implementation notes:**
- Django views: `OperatorHomeView`, `TaskListView`, `TaskDetailView`, `ChecklistView`, `ReviewView`, `SubmitView`
- HTMX partial swaps: checklist item-by-item navigation (POST → partial HTML response → swap)
- Template engine: Dynamic checklist rendering per template definition (item types: pass/fail, yes/no, numeric)
- Validation: Server-side validation on submit (completeness, required fields)
- Immutable record creation on submit (no in-place edit after submit)
- Success confirmation with record ID
- Error handling: validation errors inline, submission failure with retry

---

### Supervisor foundation (SV)

| Screen ID | Screen name | Breakpoint | Foundation | Status |
| --- | --- | --- | --- | --- |
| SV-OVR | Supervisor overview | 768px | ✅ Yes | Not started |
| SV-QUE | Review queue | 768px | ✅ Yes | Not started |
| SV-REV | Record review | 768px | ✅ Yes | Not started |
| SV-RET | Return for correction | 768px | 🔶 Partial | Not started |

**Foundation scope:** SV-OVR, SV-QUE, SV-REV (approve only)

**Partial/deferred:** SV-RET (basic return-for-correction in Phase 02, notification mechanism in Phase 03)

**Rationale:** Supervisor review and approval is required for QA verification flow. Phase 02 foundation must support approval (minimum); return-for-correction can be basic.

**Implementation notes:**
- Django views: `SupervisorOverviewView`, `ReviewQueueView`, `RecordReviewView`, `ApproveView`, `ReturnView`
- HTMX partial swaps: queue list refresh, record detail load
- Authorization: Supervisor role + scope (site/dept/team filter)
- Separation-of-duty: Cannot approve own records (server-side check)
- Approval POST → immutable supervisor-approved record → return to queue
- Return POST → reason required → record status updated → operator notification (basic: in-app flag, email deferred)

---

### QA foundation (QA)

| Screen ID | Screen name | Breakpoint | Foundation | Status |
| --- | --- | --- | --- | --- |
| QA-OVR | QA overview | 1024px | ✅ Yes | Not started |
| QA-QUE | Verification queue | 1024px | ✅ Yes | Not started |
| QA-VER | Record verification | 1024px | ✅ Yes | Not started |

**Foundation scope:** QA-OVR, QA-QUE, QA-VER (verify only)

**Deferred:** QA-HLD (hold/reject/reinspect), QA-NC (NC creation) — defer to Phase 03

**Rationale:** QA verification closes the approval chain. Phase 02 foundation must support verification (minimum); hold/reject/NC deferred to later phase.

**Implementation notes:**
- Django views: `QAOverviewView`, `VerificationQueueView`, `RecordVerificationView`, `VerifyView`
- HTMX partial swaps: queue list refresh, record detail load
- Authorization: QA role + scope
- Separation-of-duty: Cannot verify own-operated or own-supervised records (server-side check)
- Verification POST → immutable QA-verified record → return to queue
- Full approval chain visible (operator → supervisor → QA)
- Audit timeline visible (submission, approval, verification timestamps)

---

### Administration foundation (AD)

| Screen ID | Screen name | Breakpoint | Foundation | Status |
| --- | --- | --- | --- | --- |
| AD-SHL | Admin shell | 1024px | ✅ Yes | Not started |
| AD-USR | User management | 1024px | ✅ Yes | Not started |

**Foundation scope:** AD-SHL (nav), AD-USR (basic user CRUD)

**Deferred:** AD-ROL (roles/scope), AD-ORG (org hierarchy) — Phase 03

**Rationale:** User management is required for MVP user onboarding. Roles/scope and org hierarchy can use simplified defaults in Phase 02, detailed management in Phase 03.

**Implementation notes:**
- Django admin customization or custom admin views
- User CRUD: Create, Read, Update (deactivate, not delete), Unlock
- Role assignment: Predefined roles (Operator, Supervisor, QA, Admin) in Phase 02
- Scope assignment: Simplified scope (e.g., site-level only) in Phase 02, detailed hierarchy in Phase 03
- Audit logging: All admin actions logged

---

## Non-foundation screens (can be designed in parallel or deferred)

| Screen ID | Screen name | Phase |
| --- | --- | --- |
| AUTH-RST | Password reset request | Phase 02 or 03 |
| AUTH-LCK | Account locked | Phase 02 or 03 |
| OP-REC | Own record detail (read-only) | Phase 02 or 03 |
| OP-SYNC | Sync status (offline concept) | Phase 03+ |
| OP-MORE | More / profile | Phase 02 or 03 |
| SV-TEAM | Team task view | Phase 03+ |
| SV-ALT | Alerts | Phase 03+ |
| QA-HLD | Hold/reject/reinspection | Phase 03+ |
| QA-NC | NC creation | Phase 03+ |
| LD-* | Loading workflow | Phase 03+ |
| AD-ROL | Roles and scope (detailed) | Phase 03+ |
| AD-ORG | Organization hierarchy | Phase 03+ |
| MG-* | Management dashboards | Phase 03+ |
| AU-* | Auditor screens | Phase 03+ |

**Rationale:** These screens are not on the critical path for MVP foundation. They can be designed while Phase 02 foundation work proceeds, or deferred to later phases.

---

## Design token export

**Required before Phase 02 start:**

### Export format

1. **CSS custom properties** (preferred for Django templates):
   - Export color, typography, spacing, radius tokens as CSS variables
   - Include light-mode only (no dark mode in MVP)
   - Example: `:root { --color-primary: #216E39; --font-size-body: 16px; --spacing-4: 16px; }`

2. **Tailwind CSS config** (alternative or complementary):
   - Export tokens as Tailwind theme extensions
   - Example: `theme: { extend: { colors: { primary: '#216E39' }, spacing: { '4': '16px' } } }`

3. **JSON artifact** (already exists):
   - `design/tokens/nelna-fg.tokens.json` (machine-readable)

**Export process:** Manual export from Figma variables or automated export plugin (Figma Tokens, Style Dictionary, etc.)

**Owner:** Design owner + dev lead

**Target:** Before Phase 02 start

---

## Component specification export

**Required before Phase 02 start:**

### Component documentation

For each foundation component (Button, Input, Card, Status, etc.), document:

1. **Component name** (e.g., Button)
2. **Variants** (e.g., primary, secondary, tertiary, critical)
3. **States** (e.g., default, hover, active, disabled, loading)
4. **Props/attributes** (e.g., size: 48px / 56px, label, icon, loading)
5. **Token usage** (e.g., bg: `--color-primary`, text: `--color-text-inverse`)
6. **HTML structure** (e.g., `<button class="btn btn-primary">Label</button>`)
7. **Django template snippet** (e.g., `{% include 'components/button.html' with variant='primary' label='Submit' %}`)

**Format:** Markdown table or JSON per [COMPONENT_SYSTEM.md](COMPONENT_SYSTEM.md)

**Owner:** Design owner + dev lead

**Target:** Before Phase 02 start

---

## Django/HTMX implementation annotations

**Required on foundation screens:**

### Annotation types

1. **Partial-swap boundaries:** Annotate which sections of each screen are HTMX partial-swap targets
   - Example: Checklist item section swaps on "Next" button click
   - Example: Task list section swaps on filter toggle

2. **Form POST targets:** Annotate form action URLs and expected response
   - Example: Login form POSTs to `/auth/login/` → success: redirect to home; error: inline validation errors

3. **Validation error locations:** Annotate where validation errors display
   - Example: Inline below input field; summary at form top

4. **Loading states:** Annotate where loading indicators display during async actions
   - Example: Submit button shows spinner + "Submitting..." text

5. **Success/error feedback:** Annotate where toast notifications or confirmation messages display
   - Example: Toast at top-right; auto-dismiss after 3 seconds

**Format:** Figma annotations (text layers, notes, or separate annotation page)

**Owner:** Design owner + dev lead

**Target:** Before Phase 02 start

---

## Handoff checklist

Before Phase 02 Django foundation implementation can begin:

- [ ] All foundation screens (AUTH-LGN, AUTH-FPC, AUTH-DEN, AUTH-EXP, OP-HOME, OP-TASKS, OP-TASK, OP-CHK, OP-REV, OP-RES, SV-OVR, SV-QUE, SV-REV, QA-OVR, QA-QUE, QA-VER, AD-SHL, AD-USR) complete in Figma
- [ ] All foundation screens reviewed and approved per [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
- [ ] Design tokens exported to CSS custom properties or Tailwind config
- [ ] Component specifications documented for Django template implementation
- [ ] Django/HTMX implementation annotations added to foundation screens
- [ ] Figma file shared with dev team (read access or export)
- [ ] Handoff meeting scheduled (design walkthrough with dev team)

---

## Handoff artifacts

**Delivered to dev team:**

1. Figma file URL: https://www.figma.com/design/jnn8Xhsg1zFEHxYShCUb4M (read access)
2. Design token export (CSS variables or Tailwind config)
3. Component specification document (Markdown or JSON)
4. Foundation screen list (this document)
5. High-fidelity screen spec ([HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md))
6. Content matrix ([SCREEN_CONTENT_MATRIX.md](SCREEN_CONTENT_MATRIX.md)) for i18n setup
7. Responsive screen matrix ([RESPONSIVE_SCREEN_MATRIX.md](RESPONSIVE_SCREEN_MATRIX.md)) for breakpoint reference

---

## Phase 02 implementation guidance

### Django app structure (proposed)

- `apps/auth/` — Authentication views, models, policies
- `apps/operator/` — Operator views, task/checklist models, services
- `apps/supervisor/` — Supervisor views, review/approval services
- `apps/qa/` — QA views, verification services
- `apps/admin/` — Admin views, user management
- `apps/core/` — Shared models, utilities, base templates
- `apps/shared/` — Shared components (buttons, inputs, cards, status)

### Template structure (proposed)

- `templates/base.html` — Base layout (head, nav, footer, scripts)
- `templates/components/` — Reusable component templates (button, input, card, etc.)
- `templates/auth/` — Auth screen templates (login, password-change, etc.)
- `templates/operator/` — Operator screen templates (home, tasks, checklist, etc.)
- `templates/supervisor/` — Supervisor screen templates (overview, queue, review, etc.)
- `templates/qa/` — QA screen templates (overview, queue, verification, etc.)
- `templates/admin/` — Admin screen templates (user list, user detail, etc.)

### HTMX integration (proposed)

- HTMX included in base template (`<script src="https://unpkg.com/htmx.org@..."></script>`)
- Partial-swap responses: Django views return partial HTML (no full page reload)
- Example: Checklist next-item POST returns only new item HTML, HTMX swaps into target `div`
- Use `hx-post`, `hx-target`, `hx-swap` attributes per Figma annotations

### Tailwind CSS integration (proposed)

- Tailwind CSS included in base template (via CDN or build step)
- Design tokens mapped to Tailwind config (`tailwind.config.js`)
- Use Tailwind utility classes in templates (e.g., `bg-primary`, `text-neutral-900`, `p-4`)

---

## Phase 02 implementation scope (summary)

**Phase 02 foundation includes:**
- Authentication (login, session, password change, access denied, session expired)
- Operator core workflow (home, tasks, checklist pass/fail, review, submit)
- Supervisor review and approve (overview, queue, review, approve)
- QA verification (overview, queue, verification, verify)
- Admin user management (basic CRUD)
- Design system foundation (tokens, components, base templates)
- HTMX partial swaps (checklist navigation, queue refresh, form submission)
- Immutable record creation (operator submit, supervisor approve, QA verify)
- Audit logging (submission, approval, verification events)

**Phase 02 foundation does NOT include:**
- Offline capability (online-first MVP)
- Evidence upload (defer to Phase 03 if complex)
- Failure detail capture (basic in Phase 02, full in Phase 03)
- Return-for-correction notification (basic in Phase 02, email/SMS in Phase 03)
- Hold/reject/reinspect/NC workflows (defer to Phase 03)
- Loading inspection workflow (defer to Phase 03)
- Management dashboards (defer to Phase 03)
- Auditor screens (defer to Phase 03)
- Detailed roles/scope management (simplified in Phase 02, detailed in Phase 03)
- Organization hierarchy (simplified in Phase 02, detailed in Phase 03)

---

## Next steps

1. Complete foundation screens in Figma per [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md)
2. Review and approve Phase 01C per [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
3. Export design tokens (CSS variables or Tailwind config)
4. Document component specifications for Django templates
5. Annotate foundation screens with Django/HTMX implementation notes
6. Handoff meeting with dev team (design walkthrough)
7. Phase 02 Django foundation implementation kickoff

---

**Document status:** Draft pending owner review  
**Approval required before:** Phase 02 implementation start  
**Related approval form:** [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
