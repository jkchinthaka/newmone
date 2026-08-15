# Design to Django Handoff

**Document Status:** Proposed  
**Approval Status:** Pending development and design review  
**Last Updated:** 2026-08-04  
**Cross-references:** COMPONENT_CATALOGUE.md, FIGMA_COMPONENT_BUILD_GUIDE.md, DESIGN_TOKENS.md

## Purpose

This document maps design components to future Django implementation patterns, providing clear handoff specifications for developers. It covers:

- Django template partial paths (proposed)
- HTMX fragment patterns (for dynamic updates)
- Tailwind CSS semantic class concepts (for styling)
- ARIA requirements (for accessibility)
- JavaScript requirements (minimal, Alpine.js only where needed)
- Responsive behavior (breakpoints and layout changes)
- Playwright test expectations (for E2E testing)

**Important:** This is a design-to-development specification only. Do NOT implement without approval. No Django code, templates, or Tailwind configuration is created by this document.

---

## General Implementation Principles

1. **Django Templates:** Server-rendered HTML with Django template language
2. **HTMX:** Dynamic updates without full page reloads (progressive enhancement)
3. **Tailwind CSS:** Utility-first CSS framework with custom semantic classes
4. **Alpine.js:** Minimal JavaScript for interactive components only (modals, dropdowns, etc.)
5. **Accessibility-first:** ARIA attributes, keyboard navigation, screen reader support built-in
6. **Mobile-first responsive:** Design for mobile, enhance for desktop
7. **Progressive enhancement:** Core functionality works without JavaScript

---

## Component to Django Mapping Table

| Design Component | Future Django Partial Path | HTMX Fragment | Tailwind Semantic Class Concept | ARIA Requirement | JavaScript Requirement | Responsive Test | Playwright Expectation |
|------------------|----------------------------|---------------|----------------------------------|------------------|------------------------|-----------------|------------------------|
| **Navigation Components** | | | | | | | |
| Mobile Top Bar | `templates/components/navigation/mobile_top_bar.html` | N/A (static) | `.mobile-top-bar`, `.mobile-top-bar__title` | `role="navigation"`, `aria-label="Mobile navigation"` | None (unless menu opens) | Hide > 768px, show sidebar | Visible on mobile, hidden on desktop |
| Mobile Bottom Navigation | `templates/components/navigation/mobile_bottom_nav.html` | N/A (static) | `.mobile-bottom-nav`, `.mobile-bottom-nav__item` | `role="navigation"`, `aria-current="page"` on selected | None | Hide ≥ 768px | Visible on mobile, 3-4 items, selected state |
| Desktop Sidebar | `templates/components/navigation/desktop_sidebar.html` | `sidebar-content` (if dynamic) | `.desktop-sidebar`, `.sidebar__item`, `.sidebar--collapsed` | `role="navigation"`, `aria-label="Main navigation"` | Alpine.js for collapse toggle | Show ≥ 768px, collapsible | Visible on desktop, collapse/expand works |
| Desktop Top Bar | `templates/components/navigation/desktop_top_bar.html` | N/A (static) | `.desktop-top-bar`, `.top-bar__breadcrumb` | `role="navigation"` for breadcrumb | None | Show ≥ 768px | Visible on desktop, breadcrumb rendered |
| Breadcrumb | `templates/components/navigation/breadcrumb.html` | `breadcrumb` (if dynamic) | `.breadcrumb`, `.breadcrumb__item` | `role="navigation"`, `aria-label="Breadcrumb"`, `aria-current="page"` on last | None | Hide < 768px | Truncates middle if > 4 levels |
| Tabs | `templates/components/navigation/tabs.html` | `tab-content-{id}` (content updates via HTMX) | `.tabs`, `.tabs__item`, `.tabs__panel` | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected` | Alpine.js for tab switching (or HTMX) | Stack or scroll on mobile | Tab selection updates panel, keyboard arrows work |
| Account Menu | `templates/components/navigation/account_menu.html` | N/A (static) | `.account-menu`, `.account-menu__trigger`, `.account-menu__panel` | `role="menu"`, `role="menuitem"`, `aria-haspopup`, `aria-expanded` | Alpine.js for open/close | Position adjusts for viewport | Opens on click, closes on Escape or outside click |
| **Action Components** | | | | | | | |
| Primary Button | `templates/components/buttons/primary_button.html` | N/A (triggers action) | `.btn`, `.btn--primary` | None (button element) | None (unless loading state) | Full width on mobile, auto on desktop | Clickable, disabled state, loading spinner if applicable |
| Secondary Button | `templates/components/buttons/secondary_button.html` | N/A | `.btn`, `.btn--secondary` | None | None | Auto width | Clickable, pairs with primary |
| Tertiary Button | `templates/components/buttons/tertiary_button.html` | N/A | `.btn`, `.btn--tertiary` | None | None | Auto width | Clickable, low emphasis |
| Destructive Button | `templates/components/buttons/destructive_button.html` | N/A | `.btn`, `.btn--destructive` | None | Alpine.js for confirmation dialog | Auto width | Clickable, confirmation required |
| Icon Button | `templates/components/buttons/icon_button.html` | N/A | `.btn`, `.btn--icon` | `aria-label` required | None (unless tooltip on hover) | 48px minimum | Clickable, aria-label present, tooltip on hover (desktop) |
| Scan Action | `templates/components/buttons/scan_action.html` | N/A | `.btn`, `.btn--scan`, `.btn--scan-large` | `aria-label` | Alpine.js for camera trigger or scanner API | Large on mobile, prominent | Clickable, opens camera/scanner, manual entry fallback |
| **Form Components** | | | | | | | |
| Text Input | `templates/components/forms/text_input.html` | N/A (form field) | `.form-input`, `.form-input--error` | `aria-label` or `<label for>`, `aria-describedby` for hint/error, `aria-invalid` | None | Full width on mobile | Input field, label associated, error message if invalid |
| Employee Code Input | `templates/components/forms/employee_code_input.html` | `employee-lookup` (HTMX validation) | `.form-input`, `.form-input--code` | `aria-label`, `aria-describedby` | Alpine.js for scan trigger | Full width on mobile | Input or scan, format validation, lookup on blur |
| Password Input | `templates/components/forms/password_input.html` | N/A | `.form-input`, `.form-input--password` | `aria-label` on toggle button | Alpine.js for show/hide toggle | Full width on mobile | Toggle visibility, password hidden by default |
| Search Input | `templates/components/forms/search_input.html` | `search-results` (HTMX autocomplete) | `.form-input`, `.form-input--search` | `role="combobox"`, `aria-autocomplete`, `aria-expanded` | Alpine.js or HTMX for autocomplete | Full width on mobile, 240-400px on desktop | Search icon, clear button, autocomplete dropdown |
| Number Input | `templates/components/forms/number_input.html` | N/A | `.form-input`, `.form-input--number` | `aria-label`, `aria-valuemin`, `aria-valuemax` | None (unless steppers) | Full width on mobile | Numeric keyboard on mobile, steppers if present |
| Temperature Input | `templates/components/forms/temperature_input.html` | N/A | `.form-input`, `.form-input--temperature` | `aria-label`, `aria-describedby` | Alpine.js for probe integration (if applicable) | Full width on mobile | Numeric input, unit display, out-of-range warning (not blocking) |
| Text Area | `templates/components/forms/text_area.html` | N/A | `.form-textarea`, `.form-textarea--autogrow` | `aria-label`, `aria-describedby` | Alpine.js for auto-grow (optional) | Full width, height adjusts | Multi-line input, auto-grows or scrollable |
| Date Input | `templates/components/forms/date_input.html` | N/A | `.form-input`, `.form-input--date` | `aria-label` | Alpine.js or native picker | Full width on mobile | Date picker, format validation, keyboard accessible |
| Time Input | `templates/components/forms/time_input.html` | N/A | `.form-input`, `.form-input--time` | `aria-label` | Alpine.js or native picker | Full width on mobile | Time picker, format validation |
| Select (Dropdown) | `templates/components/forms/select.html` | `select-options` (HTMX for dynamic options) | `.form-select`, `.form-select__dropdown` | `role="combobox"` if custom, `aria-expanded` | Alpine.js for custom dropdown (or native) | Full width on mobile | Dropdown opens, keyboard navigable, selection updates |
| Checkbox | `templates/components/forms/checkbox.html` | N/A | `.form-checkbox`, `.form-checkbox__label` | `aria-checked` if custom | None (unless custom) | Stack vertically on mobile | Checkable, label clickable, checked state |
| Radio Button | `templates/components/forms/radio.html` | N/A | `.form-radio`, `.form-radio__label` | `role="radiogroup"`, `role="radio"`, `aria-checked` | None | Stack vertically on mobile | One selected, keyboard arrows work, label clickable |
| Toggle (Switch) | `templates/components/forms/toggle.html` | N/A (updates via HTMX if immediate effect) | `.form-toggle`, `.form-toggle--on` | `role="switch"`, `aria-checked` | Alpine.js for toggle | All viewports | Toggle state, keyboard accessible, state clear |
| Pass/Fail Control | `templates/components/forms/pass_fail_control.html` | `pass-fail-answer` (HTMX update) | `.form-pass-fail`, `.form-pass-fail__segment` | `role="radiogroup"`, `role="radio"`, `aria-checked` | Alpine.js for selection | Full width on mobile, 56px height | Both segments clickable, selection clear, deselect possible |
| Photo/File Upload | `templates/components/forms/photo_upload.html` | `upload-progress` (HTMX for upload) | `.form-upload`, `.form-upload__preview` | `aria-label` on upload button | Alpine.js for camera trigger, HTMX for upload | Full width on mobile | Camera opens (mobile), file picker, upload progress, preview after upload |
| QR/Barcode Trigger | `templates/components/forms/scan_trigger.html` | N/A | `.form-scan`, `.form-scan__trigger` | `aria-label` | Alpine.js for scanner trigger | Large on mobile | Opens scanner, success/error feedback, manual entry fallback |
| Validation Summary | `templates/components/forms/validation_summary.html` | N/A (server-rendered on form submit) | `.validation-summary`, `.validation-summary__item` | `role="alert"` | None | Full width | List of errors, links to fields, focus on first error |
| Inline Error | `templates/components/forms/inline_error.html` | N/A (server-rendered) | `.form-error`, `.form-error__icon` | `aria-describedby` on field, `aria-invalid` | None | Below field | Error icon, text, associated with field |
| **Operational Components** | | | | | | | |
| Task Card | `templates/components/operational/task_card.html` | `task-list` (HTMX for list updates) | `.task-card`, `.task-card--overdue` | Full card as link or button, `aria-label` | None | Full width on mobile, grid on tablet | Full card clickable, status visible, overdue highlighted |
| Checklist Section | `templates/components/operational/checklist_section.html` | `checklist-section-{id}` (HTMX for collapse) | `.checklist-section`, `.checklist-section__heading` | `role="button"` on heading (if collapsible), `aria-expanded` | Alpine.js for collapse | Full width | Collapsible (if enabled), completion count visible |
| Checklist Item | `templates/components/operational/checklist_item.html` | `checklist-item-{id}` (HTMX for answer update) | `.checklist-item`, `.checklist-item--failed` | `aria-label` on inputs, `aria-describedby` | None (unless triggers failure details) | Full width | Answer control, status indicator, failure details if failed |
| Pass/Fail Answer | `templates/components/operational/pass_fail_answer.html` | N/A (rendered after answer) | `.pass-fail-answer`, `.pass-fail-answer--pass` | None (read-only) | None | Full width | Displays answer, timestamp, operator (if review) |
| Measurement Answer | `templates/components/operational/measurement_answer.html` | N/A (rendered after answer) | `.measurement-answer`, `.measurement-answer--out-of-range` | None (read-only) | None | Full width | Displays value, unit, out-of-range warning if applicable |
| Failure Details | `templates/components/operational/failure_details.html` | `failure-details-{id}` (HTMX for save) | `.failure-details`, `.failure-details__field` | `aria-label` on all fields | None (unless photo upload) | Full width, may be modal on mobile | All fields labeled, evidence attachment, save action |
| Evidence Card | `templates/components/operational/evidence_card.html` | N/A | `.evidence-card`, `.evidence-card__thumbnail` | `aria-label` on view/remove buttons | Alpine.js for lightbox view | Full width or grid | Thumbnail, view action (lightbox), remove if editable |
| Upload Progress | `templates/components/operational/upload_progress.html` | `upload-progress-{id}` (HTMX updates) | `.upload-progress`, `.upload-progress__bar` | `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-live="polite"` | None | Full width | Progress bar, percentage or label, cancel action (optional) |
| Checklist Progress | `templates/components/operational/checklist_progress.html` | `checklist-progress` (HTMX updates) | `.checklist-progress`, `.checklist-progress__bar` | `aria-valuenow`, `aria-valuemin`, `aria-valuemax` | None | Sticky bottom on mobile | Progress bar/fraction, failure count, updates dynamically |
| Incomplete Indicator | `templates/components/operational/incomplete_indicator.html` | N/A | `.incomplete-indicator` | `aria-label` or adjacent text | None | Inline | Icon + label, visible on incomplete items |
| Failed Indicator | `templates/components/operational/failed_indicator.html` | N/A | `.failed-indicator` | `aria-label` | None | Inline | Icon + label, link to failure details |
| Attestation Panel | `templates/components/operational/attestation_panel.html` | N/A (part of submit flow) | `.attestation-panel`, `.attestation-panel__checkbox` | `aria-label` on checkbox, `aria-disabled` on submit button until attested | None | Full width | Attestation statement, checkbox, submit enabled when checked |
| Submission Confirmation | `templates/components/operational/submission_confirmation.html` | N/A (rendered after submit) | `.submission-confirmation` | `role="alert"` or focus on heading | None | Full width, centered | Success icon, heading, timestamp, next actions |
| Record Timeline | `templates/components/operational/record_timeline.html` | `record-timeline` (HTMX if dynamic) | `.record-timeline`, `.record-timeline__event` | `role="list"`, `role="listitem"` | None | Full width | Vertical timeline, events in reverse chronological order |
| Amendment Item | `templates/components/operational/amendment_item.html` | N/A | `.amendment-item`, `.amendment-item__original` | None | None | Full width | Original and new values, reason, timestamp |
| **Feedback Components** | | | | | | | |
| Status Badge | `templates/components/feedback/status_badge.html` | N/A (static) | `.status-badge`, `.status-badge--success` | None (non-interactive) | None | Inline, auto-width | Badge with status text, colored background |
| Success Banner | `templates/components/feedback/banner_success.html` | N/A (rendered after action) | `.banner`, `.banner--success` | `role="alert"` or `aria-live="polite"` | Alpine.js for auto-dismiss | Full width | Banner visible, dismiss button, auto-dismisses after 5-10s |
| Warning Banner | `templates/components/feedback/banner_warning.html` | N/A | `.banner`, `.banner--warning` | `role="alert"` or `aria-live="polite"` | Alpine.js for dismiss | Full width | Banner visible, action button (if present), dismissible |
| Critical Banner | `templates/components/feedback/banner_critical.html` | N/A | `.banner`, `.banner--critical` | `role="alert"` | None (unless dismissible) | Full width, top position | Banner visible, action buttons, not auto-dismissed |
| Info Banner | `templates/components/feedback/banner_info.html` | N/A | `.banner`, `.banner--info` | `aria-live="polite"` | Alpine.js for dismiss | Full width | Banner visible, dismissible |
| Offline Banner | `templates/components/feedback/banner_offline.html` | N/A (JavaScript detects offline) | `.banner`, `.banner--offline` | `role="alert"` on appearance | Alpine.js for offline detection, updates on sync | Sticky top, full width | Banner appears when offline, persists, updates when online |
| Sync Status | `templates/components/feedback/sync_status.html` | `sync-status` (HTMX or JS updates) | `.sync-status`, `.sync-status--syncing` | `aria-live="polite"` | Alpine.js or HTMX for status updates | Inline or in status bar | Icon + text, updates dynamically, retry if failed |
| Toast | `templates/components/feedback/toast.html` | N/A (rendered via JS) | `.toast`, `.toast--success` | `role="alert"` or `aria-live="polite"` | Alpine.js for display and auto-dismiss | Fixed position, centered or top-right | Toast appears, auto-dismisses after 3-5s, close button (optional) |
| Empty State | `templates/components/feedback/empty_state.html` | N/A (rendered when list empty) | `.empty-state` | None | None | Centered, responsive | Icon, heading, message, action button (if applicable) |
| Error State | `templates/components/feedback/error_state.html` | N/A (rendered on error) | `.error-state` | `role="alert"` | None | Centered | Icon, heading, message, retry button |
| Loading Skeleton | `templates/components/feedback/loading_skeleton.html` | N/A (rendered during load) | `.skeleton`, `.skeleton-shimmer` | `aria-live="polite"` or `aria-busy` on container | None (CSS animation) | Matches content layout | Skeleton layout matches expected content, shimmer animation |
| Retry Panel | `templates/components/feedback/retry_panel.html` | N/A (rendered on error) | `.retry-panel` | `role="alert"` | None | Full width or centered | Error message, retry button, error details (expandable) |
| **Review Components** | | | | | | | |
| Review Queue Item | `templates/components/review/queue_item.html` | `review-queue` (HTMX for list updates) | `.review-queue-item`, `.review-queue-item--flagged` | Full card as link or button | None | Full width on mobile, grid on desktop | Full card clickable, flagged items highlighted, priority visible |
| Failure Summary | `templates/components/review/failure_summary.html` | N/A (part of review detail) | `.failure-summary`, `.failure-summary__item` | None | None | Full width | List of failed items, links to each failure |
| Evidence Preview | `templates/components/review/evidence_preview.html` | N/A | `.evidence-preview`, `.evidence-preview__thumbnail` | `aria-label` on view button | Alpine.js for lightbox | Grid or list | Thumbnails, view action (lightbox), download action |
| Approval Actions | `templates/components/review/approval_actions.html` | `approval-actions` (HTMX for submit) | `.approval-actions` | `aria-label` on buttons | Alpine.js for confirmation dialogs | Full width on mobile, inline on desktop | Approve, Return, Reject buttons, confirmation required for Reject |
| Return-for-Correction Panel | `templates/components/review/return_for_correction.html` | `return-for-correction` (HTMX for submit) | `.return-panel`, `.return-panel__field` | `aria-label` on fields | None | Full width | Comment field required, item selection, return button |
| Verification Panel | `templates/components/review/verification_panel.html` | `verification-panel-{id}` (HTMX for update) | `.verification-panel`, `.verification-panel__field` | `aria-label` on checkboxes/inputs | None | Full width | Verify checkbox or input, comment if discrepancy |
| Hold/Reject Panel | `templates/components/review/hold_reject_panel.html` | `hold-reject` (HTMX for submit) | `.hold-reject-panel`, `.hold-reject-panel__field` | `aria-label` on fields | Alpine.js for confirmation | Full width | Reason field required, category select, confirmation dialog |
| Separation-of-Duty Warning | `templates/components/review/separation_of_duty_warning.html` | N/A (rendered when rule triggered) | `.warning`, `.warning--separation-of-duty` | `role="alert"` | None | Full width | Warning message, guidance, alternate action or blocking |
| Read-Only Audit Indicator | `templates/components/review/read_only_indicator.html` | N/A (static) | `.read-only-indicator` | None | None | Inline or banner | Icon + label, reason (if applicable) |
| **Data Display Components** | | | | | | | |
| KPI Card | `templates/components/data_display/kpi_card.html` | `kpi-card-{id}` (HTMX for updates) | `.kpi-card`, `.kpi-card__value` | None | None | Grid (1-4 columns depending on viewport) | Value, label, trend (if present), updates dynamically |
| Data Table | `templates/components/data_display/data_table.html` | `data-table` (HTMX for sort/filter/pagination) | `.data-table`, `.data-table__row` | `role="table"`, `scope="col"`, `aria-sort` | Alpine.js or HTMX for sort/filter | Horizontal scroll on mobile, responsive collapse to cards | Table headers sortable, rows clickable, pagination controls |
| Responsive List | `templates/components/data_display/responsive_list.html` | `list-items` (HTMX for updates) | `.responsive-list`, `.responsive-list__item` | `role="list"`, `role="listitem"` | None | Stack vertically | List items, full width, actions if present |
| Filter Bar | `templates/components/data_display/filter_bar.html` | `filter-results` (HTMX for apply) | `.filter-bar`, `.filter-bar__chip` | `aria-label` on filters | Alpine.js or HTMX for filter application | Collapse to drawer on mobile | Filter chips visible, clear all button, applies filters to content |
| Pagination | `templates/components/data_display/pagination.html` | `pagination-{page}` (HTMX for page change) | `.pagination`, `.pagination__item` | `aria-current="page"` on current, `aria-label` on prev/next | None | Simplify on mobile (fewer page numbers) | Page links, prev/next, disabled at boundaries, current page highlighted |
| Date Range Picker | `templates/components/data_display/date_range_picker.html` | `date-range-results` (HTMX for apply) | `.date-range-picker`, `.date-range-picker__input` | `aria-label` on inputs | Alpine.js for picker, HTMX for apply | Full width on mobile | Start/end inputs, calendar pickers, quick select buttons, apply button |
| Audit Event Row | `templates/components/data_display/audit_event_row.html` | `audit-events` (HTMX for pagination) | `.audit-event`, `.audit-event__timestamp` | None | Alpine.js for details expansion (optional) | Full width | Timestamp, actor, action, target, details link (if applicable) |
| Timeline | `templates/components/data_display/timeline.html` | `timeline` (HTMX if dynamic) | `.timeline`, `.timeline__event` | `role="list"`, `role="listitem"` | None | Vertical on mobile, vertical or horizontal on desktop | Timeline events in order, icons, descriptions |
| Details Panel | `templates/components/data_display/details_panel.html` | `details-panel-{id}` (HTMX for load) | `.details-panel`, `.details-panel__field` | `aria-label` on panel | Alpine.js for tabs (if present) | Full width on mobile, sidebar or modal on desktop | Labels and values, tabs (if applicable), close action |
| **Overlay Components** | | | | | | | |
| Modal | `templates/components/overlays/modal.html` | N/A (content pre-rendered or HTMX) | `.modal`, `.modal__backdrop`, `.modal__container` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | Alpine.js for open/close, focus trap | Full screen on mobile, centered overlay on desktop | Opens on trigger, backdrop visible, focus trapped, Escape closes, backdrop click closes |
| Confirmation Dialog | `templates/components/overlays/confirmation_dialog.html` | N/A | `.modal`, `.modal--confirmation` | `role="alertdialog"`, `aria-modal="true"` | Alpine.js for open/close, focus trap | Centered on mobile and desktop | Opens on trigger, focus on Cancel (safe default), Escape = Cancel, confirms on primary action |
| Bottom Sheet | `templates/components/overlays/bottom_sheet.html` | N/A | `.bottom-sheet`, `.bottom-sheet__handle` | `role="dialog"`, `aria-modal="true"` | Alpine.js for open/close, drag to dismiss | Mobile only (< 768px) | Slides from bottom, draggable handle, backdrop visible, swipe down closes |
| Side Drawer | `templates/components/overlays/side_drawer.html` | N/A | `.side-drawer`, `.side-drawer__panel` | `role="dialog"` or `role="navigation"`, `aria-modal="true"` | Alpine.js for open/close, focus trap | Full screen on mobile, partial overlay on desktop | Slides from left/right, backdrop visible, Escape closes, backdrop click closes |
| Popover | `templates/components/overlays/popover.html` | N/A | `.popover`, `.popover__panel` | `role="dialog"` or `role="menu"`, `aria-haspopup`, `aria-expanded` | Alpine.js for positioning and open/close | Position adjusts for viewport | Opens near trigger, arrow points to trigger, Escape closes, outside click closes |
| Tooltip | `templates/components/overlays/tooltip.html` | N/A | `.tooltip` | `aria-describedby` on trigger element | Alpine.js for show/hide on hover/focus | Desktop primarily (hover), long press on mobile | Shows on hover and focus, hides on Escape, brief text |

---

## HTMX Patterns

### Common HTMX Attributes

- `hx-get="/url"` - GET request on trigger
- `hx-post="/url"` - POST request on trigger
- `hx-trigger="click"` - Trigger event (click, change, blur, etc.)
- `hx-target="#element-id"` - Target element for response
- `hx-swap="innerHTML"` - Swap strategy (innerHTML, outerHTML, beforeend, etc.)
- `hx-indicator="#spinner-id"` - Show spinner during request
- `hx-vals='{"key":"value"}'` - Additional values to send

### Example: Checklist Item Answer Update

**HTML (Checklist Item):**
```html
<div class="checklist-item" id="checklist-item-5">
  <label>Temperature Check: Cold Storage A</label>
  <input type="number" 
         hx-post="/checklist/item/5/answer" 
         hx-trigger="blur" 
         hx-target="#checklist-item-5" 
         hx-swap="outerHTML">
  <div class="checklist-progress" 
       hx-target="#checklist-progress" 
       hx-swap="innerHTML"></div>
</div>
```

**Django View Response:**
```html
<!-- Returns updated checklist item HTML with answer -->
<div class="checklist-item checklist-item--answered" id="checklist-item-5">
  <label>Temperature Check: Cold Storage A</label>
  <div class="measurement-answer">[value] [unit]</div>
  <!-- Progress component also updated via HTMX -->
</div>
```

**Note:** This is an example pattern only. Do not implement without approval.

---

## Tailwind CSS Semantic Class Concepts

### Proposed Approach

1. **Use Tailwind utility classes** for spacing, sizing, and layout (e.g., `p-4`, `flex`, `gap-2`)
2. **Create semantic component classes** using `@apply` directive or custom CSS for reusable component styles
3. **Use design tokens** (CSS custom properties) for colors, fonts, sizes

### Example Semantic Classes

```css
/* Proposed Tailwind config or custom CSS */

/* Button Base */
.btn {
  @apply px-6 py-3 rounded-lg font-semibold text-base transition-colors duration-150;
  min-height: var(--size-touch-minimum); /* 48px */
}

.btn--primary {
  background-color: var(--colour-semantic-action-primary);
  color: var(--colour-semantic-text-on-action);
}

.btn--primary:hover {
  background-color: var(--colour-semantic-action-primary-hover);
}

/* Form Input Base */
.form-input {
  @apply w-full px-3 py-3 border rounded-lg;
  min-height: var(--size-input-height-default); /* 48px */
  border-color: var(--colour-semantic-input-border);
  background-color: var(--colour-semantic-input-background);
}

.form-input:focus {
  border-color: var(--colour-semantic-input-border-focus);
  border-width: 2px;
  outline: none;
}

.form-input--error {
  border-color: var(--colour-semantic-input-border-error);
  border-width: 2px;
}

/* Task Card */
.task-card {
  @apply p-4 border rounded-lg shadow-sm cursor-pointer;
  min-height: 96px;
  border-color: var(--colour-semantic-border-default);
  background-color: var(--colour-semantic-surface-card);
}

.task-card:hover {
  box-shadow: var(--elevation-low);
}

.task-card--overdue {
  border-color: var(--colour-semantic-status-critical);
  border-width: 2px;
}
```

**Note:** This is a proposed approach. Actual Tailwind configuration and semantic classes require development approval.

---

## Playwright Test Expectations

### Test Structure (Proposed)

For each component, Playwright E2E tests should verify:

1. **Visibility:** Component renders and is visible
2. **Accessibility:** ARIA attributes present, keyboard navigation works
3. **Interaction:** Clicks, inputs, submissions work as expected
4. **States:** Component shows correct states (hover, focus, error, etc.)
5. **Responsive:** Component layout adapts at breakpoints

### Example: Primary Button Test

```typescript
// Proposed Playwright test (do not implement without approval)

import { test, expect } from '@playwright/test';

test.describe('Primary Button', () => {
  test('renders with label', async ({ page }) => {
    await page.goto('/components/buttons');
    const button = page.locator('.btn--primary').first();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Submit');
  });

  test('is clickable', async ({ page }) => {
    await page.goto('/components/buttons');
    const button = page.locator('.btn--primary').first();
    await button.click();
    // Assert expected action (e.g., form submission)
  });

  test('shows focus state on keyboard tab', async ({ page }) => {
    await page.goto('/components/buttons');
    await page.keyboard.press('Tab');
    const button = page.locator('.btn--primary:focus').first();
    await expect(button).toBeVisible();
    // Assert focus ring visible (CSS check or visual regression)
  });

  test('is disabled when disabled attribute present', async ({ page }) => {
    await page.goto('/components/buttons');
    const button = page.locator('.btn--primary[disabled]').first();
    await expect(button).toBeDisabled();
  });

  test('shows loading state', async ({ page }) => {
    await page.goto('/components/buttons');
    // Trigger loading state
    const button = page.locator('.btn--primary.btn--loading').first();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    const spinner = button.locator('.spinner');
    await expect(spinner).toBeVisible();
  });

  test('is full width on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/components/buttons');
    const button = page.locator('.btn--primary').first();
    const bbox = await button.boundingBox();
    expect(bbox.width).toBeGreaterThan(300); // Approx full width minus padding
  });
});
```

**Note:** This is an example test structure only. Do not implement without approval.

---

## Responsive Breakpoints

| Breakpoint Name | Min Width (px) | Tailwind Class Prefix | Layout Changes |
|-----------------|----------------|-----------------------|----------------|
| Mobile (default) | 0 | (none) | Single column, bottom nav, full width buttons |
| Tablet | 768 | `md:` | Desktop sidebar appears, multi-column layout begins, buttons auto-width |
| Desktop | 1280 | `lg:` | Full multi-column layout, wider content area, side panels |

---

## Approval and Governance

This design-to-Django handoff specification is **proposed** and subject to:

- **Development Lead Approval:** OWNER REQUIRED (for Django patterns, HTMX, Tailwind approach)
- **Design Owner Approval:** OWNER REQUIRED (for design fidelity and component mapping)
- **Accessibility Reviewer Approval:** OWNER REQUIRED (for ARIA requirements and keyboard navigation)
- **QA Lead Approval:** OWNER REQUIRED (for Playwright test expectations)

**Approval Status:** Pending design and development review.

**Evidence Required:**
- Development lead approval of Django template structure and HTMX patterns
- Accessibility reviewer validation of ARIA requirements
- QA lead approval of test expectations

---

## Cross-References

- **COMPONENT_CATALOGUE.md:** All components and specifications
- **DESIGN_TOKENS.md:** Design token definitions (for CSS custom properties)
- **FIGMA_COMPONENT_BUILD_GUIDE.md:** Figma component structure (for design reference)
- **ACCESSIBILITY_AND_USABILITY.md:** WCAG requirements and accessibility guidelines

---

## Document History

| Version | Date       | Author         | Changes                                  |
|---------|------------|----------------|------------------------------------------|
| 1.0     | 2026-08-04 | System         | Initial design-to-Django handoff creation |

---

**End of Design to Django Handoff**

**Note:** This document is a specification only. Do NOT implement Django templates, Tailwind CSS, HTMX, or Playwright tests without approval from development lead and design owner.
