# BFF CSRF Exemption Table

Source of truth: `apps/web/lib/bff-auth.ts` (`BFF_CSRF_EXEMPTIONS`).

Mutations **not** listed require matching `maintainpro_csrf` cookie and `X-CSRF-Token` header (CSRF-001 / CSRF-002 / CSRF-003).

Phase 2 closeout review: no exemptions were added or removed. Each row was re-validated against source throttling and auth requirements.

| Route (relative to `/api/backend/`) | Match | Reason | Auth | Rate limit | Replay / idempotency | Abuse risk | Test evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `auth/login` | exact | No session yet; CSRF cookie issued on success | Public | Nest `@Throttle` 5/min | N/A (issues new session) | Credential stuffing | CSRF-001 / BFF login tests |
| `auth/register` | exact | Public registration bootstraps session | Public (if enabled) | Nest `@Throttle` 5/min | N/A | Spam registration | Invite-only preferred; exemption retained |
| `auth/forgot-password` | exact | Unauthenticated recovery start | Public | Nest `@Throttle` 5/min | Soft (email flood) | Email enumeration | CSRF exemption review |
| `auth/reset-password` | exact | One-time reset token authenticates action | Public + reset token | Nest `@Throttle` 5/min | Token single-use (service) | Token guessing | CSRF exemption review |
| `auth/invite/accept` | exact | Invite token authenticates before session | Public + invite token | Nest `@Throttle` 5/min | Invite single-use | Invite theft | CSRF exemption review |
| `auth/invite/verify` | exact | Read-only invite validation | Public + invite token | Nest `@Throttle` 10/min | Low | Low | CSRF exemption review |
| `billing/webhooks/` | prefix | Provider-signed webhooks cannot send browser CSRF | Provider signature | Provider + API verification | Provider event ids | Forged webhooks if signature fails | API signature tests; CSRF-003 |

**Not exempt:** `auth/logout`, `auth/refresh`, `tenants/:id/switch`, work-orders, inventory, purchasing, and other business mutations.

**E2E request-context rule (Phase 4B attempt 6):** After `loginViaUi`, authenticated BFF calls must use `page.request` / BrowserContext helpers so access/refresh/CSRF cookies are shared. The isolated Playwright `request` fixture is only for deliberately unauthenticated checks (for example CSRF-005 login exemption). Logout remains CSRF-protected.

**Decision:** No unnecessary exemptions identified for removal in this closeout. Expanding the list requires a P1 TODO with security review.