# Mobile Notifications & Push

Phase 4 slice for MaintainPro Mobile V2.

## API contracts (Nest)

| Operation | Endpoint | Auth |
|-----------|----------|------|
| List alerts | `GET /notifications?status=ALL\|READ\|UNREAD&page=&pageSize=` | JWT (self) |
| Mark read | `PATCH /notifications/:id/read` | JWT (self) |
| Mark all read | `PATCH /notifications/mark-all-read` | JWT (self) |
| Register device | `POST /notifications/push/devices` | JWT (self) |
| Unregister device | `DELETE /notifications/push/devices/:installationId` | JWT (self) |

## Mobile implementation

- **Alerts tab** (`/alerts`): paginated list, read/unread filter, mark-all-read, pull-to-refresh.
- **Shell badge**: unread count from `GET /notifications?status=UNREAD&pageSize=1` meta total.
- **FCM registration**: after login via `NotificationBootstrap`; skipped when Firebase is not configured.
- **Logout cleanup**: best-effort `DELETE /notifications/push/devices/:installationId`.
- **Deep links**: web `deepLink` paths and `referenceType`/`referenceId` mapped to go_router routes. Push payloads use opaque IDs only — no JWT or secrets in FCM data.

## Blocked / deferred

- Push delivery requires Firebase + server push provider configuration (noop/mock in local dev).
- Notification action buttons (`POST /notifications/:id/actions`) not exposed on mobile yet.
- WebSocket live updates not wired; list is pull/refresh based.

## Tests

- `test/features/notifications/` — widget + deep-link unit tests.
