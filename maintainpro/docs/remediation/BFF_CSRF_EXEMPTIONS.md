# BFF CSRF Exemption Table

Source of truth: `apps/web/lib/bff-auth.ts` (`BFF_CSRF_EXEMPTIONS`).

Mutations **not** listed require matching `maintainpro_csrf` cookie and `X-CSRF-Token` header (CSRF-001 / CSRF-002 / CSRF-003).

| Route (relative to `/api/backend/`) | Match | Reason | Auth requirement | Abuse risk | Test coverage |
| --- | --- | --- | --- | --- | --- |
| `auth/login` | exact | No session yet; CSRF cookie issued on successful login | Public | Credential stuffing — API throttling | CSRF-001 / BFF login tests |
| `auth/register` | exact | Public registration bootstraps a new session | Public (if enabled) | Spam registration — throttling / invite policy | Documented; invite-only preferred |
| `auth/forgot-password` | exact | Unauthenticated recovery start | Public | Email enumeration / flood — throttling | CSRF exemption review |
| `auth/reset-password` | exact | Tokenized recovery carries one-time reset token | Public with reset token | Token guessing — entropy + throttling | CSRF exemption review |
| `auth/invite/accept` | exact | Invite token authenticates before session exists | Public with invite token | Invite token theft — single-use tokens | CSRF exemption review |
| `auth/invite/verify` | exact | Read-only invite validation | Public with invite token | Low (verification only) | CSRF exemption review |
| `billing/webhooks/` | prefix | Provider-signed webhooks cannot send browser CSRF | Provider signature | Forged webhooks if signature check fails | CSRF-003; API signature tests |

**Not exempt (examples):** `auth/logout`, `auth/refresh`, `work-orders`, inventory mutations, purchasing approvals.
