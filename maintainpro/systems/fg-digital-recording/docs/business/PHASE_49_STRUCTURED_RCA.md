# Phase 49 — Structured Root Cause Analysis

**Status:** Technical foundation delivered  
**ADR:** [ADR-060](../architecture/ADR-060-STRUCTURED-RCA.md)  
**Approval:** APR-074 EVIDENCE REQUIRED  

## Delivered

- `apps.rca` — RCA record, participants, optional 5 Why, fishbone, cause table
- Cause states: POSSIBLE / SUPPORTED / CONFIRMED
- Human confirmation with evidence; AI may only hypothesize
- Explicit CAPA linkage from a confirmed root cause
- Edit and confirm permissions are separate
- Operator list/create/detail workspace (`/rca/`) gated by `view_rca` / `manage_rca` / `confirm_rca`
- Optional immediate containment citation (does not open or close NCR/CAPA)

## Not claimed

- No mandatory method (5 Why is not required)
- Software/AI cannot auto-confirm a root cause
- Fishbone 6M labels are architectural, not a Nelna taxonomy

## STATUS: PHASE 49 RCA TOOLKIT COMPLETE
