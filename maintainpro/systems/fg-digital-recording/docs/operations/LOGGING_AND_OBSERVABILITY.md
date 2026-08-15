# Logging and Observability

**Document status:** Phase 02 foundation + Phase 19 enrichment  
**Branch:** `hardening/phase-19-security-ops`  
**Last updated:** 2026-08-10

## Approach

Phase 02 uses **structlog** (26.1.0) integrated with Django `LOGGING`.

| Environment | Console formatter | Notes |
| --- | --- | --- |
| Local / test | Human-oriented processor formatter | `LOG_LEVEL` from env (default INFO) |
| Production | JSON renderer on console handler | Suitable for log aggregation later |

Shared processors include UTC ISO timestamps, logger name, log level, and contextvars merge.

## Request correlation

Middleware in `apps.core.middleware`:

| Middleware | Behaviour |
| --- | --- |
| `CorrelationIdMiddleware` | Assigns/propagates a correlation id for the request |
| `RequestLoggingMiddleware` | Structured request logging hooks |

Do not log secrets, passwords, session tokens, or full evidence payloads.

## Health endpoints

| Path | Meaning |
| --- | --- |
| `/health/live/` | Process alive — no DB/Redis dependency |
| `/health/ready/` | PostgreSQL + Redis + Celery broker + evidence storage; optional Mongo/Bileeta skipped; `503` when required checks fail |

Dockerfile `HEALTHCHECK` uses liveness. Readiness is for orchestrators / local diagnosis.

## Celery

Worker log level is set on the command line (compose uses `--loglevel=INFO`). Task time limits come from settings/env. Foundation tasks live under `apps.core.tasks` — no business workflows yet.

## What is not claimed

- No full APM/metrics stack in Phase 02.
- No production monitoring SLAs.
- No claim that logging alone satisfies audit-event requirements (audit events are a later domain concern).

## Related

- [CONFIGURATION_REFERENCE.md](CONFIGURATION_REFERENCE.md)
- [SECURE_CONFIGURATION.md](../security/SECURE_CONFIGURATION.md)
- `config/settings/base.py`, `apps/core/health.py`


## Phase 19 fields

Request logs may include: correlation/request id, user id, organization id (when set), event, duration, status, error class.

Never log: passwords, tokens, Mongo URI, full checklist free-text, attachment bytes.
