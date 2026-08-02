# Production Security Architecture

**Status:** CONTRACT_DEFINED — not PRODUCTION_SECURITY_VALIDATED until operator evidence exists.
**Phase 6B prerequisite:** `dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd` / workflow `30737905003` / OPERATIONS_RUNTIME_VALIDATED.

## Supported targets

| Target | Status |
| --- | --- |
| Long-term: Linux + Docker Engine + Nginx edge (80/443) | **RECOMMENDED** |
| Current operator: Windows Server + Docker Desktop | **TRANSITIONAL / CONSTRAINT** — not long-term supported architecture |
| Windows Server + IIS edge proxy | **OPTION B** — see PORT_OWNERSHIP_AND_REVERSE_PROXY_DECISION.md |

## Trust boundaries

| Boundary | Protocol | Auth | Encryption | Exposed port | Allowed source | Allowed destination | Owner | Audit | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Internet → edge proxy | HTTPS | TLS cert | TLS1.2+ | 443 (80 redirect) | Public clients | Edge only | Ops | Access logs (redacted) | OPERATOR_ACTION_REQUIRED |
| Edge → Web/BFF | HTTP internal | Network | Private network | none public | Edge | web:3001 | Platform | Request ID | CONTRACT |
| Edge → API | HTTP internal | JWT via BFF | Private network | none public | Edge/BFF | api:3000 | Platform | Request ID + AuditLog | CONTRACT |
| API → MongoDB | mongodb | App user | Prefer TLS in cloud | loopback operator only | api | mongo | DBA | DB audit | OPERATOR_OWNED_P0 root |
| API → Redis | redis | URL auth if set | Private network | unpublished | api | redis | Platform | Ops metrics | CONTRACT |
| API → MinIO | S3 API | Access key | Private / TLS when external | loopback console | api | minio | Platform | Object audit | CONTRACT |
| API → ERP | HTTPS | API key | TLS | none | api egress allowlist | ERP | Integration | ErpAttempt | OPERATOR |
| API → email/SMS | HTTPS/SMTP | Provider creds | TLS | none | api | provider | Ops | Notification | OPERATOR |
| Operator/admin | HTTPS/SSH | Named user | TLS/SSH | jump host | Operators | Admin surfaces | Security | Privileged audit | OPERATOR |
| Backup | Offline/object | Vaulted creds | Encrypted at rest | none public | Backup jobs | Off-host store | DBA | Backup manifest | OPERATOR |
| Monitoring | HTTPS/internal | Monitoring cred | TLS | protected | Scraper | metrics/ready | SRE | Alert state | PROVISIONAL |