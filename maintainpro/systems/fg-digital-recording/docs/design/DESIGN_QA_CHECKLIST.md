# Design QA Checklist

**Document Status:** Proposed  
**Approval Status:** Pending design review  
**Last Updated:** 2026-08-04  
**Cross-references:** FIGMA_COMPONENT_BUILD_GUIDE.md, ACCESSIBILITY_AND_USABILITY.md, COMPONENT_CATALOGUE.md

## Purpose

This checklist ensures design quality, consistency, accessibility, and completeness before handoff to development. Use this checklist for:

- **Design review:** Before presenting to stakeholders
- **Self-QA:** Designer reviews own work
- **Peer review:** Another designer reviews work
- **Pre-handoff:** Before sharing with development team

**Important:** All items must be checked or explicitly marked "N/A" with reason before design approval.

---

## Design Tokens & Variables

### Colour

- [ ] All primitive colors defined with hex values in Figma variables
- [ ] All semantic colors defined as references to primitives (not hard-coded hex)
- [ ] No hard-coded hex colors in components (all use variables)
- [ ] Semantic color names are purpose-based (not appearance-based) - e.g., `action/primary` not `green`
- [ ] Light mode only (no dark mode variables in initial scope)
- [ ] Warning color (#B76E00) is flagged as NOT AA compliant for normal body text
- [ ] All color variables are documented in FIGMA_VARIABLES_SPEC.md

### Typography

- [ ] Font families defined: Inter (English), Noto Sans Sinhala (Sinhala)
- [ ] Font size scale consistent (10, 12, 14, 16, 18, 20, 24, 32)
- [ ] Font weights defined (400, 500, 600, 700)
- [ ] Line heights defined (1.2, 1.5, 1.75)
- [ ] Text styles created for common uses (Heading, Body, Button, Caption, Badge)
- [ ] Text styles use variables (not hard-coded values)
- [ ] Sinhala text tested for wrapping and line height

### Spacing & Sizing

- [ ] Spacing scale consistent (2, 4, 8, 12, 16, 20, 24, 32, 48)
- [ ] Touch target minimums met: 48px general, 56px operator, 64px operator-large
- [ ] Icon sizes consistent (16, 20, 24, 32)
- [ ] Input heights: 48px default, 56px operator
- [ ] Button heights: 48px default, 56px operator
- [ ] All spacing and sizing use variables

### Radius, Borders, Elevation

- [ ] Border radius values defined (4, 8, 12, 16, 999)
- [ ] Border widths defined (1, 2, 4)
- [ ] Elevation levels defined (subtle, low, medium, high, extreme) as effect styles
- [ ] All components use variables for radius, borders, elevation

---

## Component Consistency

### Auto Layout

- [ ] All components use auto layout (no absolute positioning unless necessary)
- [ ] Auto layout direction set correctly (horizontal or vertical)
- [ ] Padding, gap, and alignment set using variables
- [ ] Sizing set correctly (hug contents or fill container)
- [ ] Components resize correctly when content changes

### Variants

- [ ] All component states have variants (default, hover, focus, pressed, disabled, error, etc.)
- [ ] Variant properties named clearly (state, size, type, etc.)
- [ ] Variants organized in logical grid
- [ ] No missing variants (e.g., focus state missing)
- [ ] Variants tested by switching property values

### Component Properties

- [ ] Text properties for all text content (label, hint, error message)
- [ ] Boolean properties for show/hide (icon, badge, etc.)
- [ ] Instance swap properties for nested components (icon choice, etc.)
- [ ] Properties named clearly and consistently
- [ ] Default property values set appropriately

### Naming

- [ ] Components named consistently: comp/[category]/[component-name]
- [ ] Layers named clearly (not "Rectangle 1", "Frame 2")
- [ ] Groups and frames named logically
- [ ] No orphan components (all components organized in pages)

### Reuse

- [ ] No duplicate components (same component in multiple places)
- [ ] Components use instances (not duplicates)
- [ ] Nested components used where appropriate (button inside modal, etc.)
- [ ] Symbols/components published to library (if team library)

---

## Accessibility

### Colour Contrast

- [ ] All text/background combinations tested with contrast checker (Stark plugin or similar)
- [ ] Body text ≥ 4.5:1 contrast ratio (WCAG AA)
- [ ] Large text ≥ 3:1 contrast ratio (WCAG AA)
- [ ] Warning color (#B76E00) flagged as NOT AA for body text; only used for large text or badges
- [ ] Non-color indicators used for status (icons, text, not color alone)
- [ ] Contrast ratios noted in annotations on Page 12 (Accessibility Annotations)

### Touch Targets

- [ ] All interactive elements ≥ 48px touch target (WCAG AAA)
- [ ] Operator-facing controls ≥ 56px touch target (proposed)
- [ ] Critical operator actions ≥ 56-64px touch target (Pass/Fail control, Submit button)
- [ ] Touch targets measured and annotated on Page 12
- [ ] Spacing between adjacent touch targets ≥ 8px (preferably 12-16px)

### Focus States

- [ ] All interactive elements have visible focus state
- [ ] Focus ring 2px, primary color, 2px offset (or equivalent visible indicator)
- [ ] Focus states annotated on Page 12
- [ ] Focus order logical (top to bottom, left to right)
- [ ] No focus traps (unless modal/dialog)

### ARIA & Semantics

- [ ] Icon-only buttons have aria-label annotations
- [ ] Form fields have label associations noted (for attribute or aria-labelledby)
- [ ] Error messages have aria-describedby associations noted
- [ ] Invalid fields have aria-invalid="true" noted
- [ ] Modals/dialogs have role="dialog" and aria-modal="true" noted
- [ ] Tabs have role="tablist", role="tab", role="tabpanel" noted
- [ ] Status changes have aria-live or role="alert" noted
- [ ] All ARIA requirements annotated on Page 12

### Keyboard Navigation

- [ ] Keyboard navigation order numbered on Page 12 (1, 2, 3, ...)
- [ ] All interactive elements keyboard accessible (Tab, Enter, Space, Arrow keys)
- [ ] Keyboard shortcuts documented (if applicable)
- [ ] No keyboard traps (unless intentional in modal/dialog with Escape exit)

### Screen Reader

- [ ] Screen reader announcements noted in annotations
- [ ] Status changes announced (e.g., "Error. Submission failed.")
- [ ] Loading states announced (aria-busy="true")
- [ ] Dynamic content changes announced (aria-live regions)

---

## Content & Language

### Bilingual Support (Sinhala + English)

- [ ] Operator-facing components have Sinhala labels (primary) and English (secondary or omitted if space limited)
- [ ] Supervisory components have English labels
- [ ] Sinhala text uses Noto Sans Sinhala font
- [ ] Sinhala text tested for wrapping, line height, and overflow
- [ ] No hardcoded English-only labels in operator components
- [ ] Placeholder text for both languages (or clearly labeled as placeholder)

### Clarity & Tone

- [ ] Button labels are action verbs + nouns (e.g., "Submit Form", "Add Photo")
- [ ] Error messages are clear and actionable (not "Error 500", but "Submission failed. Please retry.")
- [ ] No jargon or technical terms in operator-facing content
- [ ] Status badges use clear labels ("Pass", "Fail", "Pending Review", not "0x01", "Status A")
- [ ] Empty states have helpful guidance (not just "No data")

### No Invented Data

- [ ] No invented temperature limits, sites, products, or operational data in components
- [ ] Placeholder text clearly marked as "[PLACEHOLDER]" or "Example: [range — EVIDENCE REQUIRED]" (not as fact)
- [ ] All business data marked as "EVIDENCE REQUIRED" or "DECISION REQUIRED" if not confirmed
- [ ] No compliance claims without evidence (e.g., "HACCP compliant" without approval)

### Consistency

- [ ] Button labels consistent across screens (e.g., "Submit" not "Send" in one place and "Submit" in another)
- [ ] Status badge labels consistent (e.g., "In Progress" not "In Progress" in one place and "WIP" in another)
- [ ] Terminology consistent with project documentation and stakeholder language
- [ ] Microcopy reviewed for consistency (e.g., "Log In" vs "Sign In")

---

## Responsive Design

### Breakpoints

- [ ] Mobile layouts designed for 360px, 390px, 430px (small, medium, large phones)
- [ ] Tablet layout designed for 768px (iPad portrait)
- [ ] Desktop layout designed for 1280px, 1920px
- [ ] Key screens demonstrated at all breakpoints on Page 11 (Responsive Breakpoints)

### Layout Changes

- [ ] Mobile (< 768px): Bottom nav, single column, full width buttons, stacked layout
- [ ] Tablet (≥ 768px): Desktop sidebar appears, multi-column layout begins, buttons auto-width
- [ ] Desktop (≥ 1280px): Full multi-column, wider content area, side panels visible
- [ ] Layout changes annotated on Page 11

### Component Behavior

- [ ] Components adapt correctly at breakpoints (no broken layouts)
- [ ] Text wraps correctly (no overflow or truncation issues)
- [ ] Images/icons scale appropriately
- [ ] Touch targets remain ≥48px (or ≥56px for operator) at all breakpoints
- [ ] Modals/dialogs adapt (full screen on mobile, centered overlay on desktop)

---

## Operator-Specific Considerations

### Mobile-First Operator Workflows

- [ ] Task cards optimized for mobile (full width, min 96px height, large tap target)
- [ ] Checklist items optimized for mobile (full width, min 64px height)
- [ ] Pass/Fail control 56px height (operator-optimized)
- [ ] Primary operator actions in bottom half of screen (easy thumb reach)
- [ ] Sticky bottom bar for Submit/Save actions (always visible)
- [ ] Progress indicator visible and persistent during checklist

### Touch & Gloves (if applicable)

- [ ] Touch targets ≥ 56px for primary operator actions
- [ ] No complex gestures (multi-touch, precise swipes)
- [ ] Simple taps and single-finger swipes only
- [ ] Glove compatibility tested (if operators wear gloves - DECISION REQUIRED)

### Minimal Typing

- [ ] Scan actions prominent (barcode, QR, employee code)
- [ ] Select/radio options used instead of free text (where possible)
- [ ] Numeric keypad for number inputs (inputmode="numeric" or "decimal")
- [ ] Default values pre-filled (where appropriate)
- [ ] Manual entry fallback always available

### Bilingual (Sinhala Primary)

- [ ] All operator-facing labels in Sinhala (primary) and English (secondary)
- [ ] Large, readable font sizes (16-18px minimum)
- [ ] Clear visual hierarchy (title > context > status)

---

## Critical States & Error Handling

### Critical Failure States

- [ ] Critical failure pattern includes all required elements per CRITICAL_STATE_PATTERNS.md:
  - Critical icon (large, red)
  - "Critical Failure" heading (bold, red)
  - Clear explanation
  - Failed item reference
  - Measurement with expected range (or PLACEHOLDER if not defined)
  - Evidence preview
  - Permitted actions (Reinspect, Escalate, Request Override)
  - Audit notice
- [ ] No normal "Approve for Loading" action visible in loading blocked state
- [ ] Failure details capture (reason, description, evidence, action taken)

### Error Messages

- [ ] All error states have clear error messages (not generic "Error")
- [ ] Error messages actionable (tell user what to do next)
- [ ] Error icon visible (alert icon, critical color)
- [ ] Error message positioned near error source (inline with field or at top of form)
- [ ] Validation summary at top of form (if multiple errors)
- [ ] Error messages in Sinhala and English (operator-facing)

### Offline & Sync States

- [ ] Offline banner persistent and clear ("You are offline. Changes saved locally.")
- [ ] Offline banner does NOT confuse "saved locally" with "submitted to server"
- [ ] Sync status indicator visible (Synced, Syncing, Sync Failed)
- [ ] Submit button changes to "Save Locally" when offline
- [ ] Confirmation wording changes based on online/offline ("Submitted" vs "Saved locally")

### Loading States

- [ ] Loading skeletons match expected content layout
- [ ] Loading spinners visible (not stuck with no feedback)
- [ ] Loading state announced (aria-busy="true" or aria-live)
- [ ] Loading does not block entire screen (unless necessary)

---

## Review & Approval

### Design Review Checklist

- [ ] All pages complete (Pages 00-13, 99)
- [ ] README page (Page 00) includes file overview, change log, approval status
- [ ] All variables created and documented (Page 01-04)
- [ ] All components built with variants and properties (Page 05-08)
- [ ] Mobile operator screens complete (Page 09)
- [ ] Desktop supervisor screens complete (Page 10)
- [ ] Responsive breakpoints demonstrated (Page 11)
- [ ] Accessibility annotations complete (Page 12)
- [ ] This QA checklist on Page 13, all items checked

### Peer Review (if available)

- [ ] Peer designer reviewed file
- [ ] Peer designer feedback addressed
- [ ] Peer designer sign-off recorded (Page 13)

### Stakeholder Approval

- [ ] **Design Owner:** Name, Date, Signature (Page 13)
- [ ] **Development Lead:** Name, Date, Signature (Page 13)
- [ ] **Accessibility Reviewer:** Name, Date, Signature (Page 13)
- [ ] **Product Owner:** Name, Date, Signature (Page 13)

### Open Issues

- [ ] All open issues logged on Page 13 (Issue, Priority, Owner, Status)
- [ ] Critical issues resolved before handoff
- [ ] Non-critical issues logged in backlog (with issue tracker link)

---

## Pre-Handoff Final Checks

### File Organization

- [ ] All pages named correctly (emoji + title)
- [ ] Pages ordered correctly (00-13, 99)
- [ ] Archive page (99) clearly labeled "Do not use for development"
- [ ] Components organized in logical sections with labels
- [ ] No orphan or unlabeled components

### Documentation

- [ ] Figma file URL recorded in project documentation (README.md or similar)
- [ ] Link to documentation (GitHub, Notion) added to Page 00 (README)
- [ ] All annotations clear and readable (Page 12)
- [ ] Change log updated (Page 00)

### Publishing

- [ ] Components published to team library (if applicable)
- [ ] File shared with development team (view-only link or dev mode access)
- [ ] Approved pages locked (prevent accidental edits)
- [ ] Archive page (99) NOT published to developers

---

## Post-Handoff

### Development Support

- [ ] Designer available for questions during development
- [ ] Design file version controlled (branching or versioning strategy defined)
- [ ] Handoff meeting scheduled with development team
- [ ] Clarifications documented (if questions arise)

### Design Maintenance

- [ ] Process for design updates documented (who can update, approval required?)
- [ ] Deprecation process for old components defined
- [ ] Design system governance defined (who owns design file?)

---

## Approval and Governance

This QA checklist is **proposed** and subject to:

- **Design Owner Approval:** OWNER REQUIRED
- **Development Lead Approval:** OWNER REQUIRED (for handoff criteria)
- **Accessibility Reviewer Approval:** OWNER REQUIRED (for accessibility criteria)

**Approval Status:** Pending design review.

**Evidence Required:**
- Design owner approval of QA criteria
- Development lead approval of handoff readiness criteria
- Accessibility reviewer approval of accessibility criteria

---

## Cross-References

- **FIGMA_COMPONENT_BUILD_GUIDE.md:** Figma file structure and build instructions
- **COMPONENT_CATALOGUE.md:** All component specifications
- **COMPONENT_ANATOMY_AND_STATES.md:** Detailed component states
- **ACCESSIBILITY_AND_USABILITY.md:** WCAG requirements
- **CRITICAL_STATE_PATTERNS.md:** Critical state specifications
- **DESIGN_TO_DJANGO_HANDOFF.md:** Development handoff specifications

---

## Document History

| Version | Date       | Author         | Changes                                  |
|---------|------------|----------------|------------------------------------------|
| 1.0     | 2026-08-04 | System         | Initial design QA checklist creation     |

---

**End of Design QA Checklist**

**Note:** Use this checklist before design approval and handoff to development. All items must be checked or marked N/A with reason.
