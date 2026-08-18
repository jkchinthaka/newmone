# ADR-005 — Django Settings and Environments

**Status:** Accepted (Phase 02 technical foundation)
**Date:** 2026-08-05
**Phase:** 02 — Django/PostgreSQL foundation
**Branch:** `foundation/django-postgresql`

## Context

The foundation must separate local, test, and production configuration without committing secrets, and must fail closed in production when required variables are missing.

## Decision

Use a split settings package under `config/settings/`:

| Module | Purpose |
| --- | --- |
| `base.py` | Shared apps, middleware, templates, logging, Celery defaults; does **not** auto-load `.env` |
| `database.py` | PostgreSQL and Redis cache builders |
| `local.py` | Developer workstation; may load `.env` |
| `test.py` | Pytest / CI |
| `production.py` | Fail-closed: requires secrets/hosts/DB/Redis; rejects placeholder keys and wildcard hosts |

Configuration is read via **django-environ**. Select the module with `DJANGO_SETTINGS_MODULE`.

### Environment rules

| Rule | Detail |
| --- | --- |
| Secrets | Environment variables or secret managers only; never commit real `.env` |
| Local | `.env` from `.env.example`; DEBUG allowed locally only |
| Production | DEBUG forced false; secure cookies; SSL redirect default true; HSTS defaults documented |
| Test | Synthetic CI credentials only |

Documented variable catalogue: [CONFIGURATION_REFERENCE.md](../operations/CONFIGURATION_REFERENCE.md).
Secure defaults: [SECURE_CONFIGURATION.md](../security/SECURE_CONFIGURATION.md).

## Alternatives considered

| Option | Why not selected |
| --- | --- |
| Single `settings.py` | Harder to keep production fail-closed and local convenient |
| django-configurations / dynaconf | Extra abstraction not needed for current team size |

## Consequences

- Operators must set `DJANGO_SETTINGS_MODULE` explicitly per process.
- Production import without required env raises `ImproperlyConfigured` (verified in CI).
- Local compose maps host ports separately from in-container DB/Redis ports (see Docker docs).

## Non-claims

- Production hosting platform remains **DECISION REQUIRED** (see environment strategy).
- Presence of `production.py` does **not** mean production is approved or deployed.

## References

- [ENVIRONMENT_STRATEGY.md](../operations/ENVIRONMENT_STRATEGY.md)
- [PHASE_02_TECHNICAL_BASELINE.md](PHASE_02_TECHNICAL_BASELINE.md)
- `config/settings/`
