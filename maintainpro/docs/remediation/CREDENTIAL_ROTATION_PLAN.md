# Credential Rotation Plan

| Credential | Owner | Status | Trigger | Frequency | Dependents | Dual-key | Rollback | Verification | Approval | Last rotated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mongo root | DBA | OPERATOR_OWNED_P0 | Compromise/policy | MANAGEMENT_APPROVAL_REQUIRED | All DB admin | Overlap window | Previous vault secret | Auth test | OPERATOR | UNKNOWN |
| Mongo app | DBA | OPERATOR_ACTION_REQUIRED | Rotation policy | MANAGEMENT_APPROVAL_REQUIRED | API | Dual user optional | Swap URI | Login + ready | OPERATOR | UNKNOWN |
| JWT access | Platform | OPERATOR_ACTION_REQUIRED | Compromise/release | MANAGEMENT_APPROVAL_REQUIRED | Sessions | Short overlap | Revert + force logout | Auth smoke | OPERATOR | UNKNOWN |
| JWT refresh | Platform | OPERATOR_ACTION_REQUIRED | Compromise/release | MANAGEMENT_APPROVAL_REQUIRED | Refresh cookies | Short overlap | Force logout | Auth smoke | OPERATOR | UNKNOWN |
| READINESS_API_KEY | Platform | OPERATOR_ACTION_REQUIRED | Leak/rotation | MANAGEMENT_APPROVAL_REQUIRED | Readiness clients | Dual accept optional | Prior key | Ready probe | OPERATOR | UNKNOWN |
| MinIO | Platform | OPERATOR_ACTION_REQUIRED | Leak | MANAGEMENT_APPROVAL_REQUIRED | Uploads | Dual keys if supported | Prior key | Upload/read | OPERATOR | UNKNOWN |
| SMTP/SMS/ERP | Integration | OPERATOR_ACTION_REQUIRED | Provider/policy | MANAGEMENT_APPROVAL_REQUIRED | Notifications/ERP | Provider dual | Prior creds | Mock/UAT send | OPERATOR | UNKNOWN |
| Swagger | Platform | OPERATOR_ACTION_REQUIRED | Enablement | As needed | Docs UI | N/A | Disable | Auth to docs | OPERATOR | N/A if disabled |
| Cloudflare/DNS | Network | OPERATOR_ACTION_REQUIRED | Staff change | MANAGEMENT_APPROVAL_REQUIRED | DNS/TLS | N/A | Prior token | DNS check | OPERATOR | UNKNOWN |
| TLS private keys | Network | OPERATOR_ACTION_REQUIRED | Renewal/compromise | Cert lifecycle | Edge | Parallel cert | Prior cert | TLS probe | OPERATOR | UNKNOWN |
| CI/CD / GitHub deploy | DevOps | OPERATOR_ACTION_REQUIRED | Staff change | MANAGEMENT_APPROVAL_REQUIRED | Pipelines | Environment protection | Revoke token | Workflow | OPERATOR | UNKNOWN |

**Never auto-rotate Mongo root in CI or application code.**