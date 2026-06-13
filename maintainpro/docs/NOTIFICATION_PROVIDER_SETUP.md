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
- `POST /api/notifications/uat/email-test` (ADMIN / SUPER_ADMIN, staged UAT only)
- `POST /api/notifications/uat/sms-test` (ADMIN / SUPER_ADMIN, staged UAT only)

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

### Staged UAT controls (NOTIFY-002)

| Variable | Purpose |
|---|---|
| `NOTIFICATION_UAT_ENABLED` | Master switch for UAT workflow (`false` by default) |
| `NOTIFICATION_REAL_SENDS_ENABLED` | Allows real provider dispatch for allowlisted recipients only (`false` by default) |
| `NOTIFICATION_UAT_ALLOWED_RECIPIENTS` | Comma-separated allowlist of email addresses and/or E.164-style phone numbers |

Safety rules:

- Both UAT flags must be `true` before any real send is attempted
- `NOTIFICATION_REAL_SENDS_ENABLED=true` requires `NOTIFICATION_UAT_ENABLED=true` (env validation enforced)
- Recipients not in the allowlist are rejected
- Provider secrets are never returned in API responses or UAT result payloads
- No bulk send endpoints are provided

## Approval checklist

1. Confirm legal/compliance approval for email/SMS content and recipient lists
2. Verify sender domain / SMS sender ID with provider
3. Set secrets only in deployment platform (Render/Vercel/Docker secrets) — never commit `.env`
4. Set `EMAIL_MODE=live` / `SMS_MODE=live` only after credentials validate
5. Hit `/api/notifications/readiness` and confirm `configured`
6. Review template samples at `/api/notifications/templates/samples`
7. Configure UAT allowlist and enable UAT flags only in staging
8. Send one allowlisted UAT email/SMS and record result before production cutover

## Staged UAT procedure

1. Set provider credentials (`EMAIL_MODE=live` with SMTP vars; optional `SMS_MODE=live` with approved HTTP SMS gateway)
2. Set `NOTIFICATION_UAT_ALLOWED_RECIPIENTS` to approved test addresses only (example: `ops-uat@company.com,+94771234567`)
3. Set `NOTIFICATION_UAT_ENABLED=true`
4. Set `NOTIFICATION_REAL_SENDS_ENABLED=true`
5. Restart API and confirm `/api/notifications/readiness` shows `uat.realSendsEnabled=true`
6. Use admin UI at `/system-health` (Notification UAT card) or API:

```bash
curl -X POST "$API_BASE/notifications/uat/email-test" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"recipient":"ops-uat@company.com","templateKey":"critical_facility_issue"}'
```

7. Verify masked recipient + safe status in response (`sent`, `blocked`, `rejected`, `not_configured`, or `mock`)
8. Disable UAT flags after sign-off unless staging remains active

SMS note:

- If `SMS_MODE=disabled`, UAT SMS returns `not_configured` safely
- If `SMS_MODE=mock`, UAT SMS returns `mock` without external HTTP calls
- Live SMS UAT requires approved `SMS_API_URL` / `SMS_API_KEY` / `SMS_SENDER_ID`

## Built-in templates (render-only / UAT)

Foundation templates (no auto-send):

- `critical_facility_issue`
- `work_order_from_issue`
- `overdue_sla_alert`
- `invitation_created`

Templates never embed secrets. They only include business context and action URLs derived from `FRONTEND_URL`.

## Operational notes

- Missing provider config must not crash API boot
- Disabled providers report honest readiness warnings, not fake success
- Real dispatch still requires live mode + valid credentials + UAT flags + allowlisted recipient
- Automatic production event notifications remain out of scope for NOTIFY-002

## Tests

- `apps/api/test/notification-readiness.spec.ts`
- `apps/api/test/notifications-uat-send.spec.ts`
- `apps/api/test/notification-provider-safety.spec.ts`
- Existing dispatch safety tests remain authoritative for SEC-013 behavior
