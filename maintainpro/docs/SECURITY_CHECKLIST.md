# Security Checklist

Review before production cutover. Backend RBAC is authoritative; frontend checks are UX only.

## Authentication & session

| Control | Status | Location / notes |
|---------|--------|------------------|
| JWT access + refresh | ✅ | `auth.service.ts`, separate secrets |
| Refresh token rotation | ✅ | Old token revoked on refresh |
| Refresh in HttpOnly cookie | ✅ | `auth.controller.ts` |
| Access token in localStorage (web) | ⚠️ | XSS risk — CSP mitigates; documented in `auth-storage.ts` |
| CSRF on cookie refresh/logout | ✅ | Double-submit cookie + `X-CSRF-Token` header |
| CORS allows CSRF header | ✅ | `main.ts` (fixed 2026-06-15) |
| Login lockout | ✅ | `auth-login-lockout.spec.ts` |
| Password hashing (bcrypt) | ✅ | Auth service |
| Session expiry handling | ✅ | API interceptor + web redirect; see UAT-004 manual idle test (OPERATOR-OWNED) |
| Logout clears storage | ✅ | `clearAuthSession()` |
| Throttling on auth routes | ✅ | `@Throttle` on login/register/refresh |
| Logout all sessions | 📋 | Roadmap — refresh token family revocation partial |

## Authorization

| Control | Status | Notes |
|---------|--------|-------|
| Global JwtAuthGuard | ✅ | `app.module.ts` |
| TenantContextGuard | ✅ | `X-Tenant-Id` enforcement |
| RolesGuard | ✅ | `@Roles()` |
| PermissionsGuard | ✅ | DB fallback + aliases |
| Tenant isolation in services | ✅ | Tests: `*-tenant-isolation.spec.ts` |
| Swagger disabled in prod | ✅ | Unless `SWAGGER_ENABLED` + basic auth |

## Transport & headers

| Control | Status | Notes |
|---------|--------|-------|
| Helmet (API) | ✅ | `main.ts` |
| CSP (web) | ✅ | `next.config.mjs` |
| HSTS (web) | ✅ | `next.config.mjs` |
| X-Frame-Options / frame-ancestors | ✅ | DENY |
| Referrer-Policy | ✅ | strict-origin-when-cross-origin |
| Permissions-Policy | ✅ | Restricts camera/mic by default |
| CORS exact origins (prod) | ✅ | No wildcard with credentials |

## Data protection

| Control | Status | Notes |
|---------|--------|-------|
| Env validation at boot | ✅ | `env.validation.ts` |
| Secrets not in repo | ✅ | `.env` gitignored |
| Admin DTO allowlists | ✅ | Admin user/tenant/invitation APIs |
| Audit on sensitive mutations | ✅ | Prisma middleware + domain audit |
| File upload restrictions | ✅ | Evidence MIME/size limits |
| Sensitive fields excluded from logs | ⚠️ | Review new log statements in PRs |

## Integration security

| Control | Status | Notes |
|---------|--------|-------|
| Mock modes blocked in production | ✅ | Email/SMS/push/ERP |
| Notification UAT allowlist | ✅ | `NOTIFICATION_UAT_*` env |
| ERP read-only by default | ✅ | Apply gated separately |
| WebSocket auth | ✅ | Gateway JWT + tenant rooms |

## Operational

| Control | Status | Notes |
|---------|--------|-------|
| Readiness endpoint protected | ✅ | `readiness-guard.ts` |
| Rate limiting | ✅ | Nest Throttler |
| Health does not leak secrets | ✅ | Sanitized readiness messages |
| Backup replication | ✅ | Outbox mode documented |
| Sentry / APM | 📋 | Document env hook; not wired by default |

## SECURITY_OFFICER

| Control | Status |
|---------|--------|
| Role in Prisma enum | ✅ |
| Seeded with gate permissions | ✅ |
| Gate endpoints permission-gated | ✅ |
| Override audited | ✅ |

## Pre-go-live verification

```bash
npm run test --workspace @maintainpro/api
npm run smoke:deploy   # with smoke credentials
```

Manual: invalid login, session expiry, cross-tenant 403, admin console permission state.

## Known residual risks

1. Access JWT in localStorage (web) — prefer future cookie-only access token
2. No WAF/rate-limit at edge — consider Cloudflare rules
3. Atlas credentials used during UAT — rotate post-UAT
4. Playwright traces may capture form values — do not commit `test-results/`

Legend: ✅ implemented · ⚠️ partial / accepted risk · 📋 roadmap
