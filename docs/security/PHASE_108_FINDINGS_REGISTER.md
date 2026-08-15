# Phase 108 — Security Findings Register

**Assessment ID:** SEC-108-LOCAL-2026-08-10  
**Target:** Local Compose / codebase / pytest only  
**Methodology:** Safe automated SAST + manual high-risk path review + existing regression suites

## Summary

| Severity | Open | Remediated this phase | Accepted residual |
| --- | --- | --- | --- |
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 0 | 0 | 0 |
| Low | 0 | 1 (B101 assert-in-runtime) | See residual notes |

## Findings

### SEC-108-001 — `assert` used on request/auth paths (Bandit B101)

| Field | Value |
| --- | --- |
| Severity | Low |
| Evidence | Bandit B101 on `apps/*/views.py`, forms, `accounts` auth services/backends |
| Affected | Runtime type narrowing via `assert isinstance(...)` |
| Risk | Under `python -O`, asserts are stripped; queryset/auth assumptions could fail open to `AttributeError` rather than controlled TypeError |
| Remediation | Replace with `apps.core.type_guards.require_*` raising `TypeError` |
| Owner | Application Security / Backend |
| Status | **CLOSED** — remediated in Phase 108 |
| Retest | Bandit B101 count on apps/config (excl. tests/migrations/mongo_poc) = 0; unit test for type guards |

### SEC-108-002 — No authorized staging target for dynamic assessment

| Field | Value |
| --- | --- |
| Severity | Informational (process) |
| Evidence | `PROJECT_STATUS.md`: local Compose only; APR-021 open |
| Remediation | Obtain hosting/staging approval; re-run assessment against authorized staging |
| Owner | IT Manager (APR-021) |
| Status | **OPEN — process** (blocks staging pen-test, not local remediation) |

### SEC-108-003 — Modules not implemented locally (portals, SSO, offline sync, AI, webhooks)

| Field | Value |
| --- | --- |
| Severity | Informational |
| Evidence | MODULE_MAP / roadmap — future phases |
| Remediation | Include in assessment when modules land |
| Status | **DEFERRED** |

## Residual risks (not invented acceptance)

- HTMX vendor `allowEval` defaults — monitor when custom JS expands; keep Django autoescape
- Login rate-limit window policy values remain configurable — final production thresholds OWNER REQUIRED
- Full adversarial IDOR battery against staging still required before production claims

## Validation performed this phase

- Bandit scan (post-fix: no B101 in scoped paths)
- Type-guard unit tests
- Existing CSRF / cross-org suites remain the primary authorization regression net
