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

## 2n) Admin Console Foundation (ADMIN-001)
- [ ] SUPER_ADMIN sees `Admin Console` nav item and `/admin` command palette entry.
- [ ] ADMIN sees `Admin Console` nav item and `/admin` command palette entry.
- [ ] TECHNICIAN, CLEANER, DRIVER, INVENTORY_KEEPER, VIEWER, and unknown roles do not see `/admin` in nav or command palette.
- [ ] Direct navigation to `/admin` as non-admin shows access-restricted state (not admin cards).
- [ ] Admin console cards do not display fake user/tenant/RBAC counts.
- [ ] System health section loads from existing readiness data or shows safe error state.
- [ ] Available cards link only to real routes (`/admin/users`, `/settings`, `/system-health`).
- [ ] Tenants card shows requires-API/coming-soon messaging without mutation actions.
- [ ] Mobile layout stacks session, health, and module cards cleanly.

## 2o) Admin Users & Access Read-Only View (ADMIN-002A)
- [ ] ADMIN can open `/admin/users` from the Admin Console card and review tenant-scoped users.
- [ ] SUPER_ADMIN can open `/admin/users` and sees tenant columns for cross-tenant review.
- [ ] Non-admin direct access to `/admin/users` shows access-restricted state.
- [ ] User table shows name, email, role, status, last login, and created date only.
- [ ] No password, token, hash, or internal auth fields appear in UI or network payload.
- [ ] Empty, loading, and error states render safely with retry on error.
- [ ] Mobile card layout remains readable and tappable.
- [ ] No invite/create/edit/delete user actions appear on `/admin/users`.

## 2p) Admin User Status Controls (ADMIN-002B)
- [ ] ADMIN can deactivate an own-tenant user from `/admin/users` after ConfirmDialog confirmation.
- [ ] ADMIN can reactivate an inactive own-tenant user with non-destructive confirmation copy.
- [ ] ADMIN cannot mutate a user from another tenant (backend returns not found/forbidden; no UI action for out-of-scope rows).
- [ ] ADMIN cannot mutate SUPER_ADMIN users (no action shown; backend rejects if forced).
- [ ] Current user cannot deactivate themselves (no self action; backend rejects self-deactivation).
- [ ] Last active SUPER_ADMIN cannot be deactivated (backend protection; SUPER_ADMIN-only scenario).
- [ ] Mobile card layout shows a tappable Deactivate/Reactivate button with accessible label.
- [ ] Success and error feedback appear after status change; list refreshes updated row.
- [ ] No password, token, hash, or internal auth fields appear in UI or network payload.
- [ ] No invite/create/delete/role-edit/password-reset actions appear on `/admin/users`.

## 2q) Legacy User Path Hardening (ADMIN-002C)
- [ ] Settings user list still loads and shows name, email, role, and status.
- [ ] Settings deactivate/activate still works for permissioned users and respects backend protection errors.
- [ ] `/admin/users` deactivate/reactivate still works with ConfirmDialog.
- [ ] Network payloads from `GET /users` omit password hashes, tokens, failed login counts, lockout timestamps, and role permission arrays.
- [ ] Cross-tenant status mutation is blocked on both `/users/:id/status` and `/admin/users/:id/status`.
- [ ] Self-deactivation, SUPER_ADMIN protection, and last-super-admin protection apply on both status paths.
- [ ] Admin users in Settings see link to `/admin/users` without breaking the existing table.

## 2r) Admin Tenant Read-Only Workspace (ADMIN-003A)
- [ ] SUPER_ADMIN can open `/admin/tenants` from Admin Console and review cross-tenant list in DataTable.
- [ ] ADMIN can open `/admin/tenants` and sees own active tenant profile only.
- [ ] Non-admin direct access to `/admin/tenants` shows access-restricted state.
- [ ] Tenant table/profile shows name, slug, status, member count, and dates only.
- [ ] No database URLs, API keys, SMTP/SMS credentials, billing secrets, or env/config values appear in UI or network payload.
- [ ] Empty, loading, and error states render safely with retry on error.
- [ ] Mobile layout remains readable for tenant profile and SUPER_ADMIN table cards.
- [ ] No tenant create/edit/delete/invite/switch/billing actions appear on `/admin/tenants`.

## 2s) Admin Roles & Permissions Matrix (ADMIN-004A)
- [ ] ADMIN can open `/admin/roles` from Admin Console and review tenant-scoped role coverage.
- [ ] SUPER_ADMIN can open `/admin/roles` and sees cross-tenant roles with tenant labels.
- [ ] Non-admin direct access to `/admin/roles` shows access-restricted state.
- [ ] Matrix shows permission keys grouped by module with read-only Yes/— coverage badges.
- [ ] Client search filters roles and permissions without errors.
- [ ] No password, token, user list, or secret fields appear in UI or network payload.
- [ ] Empty, loading, and error states render safely with retry on error.
- [ ] Mobile layout scrolls grouped permission tables cleanly.
- [ ] No edit/delete/assign/create actions appear on `/admin/roles`.

## 2t) Legacy Role/Permission Read Hardening (ADMIN-004B)
- [ ] Settings Roles tab still loads existing roles and permission checkboxes.
- [ ] Settings permission catalog list still loads for role editing.
- [ ] `/admin/roles` matrix still works unchanged.
- [ ] Network payloads from `GET /roles` omit roleIds, permissionIds, user lists, and raw relation arrays.
- [ ] Network payloads from `GET /roles/permissions` omit roleIds and internal relation payloads.
- [ ] No tokens, secrets, or session fields appear in role/permission responses.
- [ ] Invite role picker still lists roles by id/name.

## 2u) Admin Invitation Read-Only Review (ADMIN-003B)
- [ ] SUPER_ADMIN can open `/admin/invitations` and review cross-tenant invitation records.
- [ ] ADMIN can open `/admin/invitations` and sees tenant-scoped invitations only.
- [ ] Non-admin direct access to `/admin/invitations` shows access-restricted state.
- [ ] Invitation table shows email, membership role, status, inviter, and dates only.
- [ ] No invitation token, token hash, invitation link, or provider secrets appear in UI or network payload.
- [ ] Status search/filter works without errors.
- [ ] Empty, loading, and error states render safely with retry on error.
- [ ] Mobile card/table layout remains readable.
- [ ] No resend/revoke/accept/delete actions appear on `/admin/invitations`.

## 2v) Legacy Tenant Invitation List Hardening (ADMIN-003C)
- [ ] Billing/settings invitation list callers still load without errors after DTO change.
- [ ] `/admin/invitations` still loads token-free review rows.
- [ ] `GET /tenants/:id/invitations` network payload contains no `token`, `tokenHash`, or `invitationLink`.
- [ ] Tenant invitation list remains tenant-scoped with existing membership permission checks.
- [ ] Non-authorized membership roles cannot list tenant invitations.
- [ ] Mobile layouts for any invitation list UI remain readable.
- [ ] No resend/revoke/delete actions were added.

## 2w) Admin Invitation Create Flow (ADMIN-003D)
- [ ] ADMIN can create an invitation for the active tenant from `/admin/invitations`.
- [ ] SUPER_ADMIN can create an invitation for a selected tenant.
- [ ] Non-admin roles cannot access the create dialog or POST endpoint.
- [ ] Create response/network payload contains no separate `token`, `invitationToken`, or `tokenHash`.
- [ ] One-time invitation link panel appears after create with copy warning.
- [ ] Invitation link is not stored in localStorage/sessionStorage and does not appear in the review table.
- [ ] Invitation list refreshes after successful create.
- [ ] Mobile create dialog remains usable and accessible.
- [ ] No resend/revoke/delete/accept/bulk invite actions appear.

## 2x) Building / Facility Module (Future — post BUILD-002)
- [ ] Property/building/floor/room hierarchy CRUD is tenant-scoped.
- [ ] Facility issue list/detail loads at `/facilities/issues` without token or cross-tenant leakage.
- [ ] Issue create supports category, severity, room, and photo attachments.
- [ ] Supervisor can assign issue and create linked work order.
- [ ] Technician sees facility work orders in existing work order views.
- [ ] Cleaning-reported issues link to room/location correctly.
- [ ] Facility dashboard widgets show open/overdue issues for authorized roles only.
- [ ] Facility reports export without sensitive fields.
- [ ] BUILDING_SUPERVISOR and FACILITY_MANAGER redirects resolve to real routes.
- [ ] Mobile issue form and photo capture remain usable.

## 2y) Building / Facility Schema Foundation (BUILD-002 — schema only, no UI yet)
- [ ] `npx prisma db push` applies Property/Building/Floor/Room models without errors.
- [ ] Seed includes FACILITY_MANAGER and BUILDING_SUPERVISOR roles with facility permission keys.
- [ ] No `/facilities` routes or facility API endpoints exist yet (expected).
- [ ] Existing cleaning/issues and work-order flows still work unchanged.
- [ ] Role redirect targets for FACILITY_MANAGER/BUILDING_SUPERVISOR still 404 until BUILD-006 (expected).

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

## 15) Smart Operations Action Center (SMART-OPS-001)
- [ ] `/action-center` loads with role-appropriate sections (admin, manager, technician, inventory, cleaner, driver, viewer).
- [ ] ADMIN sees system health, invitations, work orders, and inventory sections; non-admin does **not** see admin invitation review data.
- [ ] Metrics reflect live API data only — no fabricated counts when APIs fail (shows “Not connected yet”).
- [ ] Overdue/high-priority work order cards link to `/work-orders`.
- [ ] Low-stock and pending PO cards link to `/inventory` and `/procurement`.
- [ ] Facility/cleaner roles see cleaning issue links and “Facility module planned” guidance (not fake hierarchy data).
- [ ] Mobile Action Center: cards stack in single column; links remain tappable.
- [ ] Command palette (Ctrl/Cmd+K) includes Action Center for eligible roles; hidden from unauthorized roles.
- [ ] Sidebar Action Center nav item visible for operational roles; not shown to roles without access.

## 16) Dashboard Morning Briefing (SMART-OPS-001)
- [ ] Admin/management/inventory dashboards show compact Morning Briefing card.
- [ ] Briefing shows open/overdue work orders and low-stock counts when APIs return data.
- [ ] Admin briefing includes system health line when readiness API succeeds.
- [ ] “Open Action Center” link navigates to `/action-center`.
- [ ] Technician/cleaner/driver dashboards do **not** show duplicate briefing card (Action Center remains available via nav).

## 17) QR Readiness Helper (SMART-OPS-001)
- [ ] `qr-readiness.spec.ts` passes (payload generation, parse rejection, secret field blocking, supported types).
- [ ] Encoded payloads contain no auth tokens, passwords, or invitation links.

## 18) Evidence Timeline Foundation (SMART-OPS-001)
- [ ] `EvidenceTimeline` renders empty state when no events provided (no fake timeline rows).
- [ ] `mapWorkOrderDatesToEvidenceTimeline()` produces events only from existing date fields.

## 19) Smart Ops Security Checks (SMART-OPS-001)
- [ ] Action Center and briefing responses do not expose invitation tokens, refresh tokens, or internal auth fields.
- [ ] FACILITY_MANAGER / BUILDING_SUPERVISOR post-login no longer targets missing `/facility` routes.

## 20) Facility Hierarchy API (BUILD-003)
- [ ] `GET /api/facilities/properties` returns only caller-tenant properties for ADMIN.
- [ ] ADMIN cannot read another tenant's property by ID (404).
- [ ] `POST /api/facilities/buildings` rejects cross-tenant `propertyId` (404).
- [ ] `POST /api/facilities/floors` rejects cross-tenant `buildingId` (404).
- [ ] `POST /api/facilities/rooms` rejects cross-tenant `floorId` (404).
- [ ] FACILITY_MANAGER can create/update hierarchy; BUILDING_SUPERVISOR can view but not manage.
- [ ] VIEWER/MANAGER can list/read when `facilities.view` granted; cannot POST/PATCH without `facilities.manage`.
- [ ] SUPER_ADMIN without tenant context receives 400 (tenant required).
- [ ] PATCH `isActive: false` deactivates records; no DELETE routes exist.
- [ ] API responses exclude Prisma relation payloads (allowlisted DTO only).
- [ ] Request body cannot override `tenantId` (forbidden by ValidationPipe whitelist).

## 23) Facility Issue Room Selector UI (BUILD-006)
- [ ] Create issue with legacy cleaning location only (no roomId) still works.
- [ ] Create issue with optional room + category submits roomId/category without tenantId.
- [ ] Create issue when facilities API unavailable still works with location-only flow.
- [ ] Empty facility hierarchy shows helper text; legacy location still available.
- [ ] Issue list shows category badge and room label when present.
- [ ] Edit room/category panel saves via PATCH; clear room sets roomId null.
- [ ] Existing issues without roomId open and display safely.
- [ ] Category client filter works without breaking list.
- [ ] Mobile: cascading selectors stack/readably on small screens.
- [ ] No Work Order, QR scan, or photo upload actions added (BUILD-007 adds authorized WO bridge only).

## 24) Facility Issue → Work Order Bridge (BUILD-007)
- [ ] Authorized role (ADMIN/FACILITY_MANAGER/BUILDING_SUPERVISOR/MANAGER/SUPERVISOR with `facility_issues.manage`) can create work order from OPEN/IN_PROGRESS issue.
- [ ] Duplicate create for same issue returns conflict; only one linked work order allowed.
- [ ] Linked work order summary visible on issue row (`workOrderNumber`, title, status); links to `/work-orders`.
- [ ] RESOLVED/CLOSED issues do not show create action; API rejects bridge.
- [ ] CLEANER/VIEWER/DRIVER cannot create work order from issue (UI hidden + API blocked).
- [ ] Cross-tenant issue bridging rejected (404/tenant guard).
- [ ] Existing issue create/list/update/PATCH room flows unchanged.
- [ ] Existing Work Orders UI/API unchanged; WO uses standard lifecycle (`CORRECTIVE` type).
- [ ] No QR public scan route, photo upload, facility reports, ERP posting, or email/SMS added.

## 25) Authenticated QR Issue Reporting (BUILD-008)
- [ ] Facility manager can open QR dialog from `/facilities` room row and copy authenticated report link.
- [ ] QR dialog shows QR image (`react-qr-code`) and copyable URL; payload contains no tokens/secrets/tenantId.
- [ ] Opening `/qr/report-issue?qr=…` while signed in resolves room context and prefills room selector.
- [ ] Building/floor/property QR links show context and require room selection before submit.
- [ ] Invalid QR query shows safe error state (no stack traces or raw payloads).
- [ ] Cross-tenant/inaccessible entity returns safe error from facilities API.
- [ ] Submitted issue uses existing `POST /cleaning/issues` without `tenantId` in body.
- [ ] Unauthenticated users are redirected by existing dashboard auth flow (no public route).
- [ ] VIEWER without report permission cannot submit from QR route.
- [ ] Mobile: QR report form stacks/readably on small screens.
- [ ] Existing `/cleaning/issues`, WorkOrder bridge, and `/facilities` CRUD unchanged.
- [ ] No public `/public/*` QR route added.

## 26) Facility Dashboard + Reporting (BUILD-009)
- [ ] `/facilities/reports` loads for roles with `facilities.view` (FACILITY_MANAGER, ADMIN, VIEWER, etc.).
- [ ] DRIVER cannot access facility reports in navigation or page permission state.
- [ ] KPI counts match known tenant data (hierarchy + issues); zero tenant shows explicit empty message (no fake metrics).
- [ ] Overdue count reflects issues with past `slaTargetAt` and OPEN/IN_PROGRESS status only.
- [ ] Category/severity/status breakdown tables show real counts only.
- [ ] Work order linkage KPIs match issues with/without `workOrderId`.
- [ ] Attention previews list at most 5 items without raw relation payloads.
- [ ] Action Center and command palette link to `/facilities/reports` for allowed roles only.
- [ ] Mobile layout: KPI cards stack; tables scroll horizontally if needed.
- [ ] Refresh reloads summary from `GET /facilities/dashboard`.
- [ ] Existing `/facilities`, `/cleaning/issues`, QR reporting, and WO bridge unchanged.

## 27) SLA / Aging Report (OPS-002)
- [ ] `/facilities/reports/aging` loads for roles with `facilities.view`; DRIVER blocked.
- [ ] Issue aging buckets (0–1, 2–3, 4–7, 8+ days) reflect open/in-progress issues only.
- [ ] Overdue issue count uses `slaTargetAt < now` for OPEN/IN_PROGRESS issues.
- [ ] Critical/high counts in buckets match severity on active issues.
- [ ] Linked work order aging appears only when due dates exist on active linked WOs.
- [ ] Empty tenant shows zero/empty states (no placeholder metrics).
- [ ] Action Center and `/facilities/reports` link to aging report.
- [ ] Refresh reloads from `GET /facilities/reports/aging`.

## 28) Facility Location Backfill (BUILD-010)
- [ ] `npm run facility:backfill:dry` completes without DB mutations.
- [ ] Report includes confidence + reason for each CleaningLocation.
- [ ] Cross-tenant candidates are not matched.
- [ ] Apply mode fails without `ALLOW_FACILITY_BACKFILL_APPLY=true` and `--apply`.
- [ ] Apply mode updates only exact matches and only null `roomId` on linked issues.

## 29) Notification Provider Foundation (NOTIFY-001)
- [ ] `/notifications/readiness` reports disabled/not_configured/misconfigured/configured honestly.
- [ ] `/health/readiness` includes `operationalFoundations.notifications`.
- [ ] Template samples render without secrets; no messages sent in tests.
- [ ] Missing SMTP/SMS config does not crash API boot.

## 30) ERP Inventory Foundation (ERP-001)
- [ ] Inventory ERP adapter reports disabled by default.
- [ ] Live mode without credentials reports `not_configured` (no fake success).
- [ ] Adapter methods return honest `ok: false` without HTTP calls in tests.
- [ ] Production mock ERP remains blocked unless explicitly allowed.

## 31) Deployment Readiness (DEPLOY-001)
- [ ] `npm run deployment:readiness` prints checklist JSON with blockers/warnings.
- [ ] `/health/deployment-readiness` available to ADMIN/SUPER_ADMIN.
- [ ] Missing required production config yields `blocked`/`warning`, not fake pass.
- [ ] `docs/DEPLOYMENT_READINESS_CHECKLIST.md` reviewed before go-live.

## 32) Duplicate Issue Detection (OPS-003)
- [ ] Reporting similar issue for same room/category within 7 days shows advisory warning on `/cleaning/issues`.
- [ ] Different room/location does not warn for unrelated open issues.
- [ ] Cross-tenant duplicate candidates are never returned.
- [ ] RESOLVED/CLOSED and issues older than configured window are excluded.
- [ ] User can continue and submit anyway; no auto-merge/auto-close occurs.
- [ ] QR authenticated report flow shows same duplicate warning when room context matches.
- [ ] Duplicate check failure shows “Duplicate check unavailable. You can still submit.” and create still works.
- [ ] Duplicate-check payload from web client does not include `tenantId`.

## 33) Work Order Activity Timeline (WO-011)
- [ ] Edit work order modal loads activity timeline from `GET /work-orders/:id/activity`.
- [ ] Timeline shows created/started/completed/due/SLA events only when underlying date fields exist (no fake rows).
- [ ] Linked facility issue summary appears when work order was created from an issue bridge.
- [ ] Cross-tenant work order activity returns 404; cross-tenant linked issue never appears in timeline.
- [ ] Activity response does not expose raw Prisma relation payloads or secrets.
- [ ] Mobile: activity panel scrolls within edit modal; timeline remains readable.
- [ ] No photo upload or public file upload controls in activity panel.
- [ ] Activity fetch failure shows unavailable message; edit/save actions still work.

## 22) Facility Issue Room Linkage (BUILD-005)
- [ ] Existing cleaning issue create without `roomId` still works (`/cleaning/issues`).
- [ ] API accepts optional same-tenant `roomId` on POST `/cleaning/issues`.
- [ ] Cross-tenant `roomId` returns safe validation error.
- [ ] PATCH can set/clear optional `roomId` for authorized roles.
- [ ] List response includes flat room summary fields (`roomName`, `floorId`, `buildingId`, `propertyId`) when linked.
- [ ] List response does not expose raw Room Prisma relation payload.
- [ ] Optional `category` does not break old records (null category allowed).
- [ ] Existing cleaning issue UI still loads and submits without room selector.
- [ ] `/facilities` hierarchy UI unchanged.

## 21) Facility Hierarchy UI (BUILD-004)
- [ ] ADMIN can create property → building → floor → room chain via `/facilities`.
- [ ] FACILITY_MANAGER can create/update/deactivate hierarchy records.
- [ ] BUILDING_SUPERVISOR sees hierarchy read-only (no create/edit/deactivate buttons).
- [ ] CLEANER does not see Facilities in navigation or command palette.
- [ ] Mobile: hierarchy breadcrumbs and tables remain usable (scroll/stack).
- [ ] Empty state shows “No facilities created yet” with create CTA for manage roles only.
- [ ] No delete action in UI; deactivate uses ConfirmDialog.
- [ ] Action Center “Open facility hierarchy” navigates to `/facilities`.
- [ ] FACILITY_MANAGER post-login redirect lands on `/facilities`.
- [ ] API create payloads from web client do not include `tenantId`.
- [ ] No new native browser dialogs introduced in touched files.
