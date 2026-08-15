# Non-Functional Requirements

**Document status:** Proposed measurable targets — **all numerical values are PROPOSED until approved**  
**Phase:** 00 — Discovery and governance  
**Last updated:** 2026-08-04

| Area | Proposed target | Status | Notes |
| --- | --- | --- | --- |
| Performance — operator primary task interactive response | P95 &lt; 2 seconds on approved pilot network for key screens | PROPOSED | Baseline after Phase 08 |
| Performance — submit acknowledgement | P95 &lt; 3 seconds excluding large evidence upload | PROPOSED | Evidence upload separate |
| Availability — production | 99.5% monthly excluding approved maintenance | PROPOSED | DECISION REQUIRED |
| RPO | ≤ 15 minutes | PROPOSED | ASM-016 |
| RTO | ≤ 4 hours | PROPOSED | ASM-016 |
| Concurrency — pilot | Support 25 concurrent authenticated users | PROPOSED | Scale after measured load |
| Concurrency — production aspirational | Support 100 concurrent authenticated users | PROPOSED | Not a go-live claim |
| Page weight — operator key screens | ≤ 500 KB compressed initial document+critical assets where practical | PROPOSED | Images exempted as evidence |
| Offline draft speed | Save draft locally &lt; 500 ms P95 once offline enabled | PROPOSED | Phase 14 only |
| Sync speed | Pending queue sync of 20 drafts &lt; 60 seconds on approved network | PROPOSED | Phase 14 only |
| Accessibility | Aim for WCAG 2.2 Level AA for interactive operator/QA flows | PROPOSED | Exact conformance claim needs audit |
| Browser/device support | Latest two stable versions of Chrome/Edge on Android; Safari iOS latest two; desktop Chrome/Edge/Firefox latest two | PROPOSED | Device list OWNER REQUIRED |
| Security | Baseline controls implemented and tested before production | PROPOSED | See security baseline |
| Retention | Per approved QA/Legal policy | PROPOSED — EVIDENCE REQUIRED | No invented years |
| Auditability | Important operations emit audit events retrievable in export | PROPOSED | |
| Backup and restore | Successful restore drill before production approval | PROPOSED | Required gate |

## Rules

- Do not present these numbers as Nelna-approved commitments.
- Update this table when owners approve values; move status to Approved with date and evidence link in `docs/approvals/`.
