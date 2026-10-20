# MaintainPro UI/UX standards (2026)

These standards describe the web application in `maintainpro/apps/web`. They follow the current Nelna green identity, Next.js App Router shell, and server-side RBAC. They do not authorize new permissions, a second stock ledger, or new AI services.

## 01. UX vision and goals

MaintainPro is the daily operating surface for maintenance, fleet gate, inventory reconciliation, and administration. A screen is successful when a person with the right permission can finish the real task, see the current record state, and recover from a failure without guessing.

Visual polish is secondary to task completion, data accuracy, and access control.

## 02. Human-centered design principles

Apply Nielsen heuristics and ISO 9241-210 to active workflows:

- Show status with words, not color alone.
- Use the same names as the business: Work Orders, Preventive Maintenance, Assets, Fleet Gate, Spare Parts.
- Prevent unsafe actions (gate out while blocked, stock writes that pretend to replace Bileeta, saving a locked work order without an explicit control).
- Prefer recognition: queues, filters, and record numbers stay visible.
- Let people cancel and go back. Escape closes the topmost overlay only.
- One primary action per view. Secondary actions stay quiet.

## 03. User personas and role definitions

Roles already enforced by the API include `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `TECHNICIAN`, `SECURITY_OFFICER`, `DRIVER`, and `VIEWER`, plus legacy names still resolved by the client (`ASSET_MANAGER`, `MECHANIC`, and others in `lib/role-home.ts`).

The interface may emphasize a role's jobs. The API remains the authority. Hiding a nav item is not authorization.

## 04. Critical user journeys

- Technician: open My Jobs, update the assigned work order, record evidence, request parts.
- Supervisor: find unassigned or overdue work and verify completion.
- Manager: read backlog, PM compliance, and cost reports without treating a partial figure as final.
- Storekeeper: look up a part, see the ERP snapshot, reservations, and mapping gaps. Bileeta stays the stock authority.
- Security officer: identify a vehicle and record gate in or out only when the vehicle is eligible.
- Administrator: manage users, roles, and settings. System Health page access stays SUPER_ADMIN until an owner approves a wider policy.

## 05. Information architecture

Home is `/action-center`. Work Orders live at `/maintenance/jobs` and `/work-orders`. Do not add a second primary board. Legacy FMS routes stay compatibility routes, not redesign targets.

## 06. Navigation standards

Primary labels come from `lib/navigation.ts`. The current page has one `h1`. A breadcrumb that only repeats that `h1` is omitted. Active nav state stays visible. Mobile navigation uses the existing drawer and must remain keyboard dismissible.

## 07. Design tokens

Use the Tailwind theme in `apps/web/tailwind.config.ts` and `app/globals.css`:

- Brand green `#176B3A` (`brand-500` / `brand-600`) and dark green `#104D2B` (`brand-800` / `brand-900`)
- Ink `#263238`
- Accent gold `#F4C430` for warning emphasis, with text that also states the warning
- Card radius `0.75rem`, card shadow `0 1px 2px rgba(16, 77, 43, 0.06)`

## 08. Color standards

- Primary action: `btn-primary` (brand green, white text)
- Secondary and dismiss: `btn-quiet`
- Success: green text plus a word such as Active or Ready
- Warning: amber or gold plus a word such as Overdue or Needs attention
- Danger: rose plus a word such as Blocked or SLA breached
- Focus: `outline-brand-500` or `outline-brand-600`, 2px, offset

## 09. Typography standards

`.page-title` is the only page title style: 1.25rem, weight 600, charcoal. Section labels use small uppercase slate text. Table and body copy stay `text-sm`. Supporting text is `text-slate-500` or `text-slate-600`. Validation text sits with the field.

## 10. Spacing and layout rules

Page stacks use `space-y-3` or `space-y-6`. Toolbars wrap. Do not introduce a new spacing scale for one screen. The desktop shell keeps the sidebar fixed and scrolls `#main-content`.

## 11. Button and action hierarchy

One filled primary button per region. Destructive confirms use `ConfirmDialog`. Do not submit a form by opening it. Gate, stock, approve, and delete actions stay explicit.

## 12. Form design standards

Every input has a visible label or an accessible name. Errors name the field and the correction. Password managers must be able to see login fields (`#login-email`, `#login-password`). Do not disable submit in a way that hides the reason.

## 13. Table design standards

Desktop tables keep the operational columns. Below `md`, use the existing card list when one exists (work orders, PM plans, reports). Pagination controls need accessible names: "Previous page" and "Next page".

## 14. Dialog and drawer standards

Dialogs use `role="dialog"` or `role="alertdialog"`, an accessible name, and a labelled Close control. Escape closes the topmost layer. An open menu, entity picker, or confirmation consumes the first Escape. Focus returns to the control that opened the drawer.

## 15. Loading, empty, error, and success states

Use `LoadingState`, `EmptyState`, and `ErrorState` from `components/ui/page-state`. Do not screenshot or treat a skeleton as the finished page. Empty copy states the fact ("No jobs assigned to you"). Success toasts follow a confirmed API result.

## 16. Accessibility requirements

Target WCAG 2.2 AA for active workflows: one `h1`, names on icon buttons, keyboard access, visible focus, contrast that does not rely on brand green alone for meaning, and status text. Automated checks do not by themselves prove conformance.

## 17. Responsive layout rules

Verify 1440×900, 1024, 768×1024, and 390×844. Required fields, status, and the next action stay available on a phone. Horizontal page scroll is a defect. A wide table may scroll inside its own region.

## 18. Data accuracy and status presentation

Counts on a card must match the filtered list they open. PM copy must not say a job was generated unless the API created one. Reports must not present a partial cost as a complete cost. Gate copy must state when a vehicle cannot move.

## 19. Notifications and user feedback

"Open context" is a link only when the target is outside `/notifications`. Otherwise the row says "No linked record". Mark read and Acknowledge remain separate mutations.

## 20. Performance standards

Targets are LCP ≤ 2.5s, INP ≤ 200ms, and CLS ≤ 0.1 at the 75th percentile when field data exists. Do not record those targets as passed without a measurement.

## 21. Security-aware UX

Denied screens explain the denial. Do not add client-only access to System Health. Do not put session tokens in browser storage. Do not offer an action the API will reject without saying why.

## 22. UX testing and acceptance criteria

A change needs a targeted automated test and a browser check of the settled screen. Critical tasks for a later pilot are recorded in `UI_UX_ROLE_WORKFLOW_REPORT.md`. A 95% task-success figure is a pilot target, not a result.

## 23. Design system governance

Reuse `btn-primary`, `btn-quiet`, `.page-title`, `PageBreadcrumbs`, `ConfirmDialog`, and `components/ui/page-state` before adding a component. A new shared component needs more than one consumer.

## 24. Continuous improvement

Confirmed defects are tracked in `UI_UX_AUDIT_MATRIX.md`. A defect is closed only after the behavior is reproduced as fixed and the regression test or browser check is recorded.
