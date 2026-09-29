# Cutover Approval Template (GO_FOR_CUTOVER)

**Current status:** absent — **PENDING_AUTHORIZED_HUMAN_DECISION** / recommendation **DELAYED**  
Do not fabricate GO.

## Prerequisites confirmation

All items in `PHASE8_AUTHORIZATION_CHECKLIST.md` must be complete, including:

- Formal UAT + training + management sign-offs
- Nginx port owner confirmed
- HTTP-only written approval
- Backup / restore / RPO-RTO / retention
- Migration dry-run + apply authorization
- Dependency high/critical dispositions
- Image digests and operators named

## Deployment approval block

| Field | Value |
| --- | --- |
| Approved release candidate SHA | |
| Approved API image digest | |
| Approved Web image digest | |
| Approved Nginx image digest | |
| Deployment date / window | |
| Authorized operator | |
| Incident commander | |
| Rollback authority | |
| Approved environment | Nelna MaintainPro |
| Support / hypercare owner | |
| Change / ticket reference | |
| Explicit decision | ☐ GO_FOR_CUTOVER · ☐ DELAYED · ☐ NO_GO |

## Authorizers

| Role | Name | Date | Signature / reference |
| --- | --- | --- | --- |
| Business Owner | | | |
| IT Manager | | | |
| Incident commander | | | |
| Technical lead | | | |

Until this form records an explicit **GO_FOR_CUTOVER** with real signatures, Phase 8 must not start.