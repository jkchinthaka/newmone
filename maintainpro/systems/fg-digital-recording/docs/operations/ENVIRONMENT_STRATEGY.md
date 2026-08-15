# Environment Strategy

**Document status:** Draft — hosting choices pending IT decision  
**Phase:** 00 — Discovery and governance  
**Last updated:** 2026-08-04

No real credentials are defined in this document.

| Environment | Purpose | Data classification | Allowed users | Database | Secrets | Deployment | Backup | Reset policy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local | Developer workstation via Docker Compose (when introduced) | Synthetic / developer fixtures only | Developers | Local PostgreSQL container | Developer `.env` (gitignored); never production secrets | Local compose | Optional local dumps | Reset anytime |
| Development | Shared early integration (if used) | Synthetic or anonymized | Developers | Shared non-prod PostgreSQL | Non-prod secret store | Automated or manual non-prod pipeline | Best-effort | Reset with notice |
| Test | Automated CI and integration tests | Synthetic | CI service accounts + developers | Ephemeral or CI PostgreSQL | CI secrets | GitHub Actions | Not retained | Destroy after run |
| UAT | Business acceptance | Controlled test data; may include limited copies **only if approved** | Business, QA, IT testers | Dedicated UAT DB | UAT secrets | Controlled promote from tested builds | Before major UAT cycles | Reset only with QA/IT approval |
| Staging | Production-like rehearsal | Production-like synthetic or approved subset | IT + designated testers | Staging DB | Staging secrets | Same mechanism as production candidate | Regular non-prod backups | Reset with IT approval |
| Production | Live operations | Operational records and evidence metadata | Authorized named users only | Production PostgreSQL | Production secret manager only | Explicit approved release | Mandatory backups meeting RPO **(targets PROPOSED)** | **No casual reset**; restore via DR procedures only |
| Disaster recovery | Restore and continuity validation | Restored operational data | IT + authorized approvers | DR PostgreSQL / restore target | DR secrets | Restore drills and true DR events | Validated restores | Used for recovery, not daily work |

## Cross-cutting rules

- Deny production deployment without explicit written approval.
- Separate secrets per environment.
- Do not use production data in local/dev without a documented, approved process.
- RPO/RTO numerical targets remain **PROPOSED** until approved (see NFRs and assumption register).

## Hosting

Concrete hosting platforms for non-local environments are **DECISION REQUIRED** (ASM-015).
