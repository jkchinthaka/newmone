# MaintainPro Manual QA Checklist

Status of each section reflects current (2026-06-12) feature maturity. Checklists for
features that don't exist yet are written as the target acceptance criteria — they will
be exercised once the corresponding TODO tasks are implemented.

---

## 1. Login

- [ ] Login page shows no demo/admin credentials in production build (SEC-001)
- [ ] Field labeled "Work Email" (not "Username"), no silent domain append (UX-003)
- [ ] Invalid credentials show generic error (no user-enumeration)
- [ ] 6th failed attempt within lockout window is blocked with generic message (SEC-004)
- [ ] Successful login redirects based on role, not hardcoded `/home` (UX-004)
- [ ] Refresh token persists across page reload via HttpOnly cookie, not localStorage (SEC-010)
- [ ] Deactivated user cannot log in or use an existing access token (SEC-009)

## 2. Role-based routing

- [ ] SUPER_ADMIN → `/admin/overview`
- [ ] ADMIN/MANAGER → `/dashboard`
- [ ] FACILITY_MANAGER → `/facility`
- [ ] TECHNICIAN → `/work-orders/my-jobs`
- [ ] CLEANER → `/cleaning/my-tasks`
- [ ] VENDOR → `/vendor/dashboard`
- [ ] Sidebar shows only items the current role/permission set allows (UX-006)
- [ ] Direct URL navigation to a disallowed route redirects/403s gracefully

## 3. Work order lifecycle

- [ ] Create work order (DRAFT/SUBMITTED) as REQUESTER/TECHNICIAN
- [ ] Approve/reject as supervisor (PENDING_APPROVAL → APPROVED/REJECTED)
- [ ] Assign technician (ASSIGNED)
- [ ] Start/pause/resume time tracking, capture delay reason
- [ ] Add parts — stock deducted, cost calculated, blocked if insufficient unless override
- [ ] Complete with note + actual hours + before/after photos (COMPLETED_PENDING_VERIFICATION)
- [ ] Supervisor verifies (VERIFIED) or requests rework (back to IN_PROGRESS)
- [ ] Requester confirms (CLOSED) or reopens with reason+photos (REOPENED)
- [ ] Activity timeline shows every transition with actor + timestamp
- [ ] AuditLog has entries for create/approve/assign/complete/verify/close

## 4. Building repair request (public portal)

- [ ] `/request?roomId=` loads with location pre-filled from QR
- [ ] Submitting creates a FacilityIssue with reference number
- [ ] `/request/track?ref=` shows status timeline without login
- [ ] Supervisor receives notification on submission
- [ ] Approved request converts to a Work Order, linked back to the FacilityIssue

## 5. Admin user management

- [ ] Create user, assign role/department/site
- [ ] Invite user via email (TenantInvitation), resend/revoke invite
- [ ] Bulk CSV import with dry-run preview
- [ ] Deactivate user with reason; deactivated user immediately loses access
- [ ] Force password reset
- [ ] View active sessions, revoke individual session and "logout all"
- [ ] Per-user audit timeline visible

## 6. File upload

- [ ] Upload image/PDF (within 10MB, allowed MIME types) to a work order/asset/document
- [ ] Reject disallowed file types/oversized files with clear error
- [ ] Uploaded file accessible via signed URL, not public-by-default
- [ ] Upload recorded in audit log
- [ ] Delete/replace file updates linked record

## 7. Mobile responsiveness

- [ ] Sidebar collapses to drawer below 1280px / hamburger on mobile
- [ ] Tables render as stacked cards below 768px
- [ ] No horizontal overflow on key pages (dashboard, work-orders, inventory) at 360px width
- [ ] Touch targets ≥44×44px on mobile action buttons
- [ ] PWA installs and caches recent work orders for offline view

## 8. Tenant isolation

- [ ] Tenant A user cannot see Tenant B's: utility meters/readings (SEC-007), fleet live map,
      work orders, assets, vehicles, inventory, vendors, budgets
- [ ] WebSocket events (notifications, fleet) only delivered to sockets in the correct
      `tenant-{tenantId}` room (SEC-011)
- [ ] Switching active tenant (X-Tenant-Id) immediately changes all list data, no stale
      cross-tenant cache
- [ ] Super-admin cross-tenant access is explicit and produces an AuditLog entry

## 9. Reports

- [ ] Each report respects tenant + role/permission filters
- [ ] Pagination/meta present on list-backed reports
- [ ] Export to PDF/XLSX includes logo, tenant name, date range, currency (LKR), timezone
- [ ] Heavy report generation runs via background job (Bull), not inline in request handler
- [ ] Drill-down from a dashboard KPI opens the correctly filtered list page

## 10. Notifications

- [ ] In-app notification appears in real time via authenticated WebSocket
- [ ] Email notification sent when SMTP configured; gracefully no-ops (logged) when not
- [ ] SMS notification sent when SMS_ENABLED; gracefully no-ops when not
- [ ] Push notification delivered to mobile device registered via DeviceToken
- [ ] Notification preferences per user (channel opt-in/out) respected

## 11. Vendor portal

- [ ] Vendor user logs in via separate vendor auth, sees only their own jobs/invoices
- [ ] Vendor cannot access any tenant-internal data beyond assigned jobs
- [ ] Vendor accepts job, updates progress, submits completion proof
- [ ] Internal user verifies vendor completion and approves invoice
- [ ] Vendor performance metrics (SLA compliance, rating) visible internally on `/vendors/[id]`
