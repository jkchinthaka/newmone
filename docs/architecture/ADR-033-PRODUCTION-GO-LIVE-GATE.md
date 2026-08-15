# ADR-033 — Production go-live evidence gate

**Status:** Accepted (process)  
**Date:** 2026-08-10  
**Phase:** 21

## Context

Production release requires passed UAT/pilot, security closure, proven backup/restore under company policy, approved hosting, approved business configuration, and a named support owner. Engineering automation cannot invent these.

## Decision

1. Hard prerequisites in `docs/release/HARD_PREREQUISITES.md` are mandatory STOP gates.
2. If any hard prerequisite fails, Phase 21 status is **GO-LIVE BLOCKED**; no deploy, no release tag, no PRODUCTION READY claim.
3. PostgreSQL remains production SoR; MongoDB POC is not a production SoR requirement.
4. `main` commits do not authorize production deployment.
5. Paper continues until formal QA/management decommission approval.

## Consequences

- Phase 21 may only move to **PRODUCTION GO-LIVE COMPLETE** when real signoffs and environment evidence exist.
- Handover templates in `docs/release/` prepare the company but do not complete handover by themselves.
