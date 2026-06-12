# MaintainPro Manual QA Checklist

## 1) Login
- [ ] Login with valid work email/password succeeds.
- [ ] Invalid credentials return generic error message (no account enumeration).
- [ ] Login has no public demo credentials in production mode.
- [ ] Refresh-token cookie + CSRF flow works (`/auth/refresh` requires valid CSRF token/header pairing).
- [ ] Logout clears auth cookies/session and prevents token reuse.
- [ ] Forgot password flow always returns generic accepted message.
- [ ] Reset password token is one-time use and expires correctly.
- [ ] Account lockout behavior works after repeated failed attempts.

## 2) Role-Based Routing
- [ ] SUPER_ADMIN is routed to admin workspace.
- [ ] ADMIN/MANAGER are routed to operational dashboard.
- [ ] TECHNICIAN/CLEANER/SECURITY roles route to role-specific pages.
- [ ] Unauthorized route access is blocked by role/permission checks.
- [ ] Sidebar/menu items match role permissions.

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

## 13) Vendor Portal
- [ ] Vendor authentication is isolated from internal tenant users.
- [ ] Vendor sees only assigned jobs/documents/invoices.
- [ ] Vendor job status updates sync to internal workflows.
- [ ] Invoice submission/approval path is auditable.
- [ ] Vendor performance metrics update from real activity.
