# Phase 90 — Governed Feature Flag Management

**Document status:** Phase completion record  
**Last updated:** 2026-08-10  
**Commit intent:** `feat: add governed feature flag management`

## Outcome

**STATUS: PHASE 90 FEATURE FLAGS COMPLETE** (technical foundation)

Delivered:

- `apps.feature_flags` with scoped flags, effective windows, owners, temporary review dates
- Closed catalogue of advanced-module keys (default OFF)
- Privileged administration + security audit events
- Server evaluation helpers that never replace RBAC
- Operating guide: [FEATURE_FLAG_OPERATING_GUIDE.md](../operations/FEATURE_FLAG_OPERATING_GUIDE.md)
- Tests for global/org/site, expiry, unauthorized admin, RBAC unaffected

## Non-claims

Not BUSINESS APPROVED rollout of any advanced module. Enabling a flag in production still requires owner process and existing authorization.
