# Notification Provider Setup

## Goal

Prepare Email/SMS production delivery safely without sending real messages until credentials and approval steps are complete.

## Readiness states

| State | Meaning |
|---|---|
| `disabled` | Channel intentionally disabled (`EMAIL_MODE=disabled` / `SMS_MODE=disabled`) |
| `not_configured` | Live mode selected but required env vars are absent |
| `misconfigured` | Partial credentials or production mock block |
| `configured` | Provider settings present and allowed for the environment |

API surfaces:

- `GET /api/notifications/readiness` (ADMIN / SUPER_ADMIN)
- `GET /api/health/readiness` → `operationalFoundations.notifications`
- `GET /api/notifications/templates/samples` (render-only samples, no send)

## Required environment variables

### Email (SMTP)

| Variable | Required when `EMAIL_MODE=live` |
|---|---|
| `EMAIL_MODE` | `disabled` or `live` |
| `SMTP_HOST` | Yes |
| `SMTP_PORT` | Yes |
| `SMTP_USER` | Yes |
| `SMTP_PASS` | Yes (secret — store in platform secret manager) |
| `SMTP_FROM` | Yes |
| `SMTP_SECURE` | Optional |

### SMS

| Variable | Required when `SMS_MODE=live` |
|---|---|
| `SMS_MODE` | `disabled`, `mock`, or `live` |
| `SMS_API_URL` | Yes (live) |
| `SMS_API_KEY` | Yes (live) |
| `SMS_SENDER_ID` | Yes (live) |

Production mock safety:

- `SMS_MODE=mock` is blocked in production unless `ALLOW_MOCK_IN_PRODUCTION=true`
- Same rule applies to other mock integrations via env validation

## Approval checklist

1. Confirm legal/compliance approval for email/SMS content and recipient lists
2. Verify sender domain / SMS sender ID with provider
3. Set secrets only in deployment platform (Render/Vercel/Docker secrets) — never commit `.env`
4. Set `EMAIL_MODE=live` / `SMS_MODE=live` only after credentials validate
5. Hit `/api/notifications/readiness` and confirm `configured`
6. Review template samples at `/api/notifications/templates/samples`
7. Send controlled UAT messages in staging first (future step — not part of this foundation sprint)

## Built-in templates (render-only)

Foundation templates (no auto-send):

- `critical_facility_issue`
- `work_order_from_issue`
- `overdue_sla_alert`
- `invitation_created`

Templates never embed secrets. They only include business context and action URLs derived from `FRONTEND_URL`.

## Operational notes

- Missing provider config must not crash API boot
- Disabled providers report honest readiness warnings, not fake success
- Real dispatch still requires live mode + valid credentials + future send approval workflow

## Tests

- `apps/api/test/notification-readiness.spec.ts`
- Existing dispatch safety tests remain authoritative for SEC-013 behavior
