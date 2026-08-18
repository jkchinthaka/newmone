# Disaster Recovery Runbook — Phase 19

## RPO / RTO

| Metric | Status |
| --- | --- |
| RPO | **COMPANY DECISION REQUIRED** |
| RTO | **COMPANY DECISION REQUIRED** |

Do not invent numeric targets. Capture approved values in the Approval Register when IT/Management decide.

## Failure modes

1. Application compute loss → redeploy image; rely on external PostgreSQL/Redis/storage
2. PostgreSQL loss → restore latest approved dump to replacement instance; validate `/health/ready/`
3. Evidence storage loss → restore evidence archive; verify sample download authorization
4. Redis/Celery loss → restore broker; drain/replay failed tasks carefully (no silent data repair)

## Communication

Declare severity, assign incident commander, notify QA/IT/Production owners per RACI.
