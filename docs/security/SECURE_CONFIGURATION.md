# Secure Configuration

**Document status:** Phase 02 foundation guidance — not a completed security assessment
**Branch:** `foundation/django-postgresql`
**Last updated:** 2026-08-05

## Principles (foundation)

- No secrets in source control; `.env` is gitignored; use `.env.example` only as a template
- Deny-by-default remains the authorization direction ([SECURITY_BASELINE.md](SECURITY_BASELINE.md)); Phase 02 does not implement full RBAC policies yet
- Production settings fail closed when required configuration is missing
- DEBUG never enabled in production settings
- Shared user accounts remain prohibited

## Production fail-closed checklist

`config.settings.production` requires:

- `DJANGO_SECRET_KEY` (rejects `local-only*` / `test-only*` prefixes)
- `DJANGO_ALLOWED_HOSTS` (non-empty, no `*`)
- `DJANGO_CSRF_TRUSTED_ORIGINS` (non-empty)
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `REDIS_URL`

Security flags (production):

| Setting | Default |
| --- | --- |
| `SESSION_COOKIE_SECURE` | `True` |
| `CSRF_COOKIE_SECURE` | `True` |
| `SECURE_SSL_REDIRECT` | `True` (env-overridable) |
| `SECURE_HSTS_SECONDS` | `31536000` |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` |
| `SECURE_HSTS_PRELOAD` | `False` |
| `SECURE_CONTENT_TYPE_NOSNIFF` | `True` |
| `X_FRAME_OPTIONS` | `DENY` |

CI verifies missing-secret failure and runs `check --deploy` with **non-production placeholder** values only.

## Local / compose

- Example passwords in `.env.example` and compose defaults are **local-only**, not production secrets
- Host ports bind to `127.0.0.1` by default in `compose.yaml`
- Do not reuse local keys in any shared or production environment

## Dependency and static analysis

| Tool | Version | Role |
| --- | --- | --- |
| bandit | 1.9.2 | Python security lint (CI) |
| pip-audit | 2.10.0 | Dependency vulnerability audit (CI) |
| detect-secrets | pre-commit hook | Secret leak prevention |

## Explicit non-claims

- Not production-approved; no production deployment authorization
- Not a penetration test or formal security review
- HSTS preload remains off until deliberate readiness
- Hosting platform still **DECISION REQUIRED**

## Related

- [SECURITY_BASELINE.md](SECURITY_BASELINE.md)
- [CONFIGURATION_REFERENCE.md](../operations/CONFIGURATION_REFERENCE.md)
- [ADR-005-DJANGO-SETTINGS-AND-ENVIRONMENTS.md](../architecture/ADR-005-DJANGO-SETTINGS-AND-ENVIRONMENTS.md)
- [CI_QUALITY_GATES.md](../testing/CI_QUALITY_GATES.md)
