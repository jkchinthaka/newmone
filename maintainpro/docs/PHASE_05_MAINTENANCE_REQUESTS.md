# Phase 5 — Maintenance Request & Triage Engine

**Branch:** `maintainpro/phase-05-requests-triage`  
**Baseline:** `maintainpro/phase-04-universal-assets` @ `a50b6b9624b1a0f281e20095badf453d7ab02fdb`  
**Date:** 2026-09-15

## Objective

One company-wide **Maintenance Request** engine for reporting problems, supervisor triage, and idempotent conversion to a Work Order. Requesters do not create fully planned Work Orders directly.

## Canonical model

`MaintenanceRequest` is the primary maintenance problem record.

| Concern | Design |
|---------|--------|
| Numbering | `MR-{year}-{#####}` via max-sequence + P2002 retry (not bare `count()+1`) |
| Placement | At least one of `assetId` / `functionalLocationId` (server-validated, tenant-scoped) |
| Snapshot | Server-built `contextSnapshot` at report time (asset tag/name, site, FL path, domain, department) |
| Priority | Reuses existing `Priority` enum (LOW/MEDIUM/HIGH/CRITICAL) |
| Categories | Tenant-scoped `RequestProblemCategory` (symptoms, not failure/cause/remedy codes) |
| Status | `NEW → UNDER_REVIEW → APPROVED → CONVERTED_TO_WO` (+ `REJECTED`, `CANCELLED`) |
| History | `MaintenanceRequestHistory` (+ AuditLog for important actions) |
| Evidence | Existing `EvidenceAttachment` with optional `maintenanceRequestId` |
| WO link | `workOrderId` unique on request; conversion idempotent |
| Legacy | `legacySourceType` / `legacySourceId` for FacilityIssue bridge |

## Lifecycle (enforced in service)

- NEW → UNDER_REVIEW | CANCELLED  
- UNDER_REVIEW → APPROVED | REJECTED | CANCELLED  
- APPROVED → CONVERTED_TO_WO  
- Terminal: REJECTED, CANCELLED, CONVERTED_TO_WO (no reopen in Phase 5)

## API

Base: `/maintenance-requests`

- `POST /` create (idempotencyKey supported)
- `GET /` list (pagination + filters + `mine` + `triageQueue`)
- `GET /:id`, `GET /:id/history`
- `GET /:id/duplicate-candidates`, `GET /:id/repeat-history`
- Actions: `start-review`, `triage`, `approve`, `reject`, `cancel`, `mark-duplicate`, `convert-to-work-order`
- `GET /problem-categories`, `POST /problem-categories/seed`

## Permissions

`maintenance_requests.create|view_own|view_all|triage|approve|reject|convert|cancel_own|cancel_any`  
Aliases map legacy `facility_issues.*` / cleaning report permissions during transition.

## UI

- `/requests` — My Requests / Triage Queue (cards mobile, table desktop)
- `/requests/new` — mobile-first Report Issue (QR / search asset / location-only)
- `/requests/[id]` — detail + supervisor actions
- `/qr/report-issue` redirects to `/requests/new` (query preserved)

## Offline / PWA

- Queues `MAINTENANCE_REQUEST_CREATE` text payload with idempotency key when offline
- Does **not** claim offline photo upload
- UI never shows Submitted until server confirms

## Work Order conversion

- Only APPROVED; calls `WorkOrdersService.create` then patches `siteId` / `functionalLocationId`
- Retries return existing WO when `workOrderId` already set
- Minimal WO compatibility fields added for Phase 6 (`siteId`, `functionalLocationId`, reverse MR relation)

## FacilityIssue disposition

Retained. Not deleted. Bridge/migration documented in `PHASE_05_REQUEST_MIGRATION.md`. SupportTicket remains out of scope (IT helpdesk).

## Phase 6 boundary

Phase 5 owns request + triage + convert boundary only. Full WO lifecycle (planning, labour, RCA, verification, reopen) is Phase 6.

## Phase 8–14

Not merged, cherry-picked, or rewritten.
