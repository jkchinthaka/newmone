# MaintainPro Manual QA Checklist

## 1) Login
- [ ] Login with valid work email/password succeeds.
- [ ] Invalid email format is rejected client-side before login API call.
- [ ] Invalid credentials return generic error message (no account enumeration).
- [ ] Login has no public demo credentials in production mode.
- [ ] Login page shows MaintainPro branding and enterprise tagline (desktop and mobile).
- [ ] Login page has no public sign-up link; invitation-only guidance is shown instead.
- [ ] Login form uses Work Email label/placeholder and password show/hide toggle.
- [ ] Login button shows loading state and full-width primary action styling.
- [ ] Forgot password link navigates to `/forgot-password`.
- [ ] Keyboard navigation and visible focus states work on login inputs/buttons/links.
- [ ] Refresh-token cookie + CSRF flow works (`/auth/refresh` requires valid CSRF token/header pairing).
- [ ] Logout clears auth cookies/session and prevents token reuse.
- [ ] Forgot password flow always returns generic accepted message.
- [ ] Reset password token is one-time use and expires correctly.
- [ ] Account lockout behavior works after repeated failed attempts.

## 2) Role-Based Routing
- [ ] ADMIN login lands on `/dashboard` (not legacy `/home`).
- [ ] SUPER_ADMIN login lands on `/system-health` until `/admin` routes exist.
- [ ] MANAGER login lands on `/dashboard`.
- [ ] TECHNICIAN login lands on `/work-orders`.
- [ ] MECHANIC login lands on `/work-orders`.
- [ ] CLEANER login lands on `/cleaning`.
- [ ] SECURITY_OFFICER login lands on `/dashboard` until `/fleet/gate` exists.
- [ ] INVENTORY_KEEPER / STOREKEEPER login lands on `/inventory`.
- [ ] PROCUREMENT_OFFICER login lands on `/procurement`.
- [ ] VIEWER / AUDITOR login lands on `/reports`.
- [ ] Unknown or missing role login safely lands on `/dashboard`.
- [ ] Post-login redirect uses login response role (frontend landing only; backend RBAC still enforced on routes).
- [ ] Login/register/splash success does **not** redirect to legacy `/home`.
- [ ] Splash authenticated redirect uses role-aware helper (typically `/dashboard` or role module route).
- [ ] Legacy `/home` page shows "Legacy FMS Workspace" archive label and dashboard CTA.
- [ ] `/maintenance` route redirects to `/dashboard` (not `/home`).
- [ ] Unauthorized route access is blocked by role/permission checks.
- [ ] Sidebar/menu items match role permissions.

## 2b) Role-Aware Navigation (UX-006)
- [ ] ADMIN sidebar shows Dashboard, System Health, Work Orders, Inventory, Reports (not legacy Home).
- [ ] TECHNICIAN sidebar shows Work Orders and Assets only (no Dashboard/Inventory).
- [ ] CLEANER sidebar shows Cleaning routes only (Overview, Facility Issues).
- [ ] INVENTORY_KEEPER / STOREKEEPER sidebar shows Inventory and Procurement only.
- [ ] Mobile/tablet: menu button opens navigation drawer and closes on link selection or Escape.
- [ ] Active nav item highlights on current route and nested paths (e.g. `/work-orders/123`).
- [ ] No primary nav item labelled "Home" pointing to `/home`.
- [ ] Legacy FMS Archive appears only under Archived section for admin roles (if visible).
- [ ] Sidebar/header show MaintainPro branding and enterprise tagline on desktop.
- [ ] Logout from topbar still clears session and returns to login.
- [ ] Frontend nav hiding is UX-only; direct URL access still requires backend authorization.

## 2c) Page UI States (UX-011)
- [ ] Dashboard and Reports show consistent loading panel while data fetches.
- [ ] Work Orders, Inventory, Procurement, and System Health show professional loading states (not plain "Loading..." text).
- [ ] Error states show safe user-friendly messages with retry where supported.
- [ ] No stack traces, tokens, connection strings, or internal paths appear in UI error messages.
- [ ] Empty list states explain why data is missing (filters, no records, etc.).
- [ ] Empty state action buttons only appear when a safe existing action exists (e.g. clear filters).
- [ ] Assets table empty state uses shared EmptyState with clear filters action.
- [ ] Mobile view: loading/error/empty panels remain readable and buttons are tappable.
- [ ] Logout and auth/session behavior unchanged after state component rollout.

## 2d) Data Table Baseline (UX-009)
- [ ] Work Orders table shows sortable headers and row actions on desktop.
- [ ] Work Orders table renders mobile card layout without losing edit/complete/delete actions.
- [ ] Inventory table pagination previous/next works and selection checkboxes still function.
- [ ] Inventory row action buttons (view, stock in/out, edit, delete) still work.
- [ ] Procurement search filters PO number/supplier client-side without API changes.
- [ ] Procurement row click still selects PO for detail panel.
- [ ] Empty table states use shared EmptyState messaging.
- [ ] No horizontal overflow issues on mobile for rolled-out tables.
- [ ] Work Orders, Inventory, and Procurement tables still behave as in UX-009 (no regression from Assets migration).

## 2e) Assets Data Table (UX-009B)
- [ ] Assets registry table renders core columns (tag, name, category, status) on desktop.
- [ ] Column picker toggles visibility without crash; hidden columns disappear from table/mobile cards.
- [ ] Server-side search/filters/sort unchanged; clearing filters restores rows.
- [ ] Row checkbox selection and header select-all-on-page still work; bulk action bar appears when rows selected.
- [ ] Row ellipsis menu: view details, edit, change status (with disposal reason), create WO, schedule maintenance, view QR, delete (when allowed).
- [ ] Inline status confirm/cancel in row menu still calls existing status mutation payloads.
- [ ] Custom numbered pagination + page size selector still works (outside DataTable footer).
- [ ] Loading uses shared LoadingState; list fetch errors use ErrorState with retry.
- [ ] Empty registry uses shared EmptyState with clear-filters action.
- [ ] Mobile card layout shows visible columns and row actions without horizontal overflow.
- [ ] Row click opens details drawer; checkbox/QR/actions do not trigger drawer accidentally.

## 2f) Dialog & Confirmation UX (UX-010)
- [ ] Destructive actions (delete vehicle, delete work order, deactivate department/job code) show ConfirmDialog with clear title and description.
- [ ] Cancel on destructive confirmation does not call the API or mutate data.
- [ ] Confirm on destructive action submits once (no double-delete on rapid clicks).
- [ ] Prompt dialog for document rejection requires a reason before submit.
- [ ] Prompt dialog for notification user assignment requires user ID.
- [ ] Prompt dialog for schedule task validates ISO date when provided; empty optional due date allowed on submit.
- [ ] Success actions show Sonner toast (not browser alert).
- [ ] Error failures show safe toast or inline error (no stack traces or tokens).
- [ ] Mobile: dialog fits viewport, buttons are tappable (min-height), backdrop dismiss works when not submitting.
- [ ] Keyboard: Escape closes dialog when safe; Tab moves focus between cancel/confirm; Enter submits prompt dialog.
- [ ] No `window.alert`, `window.confirm`, or `window.prompt` in high-impact migrated flows.

## 2g) Tenant Isolation (SEC-006)
- [ ] Tenant A user cannot list Tenant B vehicles, work orders, or trips (404/403, not partial data leak).
- [ ] Tenant A user cannot read Tenant B record by direct ID URL/API call.
- [ ] Tenant A user cannot update/delete Tenant B vehicle or work order.
- [ ] Fleet alerts and geofences for Tenant A do not show Tenant B data.
- [ ] Notification actions (schedule/assign/create WO) cannot mutate Tenant B referenced records.
- [ ] User management list/detail excludes users outside caller tenant (non-SUPER_ADMIN).
- [ ] SUPER_ADMIN cross-tenant access is intentional only (explicit tenant header or global null context), not default for tenant users.
- [ ] Reports/dashboard counts for tenant user exclude other tenants' records.

## 2h) Breadcrumbs (UX-007)
- [ ] Breadcrumbs visible on desktop for rolled-out pages (work orders, assets, inventory, procurement, fleet, vehicles, reports, system health).
- [ ] Breadcrumbs wrap/truncate cleanly on mobile without horizontal page overflow.
- [ ] Deep pages show parent links (e.g. Vehicles → Vehicle Details → Documents).
- [ ] Current page crumb is not clickable and uses `aria-current="page"`.
- [ ] Parent crumbs navigate correctly when clicked.
- [ ] `/home` is not shown as main Home/Dashboard breadcrumb; legacy label is “Legacy FMS Archive” only if ever mapped.
- [ ] Breadcrumbs do not duplicate page titles awkwardly on list pages.

## 2i) Mobile & PWA Polish (UX-012)
- [ ] Login page fits 375px width without clipped content; Sign in and password toggle are tappable (44px targets).
- [ ] Register and forgot-password forms remain usable on 375px/390px widths.
- [ ] Mobile hamburger opens drawer; backdrop/Escape/close button dismiss it.
- [ ] Mobile drawer nav items do not overflow horizontally.
- [ ] Breadcrumbs wrap/truncate on mobile without causing page horizontal scroll.
- [ ] Work Orders mobile cards show actions (edit/complete/delete) and remain tappable.
- [ ] Inventory mobile cards show icon action buttons without clipping.
- [ ] Procurement mobile list remains readable with client-side search.
- [ ] Assets mobile card row menu opens as bottom sheet; backdrop closes menu; status/QR/delete actions reachable.
- [ ] ConfirmDialog and PromptDialog fit small screens with scroll when needed; cancel/confirm remain tappable.
- [ ] Toasts appear centered and readable on mobile.
- [ ] No accidental full-page horizontal scroll on assets/work orders/inventory/procurement list pages.
- [ ] PWA manifest shows MaintainPro name and canonical description; icons resolve (`/pwa-192x192.svg`, `/pwa-512x512.svg`).
- [ ] Install/add-to-home-screen metadata uses MaintainPro branding (no legacy FMS/Maintenance Job labels).

## 2j) Accessibility (UX-013)
- [ ] Keyboard-only user can tab through login/register/forgot-password and submit forms.
- [ ] Login field errors are announced; password show/hide button has an accessible name.
- [ ] Mobile menu button exposes expanded/collapsed state; drawer close works via keyboard (Escape) and close button.
- [ ] Active sidebar/mobile nav item exposes `aria-current="page"`.
- [ ] Breadcrumb current page exposes `aria-current="page"`; truncated crumbs retain full meaning via accessible name.
- [ ] DataTable sort buttons expose sort state; pagination previous/next have accessible names.
- [ ] Assets row selection checkboxes and row action menu have accessible names.
- [ ] ConfirmDialog and PromptDialog titles/descriptions are read by screen reader; prompt validation errors associate with input.
- [ ] Loading/error/empty states use appropriate status/alert semantics without leaking technical details.
- [ ] Visible focus rings appear on keyboard navigation for nav links, table controls, dialogs, and auth inputs.

## 2k) Command Palette (UX-008)
- [ ] Ctrl+K (Windows/Linux) or Cmd+K (macOS) opens command palette outside text inputs.
- [ ] Shortcut does not fire while typing in input/textarea/select fields.
- [ ] Topbar search button opens palette on desktop and mobile.
- [ ] Escape and backdrop click close the palette.
- [ ] Empty search shows allowed navigation commands for current role.
- [ ] Search by module name/keyword filters results (e.g. “inventory”, “parts”, “work”).
- [ ] No-results message appears when query matches nothing.
- [ ] TECHNICIAN (or similar restricted role) does not see admin-only routes (e.g. System Health) in palette.
- [ ] Selecting a command navigates to the correct existing route and closes palette.
- [ ] Dashboard command points to `/dashboard`, not `/home`.
- [ ] Legacy FMS Archive appears only when role nav exposes it, labeled as archive (not Home).
- [ ] Arrow keys move active result; Enter navigates.
- [ ] Palette is usable on mobile (scroll, tap, no horizontal overflow).
- [ ] No destructive or mutating commands appear in palette.

## 2l) Sri Lanka Localization Readiness (UX-014)
- [ ] Inventory, Work Orders, Procurement, Reports, Assets, and Dashboard fleet cost areas show LKR currency (not `$` / USD).
- [ ] Dates and datetimes on rolled-out pages display in Sri Lanka-friendly English (`en-LK`) with sensible day/month ordering.
- [ ] Invalid, null, or empty date/currency values show safe fallback (`—` or module-specific `-` / `Never`) without console errors.
- [ ] Desktop and mobile show consistent formatted values for the same record.
- [ ] Visible UI labels remain English (no partial Sinhala/Tamil translation drift).
- [ ] Screen readers announce formatted currency/date text naturally (no icon-only replacements).

## 2m) Role-Aware Dashboard (DASH-001)
- [ ] SUPER_ADMIN / ADMIN see system health, work orders, inventory, reports, and driver intelligence sections.
- [ ] ADMIN dashboard does not appear for TECHNICIAN, CLEANER, DRIVER, INVENTORY_KEEPER, or VIEWER roles.
- [ ] MANAGER / SUPERVISOR see work orders + reports summaries and operational quick links (no system health or driver intelligence charts).
- [ ] TECHNICIAN / MECHANIC see assigned work order summary and priority list; no admin/system cards.
- [ ] INVENTORY_KEEPER / STOREKEEPER see inventory overview with LKR stock value and low-stock counts.
- [ ] CLEANER sees cleaning quick links and documented empty state (no fake cleaning metrics).
- [ ] DRIVER sees vehicles/fleet quick links and documented empty state (no fake trip metrics).
- [ ] VIEWER / AUDITOR see read-only reports summary; no mutation CTAs on dashboard.
- [ ] Unknown/missing role gets minimal dashboard with safe quick links only.
- [ ] Dashboard layout remains usable on mobile (cards stack, links tappable).

## 3) Work Order Lifecycle
- [ ] Request -> Approval -> Assignment -> In Progress transitions work.
- [ ] Pause/Resume and time tracking are recorded.
- [ ] Parts request/issue affects inventory and work-order costing.
- [ ] Completion requires required fields and evidence.
- [ ] Supervisor verification and requester confirmation flow works.
- [ ] Reopen path captures reason and updates timeline.

## 4) Building Repair Request
- [ ] Public request form submits issue with reference number.
- [ ] Location selection and category/priority capture works.
- [ ] Photo attachments (if enabled) upload and link correctly.
- [ ] Request status tracking page shows valid timeline.
- [ ] Request can be converted into a work order by authorized staff.

## 5) Admin User Management
- [ ] Create/invite user with role and department assignment.
- [ ] Activate/deactivate user with reason and audit trail.
- [ ] Force password reset operation works safely.
- [ ] Session revocation (single/all sessions) works.
- [ ] Invitation resend/revoke and token validation work.

## 6) File Upload
- [ ] Allowed MIME/types upload successfully.
- [ ] Invalid MIME/extension/size are blocked with clear errors.
- [ ] Uploaded files can be previewed/downloaded via authorized URLs.
- [ ] Delete/replace actions update links and preserve audit trace.
- [ ] Tenant A cannot access Tenant B documents.

## 7) Mobile Responsiveness
- [ ] Main pages render cleanly at mobile/tablet/desktop widths.
- [ ] No horizontal overflow on key workflows.
- [ ] Tables/cards are usable on touch screens.
- [ ] Navigation drawer/bottom actions are accessible.
- [ ] Forms and dialogs remain usable on small screens.

## 8) Tenant Isolation
- [ ] Every tenant-owned list returns only actor tenant data.
- [ ] Direct ID access across tenants returns forbidden/not-found.
- [ ] Websocket events are tenant-scoped.
- [ ] WebSocket connection without valid auth is rejected.
- [ ] Cross-tenant super-admin access is explicit and auditable.
- [ ] Tenant switch updates data scope correctly without stale leakage.

## 9) Reports
- [ ] Report filters (date/status/role/tenant) work correctly.
- [ ] Pagination/search/sort behave consistently.
- [ ] Export generation works without request timeouts.
- [ ] Currency/date/timezone formats follow configured tenant locale.
- [ ] Drill-down from KPI cards opens correctly filtered pages.

## 10) Notifications
- [ ] In-app notifications are created and delivered.
- [ ] Email/SMS/Push behavior follows enabled provider flags.
- [ ] Queue failures are visible in logs/health (no silent failures).
- [ ] User preferences (channel mute/priority) are respected.
- [ ] Notification actions (ack/assign/schedule/create WO) work.

## 11) Redis/Queue Health Degradation
- [ ] With Redis reachable, readiness reports `queues.redis.status=active` and notification queue status active.
- [ ] With Redis intentionally disabled (`REDIS_URL` empty + readiness flag off), readiness reports queue mode `disabled`.
- [ ] With Redis expected but unavailable, readiness reports queue mode `failed` or `degraded` and captures safe last error metadata.
- [ ] System health UI reflects queue/Redis state changes without exposing secrets/connection strings.
- [ ] Notification send path shows explicit fallback/log behavior when queue enqueue fails.
- [ ] Readiness/system health responses do not expose secrets (no passwords/tokens/connection strings in payload).

## 12) Integration Modes (SEC-013)
- [ ] In production with `ALLOW_MOCK_IN_PRODUCTION=false`, mock mode envs are rejected at startup.
- [ ] In development, approved mock modes (`ERP_MODE=mock`, `BILLING_MODE=mock`, etc.) are allowed and clearly visible in system health.
- [ ] `BILLING_MODE=live` without Stripe credentials is shown as `misconfigured` and does not silently activate subscriptions.
- [ ] `ERP_MODE=live` without ERP credentials is shown as `misconfigured` and does not report successful sync.
- [ ] `EMAIL_MODE=disabled`, `SMS_MODE=disabled`, and `PUSH_MODE=disabled` are surfaced as `disabled` (not fake-success/no-op ambiguity).
- [ ] System health UI shows `mock`/`misconfigured`/`disabled` badges for integration checks.

## 13) Web Register Route (`/register`) Build/Behavior
- [ ] `/register` loads correctly in production build output (no suspense/prerender failure).
- [ ] `/register?invitationToken=<token>` shows invitation-specific message and submits token to register API flow.
- [ ] `/register` without invitation token shows invitation-only guidance message and preserves existing security posture.
- [ ] Registration flow still stores session/access token as expected after successful API response.

## 14) Vendor Portal
- [ ] Vendor authentication is isolated from internal tenant users.
- [ ] Vendor sees only assigned jobs/documents/invoices.
- [ ] Vendor job status updates sync to internal workflows.
- [ ] Invoice submission/approval path is auditable.
- [ ] Vendor performance metrics update from real activity.
