# Smart Operations / Product Excellence Roadmap

Last updated: 2026-06-13 (SMART-OPS-001 sprint)

## Purpose

This document tracks strategic “smart operations” capabilities that make MaintainPro feel enterprise-grade without blocking the BUILD-002+ facility implementation sequence. It complements `BUILDING_FACILITY_MODULE_PLAN.md` and `MAINTAINPRO_PRODUCTION_TODO.md`.

## Delivered in SMART-OPS-001

| Feature | Status | Location | Notes |
|---|---|---|---|
| Smart Operations Action Center | DONE | `/action-center`, `components/action-center/*`, `lib/action-center*.ts` | Role-aware priorities from existing APIs only; no fake metrics |
| Manager Morning Briefing | DONE | `components/dashboard/morning-briefing.tsx` | Compact dashboard card for admin/management/inventory; links to Action Center |
| QR readiness foundation | DONE | `lib/qr-readiness.ts`, `test/qr-readiness.spec.ts` | Safe internal payload encode/parse; no public routes yet |
| Evidence timeline foundation | DONE | `components/ui/evidence-timeline.tsx` | Read-only reusable timeline; no upload/storage |
| Notification UAT staged sends (NOTIFY-002) | DONE | UAT endpoints + `/system-health` panel | Allowlist + dual env flags; no bulk/auto production sends |
| ERP read-only stock sync (ERP-002) | DONE | Bileeta adapter + dry-run endpoints + `/system-health` panel | Read-only GET; apply disabled by default; no ERP writes |
| Work order evidence storage foundation (WO-012) | DONE | EvidenceAttachment + WO editor evidence panel | Metadata-only; uploads disabled by default; no MongoDB bytes |
| Facility post-login route fix | DONE | `lib/role-redirect.ts` | FACILITY_MANAGER / BUILDING_SUPERVISOR → `/facilities` |
| Facility hierarchy API (BUILD-003) | DONE | `modules/facilities/*`, `/api/facilities/*` | Tenant-scoped CRUD; enables Action Center/QR follow-ups without fake data |
| Facility hierarchy web UI (BUILD-004) | DONE | `/facilities`, `components/facilities/*`, `lib/facilities*.ts` | Drill-down browser; Action Center links live; issue migration deferred |

## Delivered in BUILD-005 (2026-06-13)

- Nullable `FacilityIssue.roomId` with same-tenant Room validation
- Optional `FacilityIssueCategory` enum on issues
- Allowlisted issue API responses with room hierarchy summary fields
- Backward-compatible cleaning issue create/list/update (`/cleaning/issues`)
- **Deferred:** issue UI room selector, CleaningLocation backfill, WO bridge, QR public routes, photo upload, dashboards

## Delivered in BUILD-006 (2026-06-13)

- `/cleaning/issues` optional category + room hierarchy selector on create
- Inline edit for room/category with clear-room support
- Legacy CleaningLocation selector preserved; facilities API failure does not block create

## High-value future features (ordered)

### Phase A — Facility & issue intelligence (BUILD sequence)

1. **BUILD-003** — Facility hierarchy API — **DONE** (`/api/facilities/*`)
2. **BUILD-004** — Facility hierarchy web UI — **DONE** (`/facilities`)
3. **BUILD-005** — FacilityIssue room linkage foundation — **DONE** (nullable `roomId`, category)
4. **BUILD-006** — Issue reporting UI + room selector — **DONE** (`/cleaning/issues`)
5. **BUILD-007** — Issue → work order bridge — **DONE** (`POST /cleaning/issues/:id/create-work-order`)
6. **BUILD-008** — Authenticated QR issue reporting — **DONE** (`/qr/report-issue`)
7. **BUILD-009** — Facility dashboard + reporting — **DONE** (`/facilities/reports`)
8. **OPS-002** — SLA/aging heatmap — **DONE** (`/facilities/reports/aging`)
9. **OPS-003** — Duplicate issue detection — **DONE** (`POST /cleaning/issues/duplicate-check`)

### Phase B — Operations excellence

7. **Manager morning briefing v2** — Scheduled digest (email/in-app) once NOTIFY-001 is production-ready
8. **Technician mobile quick actions** — Assign/start/complete from mobile offline queue
9. **Inventory low-stock → WO spare parts link** — Auto-suggest parts on WO creation from stock signals
10. **Evidence timeline v2** — Photo events when Cloudinary/MinIO storage is approved (WO-011 derived timeline done)

### Phase C — External intake & integrations

11. **Public/internal repair request portal** — Authenticated requester flows first; public QR intake after security review
12. **NOTIFY-002** — Staged production email/SMS UAT sends (foundation done in NOTIFY-001)
13. **ERP-002** — Live Bileeta inventory read sync (foundation done in ERP-001) — **DONE** (read-only dry-run + guarded apply)

## QR room/building reporting plan

- **Payload contract:** `MaintainProQrPayload` in `lib/qr-readiness.ts` (`v`, `type`, `entityId`, optional `tenantId`, `label`, `createdAt`)
- **Supported types:** `property`, `building`, `floor`, `room`, `asset`, `work-order`, `facility-issue`
- **Security rules:** No auth tokens, secrets, invitation links, or private PII in QR payloads
- **BUILD-005 scope:** Generate QR labels for hierarchy entities; scan resolves to authenticated issue-report form prefilled with entity context
- **Deferred:** Public unauthenticated repair intake (requires rate limiting, CAPTCHA, tenant routing review)

## Photo evidence timeline plan

- **Foundation (done):** `EvidenceTimeline` component + `mapWorkOrderDatesToEvidenceTimeline()` helper
- **WO-011 (done):** Derived work order activity endpoint + edit-modal Activity & evidence panel with linked facility issue context
- **Next:** Photo evidence events when approved Cloudinary/MinIO production configuration is available
- **Storage:** Deferred until approved Cloudinary/MinIO production configuration
- **No fake data:** Timeline renders only when underlying records include dated fields

## Duplicate issue detection plan

- Compare open issues by `roomId` + category + title similarity (BUILD-005 dependency)
- Surface duplicates in Action Center and facility issue list
- Admin-configurable time window (default 24h)

## SLA/aging heatmap plan

- Aggregate overdue work orders and open facility issues by building/floor/assignee
- Read-only dashboard widget for managers; no new scoring algorithms until SLA engine (WO-004) exists

## Email/SMS notification readiness

- Queue health and integration modes already exposed in system health (SEC-012/SEC-013)
- Production rollout tracked as NOTIFY-001
- Action Center may surface “notifications degraded” once NOTIFY-001 completes

## ERP integration readiness

- ERP sync provider exists with explicit mode gating (`ERP_MODE`)
- No production ERP mutation in smart ops sprint
- Future: low-stock → draft PO suggestion (read-only) before ERP-001 posting

## Intentionally deferred (this sprint)

| Item | Reason |
|---|---|
| New Action Center backend endpoints | Existing dashboard/work-order/inventory/health/admin APIs sufficient |
| Facility hierarchy UI | **DONE** — `/facilities` (BUILD-004) |
| Public QR scan routes | Security review + BUILD-008 |
| Photo upload/evidence storage | No approved storage integration in scope |
| AI/IoT/paid external APIs | Explicitly out of scope |
| Fake KPIs or demo metrics | Violates production honesty policy |
| Payment/billing features | Out of scope |
| ERP posting | Out of scope |

## Exact next implementation order

1. **ERP-002** — Live Bileeta read-only stock sync (after API contract approved)
2. **DEPLOY-002** — Production cutover execution (manual, checklist-driven)

## Verification notes (SMART-OPS-001)

- Action Center uses `fetchWorkOrders`, inventory APIs, `/health/readiness`, `/admin/invitations`, `/cleaning/issues` only
- Failed connections show “Not connected yet” — never fabricated counts
- Admin sections (system health, invitations) hidden from non-admin roles
- QR helper tests reject secrets and unsupported types
