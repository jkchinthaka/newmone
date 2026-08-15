# Phase 108 — Application Security Assessment Plan

**Document status:** Controlled local-only assessment plan  
**Last updated:** 2026-08-10  
**Commit intent:** `security: remediate application security findings`

## Authorized target

| Target | Status |
| --- | --- |
| Local developer Docker Compose + pytest | **AUTHORIZED** for this phase (synthetic data only) |
| Shared staging / UAT / pre-production | **NOT AVAILABLE** — APR-021 / ASM-015 EVIDENCE REQUIRED |
| Production | **FORBIDDEN** |
| Bileeta / ERP / customer / supplier / third-party systems | **FORBIDDEN** |
| Company infrastructure outside this repository’s local Compose | **FORBIDDEN** |

If a future shared staging environment is authorized in writing, re-run this plan against that target under a new assessment ID.

## In-scope test areas (local)

Authentication, authorization, IDOR/cross-org, CSRF, XSS surface review, injection (NoSQL N/A for PostgreSQL SoR; SQL via ORM), mass assignment via forms, session handling, login rate limits, upload/signed URL (where implemented), API/webhooks/offline/SSO/AI portals **only if present on local codebase**.

## Out of scope / not present locally

Production AI providers, public portals, IoT gateways, live ERP connectors, MongoDB as SoR (POC isolated only).

## Test accounts

Synthetic factory users only (`tests.factories`). No real employee identities.

## Automated tools (safe)

- `bandit` (Python SAST)
- `detect-secrets` / `.secrets.baseline` (pre-commit)
- Existing pytest authz / CSRF / cross-org suites
- `pip-audit` when run in CI (dependency hygiene; not a full pen test)

## Explicit non-claims

This phase is **not** a penetration test of staging/production and does not authorize go-live.
