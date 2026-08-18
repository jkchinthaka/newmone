# Design Acceptance Criteria — Phase 01C

**Document status:** Draft pending owner review — not approved  
**Phase:** 01C — High-fidelity MVP screens and prototype  
**Branch:** `design/figma-high-fidelity-mvp`  
**Created:** 2026-08-05  
**Last updated:** 2026-08-05

**Related documents:**
- [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md)
- [PROTOTYPE_FLOW_MAP.md](PROTOTYPE_FLOW_MAP.md)
- [RESPONSIVE_SCREEN_MATRIX.md](RESPONSIVE_SCREEN_MATRIX.md)
- [FIGMA_01C_IMPLEMENTATION_LOG.md](FIGMA_01C_IMPLEMENTATION_LOG.md)
- [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)

This document defines acceptance criteria for Phase 01C high-fidelity design deliverables. All criteria must be met before Phase 01C approval.

---

## Purpose

Phase 01C exit criteria ensure:
1. High-fidelity MVP screens are complete and consistent
2. Interactive prototypes are functional and testable
3. Responsive behavior is documented and demonstrated
4. Accessibility requirements are documented and annotated
5. Content uses sample data (not invented Nelna facts)
6. Phase 01B remaining conditions are complete
7. Open design decisions are resolved or documented
8. Design handoff for Django foundation is ready

---

## AC-01C-001: High-fidelity screen completeness

**Acceptance criteria:**

- [ ] **AC-01C-001.1:** All MVP screens defined in [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md) have high-fidelity frames in Figma at required breakpoints per [RESPONSIVE_SCREEN_MATRIX.md](RESPONSIVE_SCREEN_MATRIX.md)
- [ ] **AC-01C-001.2:** All screens use design tokens (color, typography, spacing, radius) from Phase 01B
- [ ] **AC-01C-001.3:** All screens use reusable components from Figma component library (buttons, inputs, cards, status indicators, etc.)
- [ ] **AC-01C-001.4:** All screens include key states: default, loading, empty, error, success (as applicable)
- [ ] **AC-01C-001.5:** All screens use **SAMPLE DATA** placeholders only (EMP-XXXX, SAMPLE-BATCH, XX.X°C, etc.) — no invented Nelna operational values as facts
- [ ] **AC-01C-001.6:** All screens include proposed Sinhala translations per [SCREEN_CONTENT_MATRIX.md](SCREEN_CONTENT_MATRIX.md) (marked PROPOSED, not approved)
- [ ] **AC-01C-001.7:** All failure/critical states use non-color-only indicators (icon + text + border/pattern)
- [ ] **AC-01C-001.8:** All status indicators follow [CRITICAL_STATE_PATTERNS.md](CRITICAL_STATE_PATTERNS.md) and [OPERATOR_COMPONENT_PATTERNS.md](OPERATOR_COMPONENT_PATTERNS.md)

**Verification method:** Visual review of Figma file + checklist against [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md)

**Owner:** Design owner / reviewer

**Status:** Not started

---

## AC-01C-002: Interactive prototype completeness

**Acceptance criteria:**

- [ ] **AC-01C-002.1:** All P1–P7 prototype flows defined in [PROTOTYPE_FLOW_MAP.md](PROTOTYPE_FLOW_MAP.md) are functional in Figma prototype mode
- [ ] **AC-01C-002.2:** All primary actions (buttons, links, tap targets) are linked to correct destination frames
- [ ] **AC-01C-002.3:** All conditional branches (pass/fail, approve/return) are functional
- [ ] **AC-01C-002.4:** Back navigation works (return to previous screen or close modal)
- [ ] **AC-01C-002.5:** Prototype index page (Page 12) links to all P1–P7 start frames
- [ ] **AC-01C-002.6:** No broken hotspots (all clickable areas navigate correctly)
- [ ] **AC-01C-002.7:** Sample data is consistent across prototype flows (same task IDs, batch numbers, etc. within a single flow)

**Verification method:** Manual testing of Figma prototypes in presentation mode

**Owner:** Design owner / reviewer

**Status:** Not started

---

## AC-01C-003: Responsive behavior

**Acceptance criteria:**

- [ ] **AC-01C-003.1:** All required breakpoints (360, 430, 768, 1024, 1440) have representative frames per [RESPONSIVE_SCREEN_MATRIX.md](RESPONSIVE_SCREEN_MATRIX.md)
- [ ] **AC-01C-003.2:** Mobile screens (360, 430) use single-column layouts and bottom navigation
- [ ] **AC-01C-003.3:** Tablet screens (768) use appropriate two-column or table layouts where applicable
- [ ] **AC-01C-003.4:** Desktop screens (1024, 1440) use sidebar navigation and multi-column layouts where applicable
- [ ] **AC-01C-003.5:** Responsive component behavior is documented (navigation, forms, tables, modals) per [RESPONSIVE_SCREEN_MATRIX.md](RESPONSIVE_SCREEN_MATRIX.md)
- [ ] **AC-01C-003.6:** Touch targets meet minimums: 48px general, 56px operator-critical actions

**Verification method:** Visual review at each breakpoint + measurement of touch targets

**Owner:** Design owner / reviewer

**Status:** Not started

---

## AC-01C-004: Accessibility annotations

**Acceptance criteria:**

- [ ] **AC-01C-004.1:** All screens have keyboard navigation annotations (tab order, focus indicators)
- [ ] **AC-01C-004.2:** All screens have visible focus indicator annotations (2px solid green ring per design tokens)
- [ ] **AC-01C-004.3:** All interactive elements have screen reader labels annotated (buttons, links, form inputs)
- [ ] **AC-01C-004.4:** All touch targets are measured and annotated (min 48px, min 56px for operator-critical)
- [ ] **AC-01C-004.5:** Operator screens have Sinhala text wrapping tests (long Sinhala words, multi-line labels)
- [ ] **AC-01C-004.6:** All status indicators have non-color-only patterns (icon + text + border)
- [ ] **AC-01C-004.7:** Color contrast meets WCAG 2.2 AA (4.5:1 normal text, 3:1 large text) per [CONTRAST_VALIDATION.md](CONTRAST_VALIDATION.md)
- [ ] **AC-01C-004.8:** Warning `#B76E00` and gold `#C7A94B` are NOT used as normal-sized text on backgrounds where contrast fails

**Verification method:** Accessibility annotation review in Figma + contrast validation per [CONTRAST_VALIDATION.md](CONTRAST_VALIDATION.md)

**Owner:** Design owner / reviewer + accessibility reviewer

**Status:** Not started

---

## AC-01C-005: Phase 01B remaining conditions

**Acceptance criteria:**

- [ ] **AC-01C-005.1:** All Figma variables complete: typography, spacing, radius, elevation, motion, component dimensions (per [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md))
- [ ] **AC-01C-005.2:** All core components converted to reusable Figma component sets with documented variants (Button, Input, Card, Status, Uploader, etc. per [COMPONENT_SYSTEM.md](COMPONENT_SYSTEM.md))
- [ ] **AC-01C-005.3:** All keyboard, visible-focus, screen-reader, Sinhala wrapping, and responsive annotations complete
- [ ] **AC-01C-005.4:** Contrast validation enforced (no warning/gold normal text on low-contrast backgrounds)
- [ ] **AC-01C-005.5:** Figma component library remains unpublished (draft only, not published before final design-system review)

**Verification method:** Review against Phase 01B conditions in [PHASE_01B_DESIGN_APPROVAL.md](../approvals/PHASE_01B_DESIGN_APPROVAL.md)

**Owner:** Design owner / reviewer

**Status:** Not started

---

## AC-01C-006: Sample data and no invented facts

**Acceptance criteria:**

- [ ] **AC-01C-006.1:** All screens use sample data placeholders: EMP-XXXX, TASK-XXXX, REC-XXXX, SAMPLE-BATCH, XX.X°C, Sample Site, Sample Checklist
- [ ] **AC-01C-006.2:** No real Nelna operational values (temperature limits, CCP/OPRP, sites, departments, shifts, products) are presented as facts
- [ ] **AC-01C-006.3:** All unresolved items are marked [ASSUMPTION], [DECISION REQUIRED], [OWNER REQUIRED], [EVIDENCE REQUIRED], or [PROPOSED]
- [ ] **AC-01C-006.4:** Proposed KPIs in management dashboard are clearly marked [PROPOSED]
- [ ] **AC-01C-006.5:** Proposed Sinhala translations are clearly marked PROPOSED in [SCREEN_CONTENT_MATRIX.md](SCREEN_CONTENT_MATRIX.md)

**Verification method:** Manual review of all Figma frames for invented data + review of documentation for [ASSUMPTION]/[DECISION]/[PROPOSED] tags

**Owner:** Design owner / reviewer + compliance reviewer

**Status:** Not started

---

## AC-01C-007: Open design decisions

**Acceptance criteria:**

- [ ] **AC-01C-007.1:** All 67 open decisions documented in [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md) are either resolved or documented in [PHASE_01C_DECISIONS.md](PHASE_01C_DECISIONS.md)
- [ ] **AC-01C-007.2:** Critical blocking decisions (security policy, scope model, approval workflows) are resolved or escalated to owner
- [ ] **AC-01C-007.3:** Non-blocking UX decisions are documented and deferred to implementation if appropriate
- [ ] **AC-01C-007.4:** All decisions have identified owner (business owner, IT owner, QA owner, etc.)

**Verification method:** Review decision register [PHASE_01C_DECISIONS.md](PHASE_01C_DECISIONS.md) against open decisions in [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md)

**Owner:** Project owner / business analyst

**Status:** Not started

---

## AC-01C-008: Content and translations

**Acceptance criteria:**

- [ ] **AC-01C-008.1:** All content keys mapped in [SCREEN_CONTENT_MATRIX.md](SCREEN_CONTENT_MATRIX.md) with English and proposed Sinhala
- [ ] **AC-01C-008.2:** Proposed Sinhala translations reviewed by linguistic expert (or review scheduled post-01C if approval allows)
- [ ] **AC-01C-008.3:** Food safety domain terms reviewed by domain expert (or review scheduled post-01C if approval allows)
- [ ] **AC-01C-008.4:** Content approval status updated in [SCREEN_CONTENT_MATRIX.md](SCREEN_CONTENT_MATRIX.md)
- [ ] **AC-01C-008.5:** Content matrix exportable to i18n format (Django i18n, JSON, or CSV) for future implementation

**Verification method:** Review content matrix + linguistic/domain review sign-off

**Owner:** Content owner / linguistic reviewer / domain expert

**Status:** Not started

---

## AC-01C-009: Design debt register

**Acceptance criteria:**

- [ ] **AC-01C-009.1:** All remaining Phase 01B conditions documented as design debt in [DESIGN_DEBT_REGISTER.md](DESIGN_DEBT_REGISTER.md)
- [ ] **AC-01C-009.2:** All known design gaps or deferred items documented as design debt
- [ ] **AC-01C-009.3:** Each debt item has: ID, description, blocking status, required resolution phase, owner
- [ ] **AC-01C-009.4:** Blocking debt items are resolved before Phase 01C approval
- [ ] **AC-01C-009.5:** Non-blocking debt items are tracked for future phases

**Verification method:** Review design debt register completeness

**Owner:** Design owner / project manager

**Status:** Not started

---

## AC-01C-010: Django foundation handoff readiness

**Acceptance criteria:**

- [ ] **AC-01C-010.1:** Django foundation screens identified in [DJANGO_FOUNDATION_DESIGN_HANDOFF.md](DJANGO_FOUNDATION_DESIGN_HANDOFF.md)
- [ ] **AC-01C-010.2:** All foundation screens (AUTH-LGN, OP-HOME, OP-TASKS, OP-TASK, OP-CHK core, OP-REV, OP-RES, SV-OVR, SV-QUE, SV-REV, QA-OVR, QA-QUE, QA-VER, AD-SHL, AD-USR) complete in Figma
- [ ] **AC-01C-010.3:** Foundation screens have detailed annotations for Django/HTMX implementation (partial-swap boundaries, form POST targets, validation error locations)
- [ ] **AC-01C-010.4:** Design tokens exported to CSS variables / Tailwind config format (or export process documented)
- [ ] **AC-01C-010.5:** Component specifications documented for Django template implementation

**Verification method:** Review handoff document + foundation screen completeness

**Owner:** Design owner / Django developer lead

**Status:** Not started

---

## AC-01C-011: Documentation completeness

**Acceptance criteria:**

- [ ] **AC-01C-011.1:** [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md) complete and reviewed
- [ ] **AC-01C-011.2:** [PROTOTYPE_FLOW_MAP.md](PROTOTYPE_FLOW_MAP.md) complete and reviewed
- [ ] **AC-01C-011.3:** [RESPONSIVE_SCREEN_MATRIX.md](RESPONSIVE_SCREEN_MATRIX.md) complete and reviewed
- [ ] **AC-01C-011.4:** [SCREEN_CONTENT_MATRIX.md](SCREEN_CONTENT_MATRIX.md) complete and reviewed
- [ ] **AC-01C-011.5:** [FIGMA_01C_IMPLEMENTATION_LOG.md](FIGMA_01C_IMPLEMENTATION_LOG.md) updated with actual build progress
- [ ] **AC-01C-011.6:** [DESIGN_ACCEPTANCE_CRITERIA_01C.md](DESIGN_ACCEPTANCE_CRITERIA_01C.md) (this document) reviewed
- [ ] **AC-01C-011.7:** [PHASE_01C_DECISIONS.md](PHASE_01C_DECISIONS.md) complete and reviewed
- [ ] **AC-01C-011.8:** [DESIGN_DEBT_REGISTER.md](DESIGN_DEBT_REGISTER.md) complete and reviewed
- [ ] **AC-01C-011.9:** [DJANGO_FOUNDATION_DESIGN_HANDOFF.md](DJANGO_FOUNDATION_DESIGN_HANDOFF.md) complete and reviewed
- [ ] **AC-01C-011.10:** [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md) ready for owner sign-off

**Verification method:** Documentation review checklist

**Owner:** Project owner / documentation reviewer

**Status:** Not started

---

## AC-01C-012: Phase 01C approval readiness

**Acceptance criteria:**

- [ ] **AC-01C-012.1:** All above acceptance criteria (AC-01C-001 through AC-01C-011) are met
- [ ] **AC-01C-012.2:** Phase 01C approval form [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md) reviewed and signed by owner
- [ ] **AC-01C-012.3:** All blocking design decisions resolved
- [ ] **AC-01C-012.4:** All blocking design debt resolved
- [ ] **AC-01C-012.5:** Django foundation handoff screens ready for Phase 02 kickoff
- [ ] **AC-01C-012.6:** PR created for `design/figma-high-fidelity-mvp` → `main` merge
- [ ] **AC-01C-012.7:** PR reviewed and approved (manual review required before merge)

**Verification method:** Phase 01C approval form sign-off + PR review

**Owner:** Project owner

**Status:** Not started

---

## Summary checklist

| Acceptance Criteria | Status | Blocker | Owner |
| --- | --- | --- | --- |
| AC-01C-001: Hi-fi screen completeness | Not started | Yes | Design owner |
| AC-01C-002: Prototype completeness | Not started | Yes | Design owner |
| AC-01C-003: Responsive behavior | Not started | Yes | Design owner |
| AC-01C-004: Accessibility annotations | Not started | Yes | Design owner + a11y reviewer |
| AC-01C-005: Phase 01B conditions | Not started | Yes | Design owner |
| AC-01C-006: Sample data / no invented facts | Not started | Yes | Design owner + compliance |
| AC-01C-007: Open design decisions | Not started | Partial | Project owner |
| AC-01C-008: Content and translations | Not started | No (can defer review) | Content owner |
| AC-01C-009: Design debt register | Not started | No | Design owner |
| AC-01C-010: Django handoff readiness | Not started | Yes | Design owner + dev lead |
| AC-01C-011: Documentation completeness | Not started | Yes | Project owner |
| AC-01C-012: Phase 01C approval readiness | Not started | Yes | Project owner |

**Total criteria:** 12 major acceptance criteria groups  
**Blockers:** 9 of 12 are blocking (must resolve before approval)  
**Status:** 0 of 12 complete (0%)

---

## Acceptance testing process

1. **Self-review:** Design owner reviews all criteria against Figma file and documentation
2. **Peer review:** Peer reviewer (if available) reviews design + documentation
3. **Accessibility review:** Accessibility reviewer validates a11y annotations and contrast
4. **Content review:** Linguistic and domain experts review proposed Sinhala translations and food safety terms
5. **Owner review:** Project owner reviews all deliverables and signs approval form
6. **PR review:** Manual PR review before merge to `main`

---

## Approval gates

Phase 01C cannot proceed to approval until:
- All blocking acceptance criteria are met
- All blocking design decisions are resolved
- All blocking design debt is resolved
- Django foundation handoff screens are ready
- Owner signs [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)

---

## Next steps

1. Begin Figma high-fidelity screen build per [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md)
2. Track progress in [FIGMA_01C_IMPLEMENTATION_LOG.md](FIGMA_01C_IMPLEMENTATION_LOG.md)
3. Resolve open design decisions (67 decisions in [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md))
4. Complete Phase 01B remaining conditions
5. Build interactive prototypes (P1–P7)
6. Add accessibility annotations
7. Review against acceptance criteria (this document)
8. Owner approval sign-off

---

**Document status:** Draft pending owner review  
**Approval required before:** Phase 01C exit  
**Related approval form:** [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
