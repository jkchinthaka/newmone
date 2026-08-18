# Security Runbook — Phase 19

## Controls in force

| Control | Where |
| --- | --- |
| HTTPS redirect / HSTS | `config/settings/production.py` |
| Secure / HttpOnly / SameSite cookies | base + production settings |
| CSP / Permissions-Policy / nosniff / Referrer-Policy | `SecurityHeadersMiddleware` |
| CSRF | Django middleware (enabled) |
| Brute-force | Account lockout (`AUTH_MAX_FAILED_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES`) + IP login rate limit (`AUTH_LOGIN_RATE_LIMIT_*`) |
| Secrets | Environment / vault only — never commit |
| Dependency scans | CI `bandit`, `pip-audit`, `npm audit` (advisory), Trivy FS scan (advisory) |

## Admin access

- Django admin requires staff/superuser
- Privileged role review cadence: **DECISION REQUIRED**

## Incident first response

1. Preserve correlation ids / audit events
2. Revoke sessions for affected accounts
3. Rotate secrets if exposure suspected
4. Follow [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)
