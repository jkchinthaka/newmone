# ADR-031 — Technical production-readiness controls

**Status:** Accepted (technical controls foundation)  
**Date:** 2026-08-10  
**Phase:** 19

## Context

Before pilot/production claims, the platform needs hardening, health signals, backup/restore evidence, monitoring ownership, and performance/concurrency regression harnesses. RPO/RTO and final session policies remain company decisions.

## Decision

1. Enforce production HTTPS/cookie/HSTS settings (existing) plus CSP + Permissions-Policy via `SecurityHeadersMiddleware`.
2. Expand readiness to PostgreSQL, Redis, Celery broker, and evidence storage; MongoDB/Bileeta remain optional/skipped unless evidenced.
3. Keep structured request logs with correlation id, safe user/org ids, duration, status, error class — never passwords/tokens/URIs/free-text answers.
4. Provide backup helpers + mandatory non-production restore drill evidence template/script.
5. Document monitoring alerts and incident/DR runbooks with **COMPANY DECISION REQUIRED** for RPO/RTO.
6. Ship synthetic performance and concurrency/e2e smoke tests; full staging load/pen-test remains operator-owned.

## Consequences

- Phase 19 completes **technical** readiness controls; it does **not** claim business production go-live.
- Restore drill must be re-run on company-approved non-prod tooling when client binaries are available.
