# Phase 03 Test Plan

**Document status:** Phase 03 foundation
**Last updated:** 2026-08-06
**Coverage gate:** ≥80% (`apps` + `config`)

## Identity

- UUID PK preserved; employee-code normalization and case-insensitive uniqueness
- No raw password storage; inactive behavior; no seeded accounts
- `create_user` / admin creation require employee_code; migration-compatible NULL via direct ORM only

## Authentication

- Valid/invalid employee-code and password; **generic** errors for unknown, wrong password, inactive, locked
- Locked login does **not** redirect to a distinct locked page based on submitted code
- Session key rotation on successful login (explicit assertion); logout POST-only; unsafe `next` rejected
- Successful/failed login timestamps; counter reset after success
- Password-hash work on unknown/inactive/locked paths (mitigation, not brittle timing asserts)

## Lockout

- Threshold, temporary lock, expired lock allows auth, admin unlock
- Genuine multi-thread PostgreSQL concurrency for failed-login increments
- Already-locked attempts do not extend counters
- Audit events; no credential leakage in responses

## Password

- Validators; current password required; forced-change redirect
- Clears `must_change_password`; session remains authenticated and is rotated; audit event

## Organizations

- Constraints; site/department hierarchy; inactive hierarchy; PROTECT deletion
- No seeded organization data

## RBAC

- Global / organization / site / department scopes
- Cross-organization denial; inactive/future/expired denial
- Active assignment uniqueness with PostgreSQL NULLS NOT DISTINCT (all nullable scope shapes)
- Inactive historical duplicates allowed; reactivation of duplicates rejected
- Concurrent duplicate assignment creation; decorator and mixin enforcement; superuser behavior

## Audit

- Required event types; sensitive fields excluded; unknown identifiers masked/hashed
- Append-oriented admin behavior

## Architecture

- Thin views; logic in services/backends; no FG workflow apps; no SQLite; no circular deps

## Runtime requirements

PostgreSQL mandatory for integration, Docker tests, and CI. Redis for cache/Celery where relevant.

## Related

- [TESTING_GUIDE.md](TESTING_GUIDE.md)
- [CI_QUALITY_GATES.md](CI_QUALITY_GATES.md)
