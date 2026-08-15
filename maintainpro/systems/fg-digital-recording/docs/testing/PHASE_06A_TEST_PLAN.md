# Phase 06A Test Plan — Checklist Definition & Versioning

**Document status:** Phase 06A technical foundation  
**Last updated:** 2026-08-07

## Scope

Configurable unseeded checklist templates, versions, sections, and items; publish immutability; org-scoped RBAC; management UI.

## Out of scope

Real form content, response types, temperature limits, scheduling, recording, review, evidence.

## Coverage areas

- Model constraints and normalization
- Version allocation / clone
- Draft mutations vs published immutability
- Publish/retire lifecycle
- Cross-org denial and object-aware UI affordances
- CSRF / GET mutation rejection
- Admin delete restrictions
- Query-bound list rendering
- Architecture boundary allowing `checklists` app only for definitions

Synthetic fixtures only (`CHK-TEST`, `Section Test`, `Item Test`).
