# MaintainPro Mobile V2 — Progress

## Control block

| Field | Value |
|---|---|
| AUTHORITATIVE_MAIN_SHA | `2fd697e004da8524b6348c1ad2d33411a873a2a8` |
| BRANCH | `feature/mobile-v2` |
| CURRENT_PHASE | Phase 1 foundation + WO vertical slice (started) |
| LATEST_COMMIT_SHA | _(updated after each push)_ |
| DRAFT_PR | _(pending first docs+code push)_ |
| PRODUCTION_MUTATION | NO |
| PRODUCTION_DEPLOYMENT | NO |

## Completed

- [x] Fetch `origin/main`, record SHA, create/push `feature/mobile-v2`
- [x] Phase 0 source discovery (web routes, nav, Nest modules, auth, WO, gate, FG, notifications, health)
- [x] Architecture docs under `docs/mobile/`
- [x] Parity matrix (86 rows) from source
- [x] OpenAPI blocker documented in `contracts/README.md`
- [x] Archive V1 mobile to `lib_legacy_v1/`
- [x] Flutter V2 scaffold: design system, flavors, splash, login, session, adaptive shell
- [x] Phone tabs Home/Tasks/Scan/Alerts/More + tablet NavigationRail
- [x] Role-aware Home, Tasks, Module Hub, Search, Profile, Settings, Diagnostics, Drafts, Sync
- [x] Dio client + secure tokens + tenant header + refresh single-flight
- [x] RBAC nav policy mirrored from web roles
- [x] Drift outbox foundation + sync controller
- [x] Work Orders list/detail + start/complete (online) via real API paths
- [x] `flutter analyze` clean; `flutter test` 12/12

## Incomplete / next

- [ ] Wire Action Center queues to `GET /api/work-orders/queues*`
- [ ] Evidence upload pipeline end-to-end
- [ ] Additive `/api/mobile/bootstrap` + action-center (Nest, non-breaking)
- [ ] FG CL30 recorder/supervisor/QA vertical
- [ ] Gate In/Out vertical
- [ ] FCM registration against `/api/notifications/push/devices`
- [ ] Foreground Socket.IO for notifications
- [ ] Export `contracts/openapi.json` via safe dev bootstrap
- [ ] Expand parity rows to every hidden App Router leaf with endpoint mapping

## Parity

| Metric | Count |
|---|---|
| Rows total | 86 |
| Completed (`done`) | 5 |
| Partial | ~6 |
| Hub/UI/foundation | majority |
| Planned / API gaps | remaining |

See `MOBILE_PARITY_MATRIX.md`.

## API gaps

1. No `/api/mobile/*` aggregation endpoints yet
2. No static OpenAPI export without API boot
3. Work-order mutations lack HTTP Idempotency-Key enforcement (inventory has it)
4. FG recording not in Nest — SSO + Django/Next only
5. Gate is on `/api/vehicles/:id/gate-*` (no dedicated gate controller)

## Known blockers

- None blocking local foundation work
- OpenAPI file generation blocked without running Nest (documented)

## Security blockers

- None open for current milestone (no secrets committed; prod untouched)

## Sync blockers

- Idempotency gap on WO critical mutations (documented; online-required policy mitigates)

## Test results (latest)

```
flutter analyze → No issues found
flutter test → 12/12 passed
```

## Next exact action

1. Commit docs baseline + Flutter V2 foundation (split commits)
2. Push `feature/mobile-v2`
3. Open DRAFT PR → `main`
4. Continue WO queues + evidence + deepen vertical slice
