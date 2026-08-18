# Phase 06B Test Plan — Checklist Governance Hardening

**Document status:** Phase 06B governance hardening
**Last updated:** 2026-08-07

## Scope

Lifecycle transition centralization; published/retired immutability; clone integrity; version-number concurrency; object-aware authorization; query bounds; TEMPLATE-001 evidence intake readiness (docs only).

## Out of scope

Real form content, response types, temperature limits, scheduling, recording, schema expansion.

## Coverage areas

- Allowed transitions DRAFT→PUBLISHED, PUBLISHED→RETIRED
- Prohibited reverse/skip transitions
- Direct service + HTTP immutability for published/retired
- Clone from DRAFT/PUBLISHED/RETIRED with independent rows and preserved order
- Concurrent version allocation under PostgreSQL
- Object-aware list actions; child-object IDOR
- Template list / version editor query bounds
- Admin structural mutation restrictions

Synthetic fixtures only (`CHK-GOV`, `Section Test`, `Item Test`).
