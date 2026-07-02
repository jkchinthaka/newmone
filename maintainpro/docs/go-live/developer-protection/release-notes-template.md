# Release Notes Template — MaintainPro

**Document owner:** Product  
**Release version:** vX.Y.Z / UAT-0XX  
**Release date:** YYYY-MM-DD  
**Commit:** `git SHA`

---

## Summary

*(2–3 sentences for all users: what changed and why it matters)*

---

## What's new

### Features

- **Feature name** — Brief user-facing description.
- 

### Improvements

- 
- 

### Bug fixes

- 
- 

---

## Security & compliance

*(Include when UAT touches RBAC, audit, or fraud controls)*

- 
- Example: Maker-checker enforcement on part requests (UAT-020)
- Example: Audit export requires `audit.view` permission (UAT-022)

---

## Breaking changes

| Change | Who is affected | Action required |
|--------|-----------------|-----------------|
| None | — | — |

---

## Known issues

| Issue | Workaround | Fix planned |
|-------|------------|-------------|
| | | |

Full register: [known-limitations.md](known-limitations.md)

---

## Upgrade / deployment notes (internal — DevOps)

| Item | Detail |
|------|--------|
| Minimum API version | |
| Schema migration | `db:push` required: Yes / No |
| Env vars added/changed | *(names only — no values)* |
| Pre-deploy snapshot | Required: Yes / No |
| Rollback commit | `git SHA` |
| Validation | `npm run uat:0XX:validate` |

---

## Role / permission changes

*(If seed.ts or RBAC changed — link to permission matrix)*

| Role | Change |
|------|--------|
| | |

Reference: [permission-matrix.md](../permission-matrix.md)

---

## Support

| Channel | Contact |
|---------|---------|
| Internal support | *(org helpdesk)* |
| Documentation | `maintainpro/docs/` |
| Incident reporting | [incident-response-sop.md](incident-response-sop.md) |

---

## Previous release

| Version | Date | Notes |
|---------|------|-------|
| | | |

---

## Example — UAT-021 release notes (reference)

**Summary:** Management Intelligence dashboard adds profitability summary and finance-gated reports for operations leadership.

**What's new:**
- Profitability summary cards on Reports → Management Intelligence
- Finance approver role visibility on fraud override exports
- Maintenance exception counts aligned with UAT-009/010 governance

**Validation:** `npm run uat:021:validate` · Commit `d371733`

---

*Remove example section before publishing.*
