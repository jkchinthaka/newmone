# MaintainPro Deployment Environment Checklist

## Core Environment
- [ ] `NODE_ENV` is set correctly (`production` for production deployments).
- [ ] `DATABASE_URL` / primary database configuration is valid and reachable.
- [ ] JWT secrets are configured (`JWT_SECRET` or both `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`).
- [ ] `ALLOW_MOCK_IN_PRODUCTION` is intentionally set (`false` by default).

## Auth Cookie + CSRF Hardening (SEC-010)
- [ ] Auth cookies are configured with secure production settings (`httpOnly`, `secure`, `sameSite` policy aligned with deployment topology).
- [ ] CSRF token header forwarding is enabled from web client to API (`x-csrf-token`).
- [ ] Refresh/logout cookie flows are validated end-to-end after deploy.

## Integration Mode Controls (SEC-013)
- [ ] `ERP_MODE` is set to one of: `disabled | mock | live`.
- [ ] `BILLING_MODE` is set to one of: `disabled | mock | live`.
- [ ] `EMAIL_MODE` is set to one of: `disabled | live`.
- [ ] `SMS_MODE` is set to one of: `disabled | mock | live`.
- [ ] `PUSH_MODE` is set to one of: `disabled | mock | live`.
- [ ] `STORAGE_MODE` is set to one of: `local | r2 | s3 | minio | cloudinary`.
- [ ] Production does not run mock modes unless explicitly approved with `ALLOW_MOCK_IN_PRODUCTION=true`.

## Live Integration Credentials (When Corresponding Mode=live)
- [ ] ERP live: `ERP_API_URL`, `ERP_API_KEY`.
- [ ] Billing live: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- [ ] Email live: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- [ ] SMS live: `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`.
- [ ] Push live: `PUSH_PROVIDER_API_URL`, `PUSH_PROVIDER_API_KEY`.
- [ ] Storage `cloudinary`: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- [ ] Storage `minio`: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`.

## Redis and Bull Queue Requirements
- [ ] `REDIS_URL` points to a reachable Redis instance when queues are expected.
- [ ] `REDIS_REQUIRED_FOR_READINESS=true` in environments where queue health must gate readiness.
- [ ] `REDIS_REQUIRED_IN_PRODUCTION=true` unless production queueing is explicitly de-scoped.
- [ ] Notification queue worker is active (`notifications` queue via Bull processor).

## Degraded / Disabled Mode Expectations
- [ ] If Redis is intentionally disabled, set:
  - `REDIS_URL=""`
  - `REDIS_REQUIRED_FOR_READINESS=false`
  - `REDIS_REQUIRED_IN_PRODUCTION=false` (production only when formally approved)
- [ ] Confirm system health shows Redis/queue as `disabled` (not silently `operational`).
- [ ] Confirm direct notification fallback behavior is acceptable for the environment.
- [ ] Confirm system health shows integration mode states correctly (`mock`, `misconfigured`, `disabled`, etc.).

## Security and Observability
- [ ] Readiness access is restricted (admin JWT and/or `READINESS_API_KEY` route).
- [ ] Swagger production access controls are configured (`SWAGGER_ENABLED`, user, password) or intentionally disabled.
- [ ] Logs are collected and monitored for queue-health errors and recovery events.
- [ ] Health/readiness responses are checked to confirm secrets are redacted (no tokens/passwords/connection strings).
