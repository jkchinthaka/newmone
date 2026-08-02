# Phase 8 Authorization Checklist

**Purpose:** Fail closed. Synthetic CI evidence is never a substitute for human approval.  
**Current pack status:** prepared only — **GO_FOR_CUTOVER absent**  
**Recommendation:** **DELAYED**  
**Phase 8 execution:** not started by this document

Release candidate reference:

- Deployable application SHA: `5e3c470f3d7bc2fa15d84252db6492b7c4b65522`
- Evidence tip SHA (docs only): `99c0be628b2ae254d0fc7e173d35283211730e88`
- Phase 7A workflow: `30740626683`
- Port owner: **NGINX confirmed**
- Public URL (HTTP): `http://135.171.163.249`

## Required real evidence

Mark each item only when **authorized human/operator evidence** exists.

| # | Gate | Status template | Evidence reference |
| --- | --- | --- | --- |
| 1 | Formal business UAT completed | ☐ FORMAL_UAT_COMPLETE | |
| 2 | No unresolved P0 | ☐ | |
| 3 | No unresolved security/data-integrity P1 | ☐ | |
| 4 | QA/UAT Lead approval | ☐ | |
| 5 | Business Owner approval | ☐ | |
| 6 | Role-based training completed | ☐ FORMAL_TRAINING_COMPLETE | |
| 7 | Training attendance evidence | ☐ | |
| 8 | User competency evidence | ☐ | |
| 9 | IT Manager sign-off | ☐ | |
| 10 | System Administrator sign-off | ☐ | |
| 11 | Department Manager sign-off | ☐ | |
| 12 | Nginx port-owner decision recorded | ☑ CONFIRMED=NGINX (Phase 7B) | `PHASE7B_NELNA_READINESS_RECONCILIATION.md` |
| 13 | HTTP-only approval and risk acceptance | ☐ HTTP_ONLY_APPROVAL_PENDING | `NELNA_HTTP_ONLY_DECISION_TEMPLATE.md` |
| 14 | Mongo root credential rotation | ☐ OPERATOR_OWNED_P0 | |
| 15 | Off-host encrypted Mongo backup | ☐ | |
| 16 | MinIO/object backup | ☐ | |
| 17 | Restore drill reviewed | ☐ | |
| 18 | RPO/RTO accepted | ☐ | |
| 19 | Retention policy accepted | ☐ | |
| 20 | Permission/schema/index migration dry-run reviewed | ☐ | |
| 21 | Migration apply explicitly approved | ☐ | |
| 22 | Dependency high/critical findings dispositioned | ☐ DEPENDENCY_SECURITY_REVIEW_REQUIRED | `DEPENDENCY_RISK_REGISTER.md` |
| 23 | Approved release SHA | ☐ must equal `5e3c470…` or a newly approved SHA | |
| 24 | Approved image digests | ☐ | |
| 25 | Deployment window | ☐ | |
| 26 | Deployment operator | ☐ | |
| 27 | Incident commander | ☐ | |
| 28 | Rollback authority | ☐ | |
| 29 | Support/hypercare owner | ☐ | |
| 30 | Change/ticket reference | ☐ | |
| 31 | Explicit **GO_FOR_CUTOVER** | ☐ absent | `CUTOVER_APPROVAL_TEMPLATE.md` |

## Stop rule

If any unchecked gate remains, Phase 8 must return:

`PHASE8_AUTHORIZATION_REQUIRED`

Do not create a deployment branch, connect to Nelna for mutation, rotate credentials, apply migrations, or deploy.