# MaintainPro Mobile V2 — V1 Fast-Track Status

Last updated: 2026-08-31 (branch `feature/mobile-v2`)

## V1_STATUS=PARTIAL — core field flows implemented; live FG UAT externally blocked

| Area | Status |
|------|--------|
| AUTH | PASS — Nest JWT, same users as Web |
| HOME_TASKS | PASS |
| WORK_ORDERS | PASS |
| GATE | PASS |
| FLEET_CORE | PARTIAL — unassign + enterprise health read added; assign UI deferred |
| ASSETS_PM | PASS (read + PM schedules) |
| INVENTORY | PARTIAL — safe read scope; mutations BLOCKED_SERVER_SAFETY |
| FACILITIES | PARTIAL — read + issue online submit; cleaning/meter write blocked |
| COMPLIANCE | PARTIAL — read + accident report online |
| NOTIFICATIONS | PARTIAL — list, badge, FCM registration (Firebase config optional) |
| FCM | PARTIAL — device register/unregister wired; delivery needs Firebase + push provider |
| CAMERA_SCAN | PARTIAL — camera + `POST /operations/scan-lookup` |
| FG_CL18 | IMPLEMENTED — BFF + Flutter recorder (vehicle + occurrence) |
| FG_CL24 | IMPLEMENTED — BFF + Flutter recorder (date-only open) |
| FG_CL30 | IMPLEMENTED |
| FG_CL39 | IMPLEMENTED — BFF + Flutter recorder (room + date) |
| FG_CL30_LIVE_UAT | BLOCKED_EXTERNAL_CONFIG — `FG_API_INTERNAL_URL` |
| DRAFT_SYNC | PARTIAL — local drafts + sync center; no auto-replay without idempotency |
| RBAC | PASS — widget + policy tests |
| TENANT_ISOLATION | PARTIAL — API enforced; shared-device tests partial |
| ANDROID_VISUAL_UAT | PARTIAL — emulator boot verified; full role walkthrough pending |
| ANDROID_RELEASE_READINESS | PARTIAL — debug signing; applicationId still `com.example.*` |

## DEFERRED_TO_V1_1

Farm, advanced reports, Admin Console, Billing, live Fleet GPS map, AI Assistant, desktop management screens.

## SERVER_BLOCKERS

- Inventory stock mutations (idempotency/concurrency gaps)
- Cleaning completion / meter write (no proven safe contract)
- Facility/accident outbox auto-replay (no server idempotency)

## EXTERNAL_BLOCKERS

- FG live Nest↔Django UAT (`FG_API_INTERNAL_URL` non-prod)
- FCM delivery (Firebase + push provider credentials)

## Tests

113 Flutter PASS / 0 failed (2026-08-31)
