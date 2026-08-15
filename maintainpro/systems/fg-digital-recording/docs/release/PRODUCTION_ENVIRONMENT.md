# Phase 21 — Production environment verification

**Current deployment recorded in repo:** local / developer Docker Compose only.  
**No production environment is claimed.**

| Component | Required | Production status | Notes |
| --- | --- | --- | --- |
| Application service | Yes | **NOT DEPLOYED** | |
| PostgreSQL (SoR) | Yes | **NOT DEPLOYED** (prod) | ADR-002 — authoritative SoR |
| Redis | Yes | **NOT DEPLOYED** (prod) | |
| Celery / queue workers | Yes | **NOT DEPLOYED** (prod) | |
| Reverse proxy | Yes | **NOT DEPLOYED** | |
| TLS / certificates | Yes | **NOT DEPLOYED** | |
| Domain / DNS | Yes | **NOT CONFIGURED** | |
| Private media / evidence storage | Yes | **NOT DEPLOYED** (prod) | |
| Secrets (vault) | Yes | **NOT CONFIGURED** for prod | Must not live in GitHub |
| Monitoring / alerts | Yes | **NOT WIRED** to company stack | Owners TBC (Phase 19 docs) |
| Backups (scheduled + custody) | Yes | **NOT PROVEN** for prod | |
| MongoDB | Optional / not SoR | **N/A for SoR** | POC only (ADR-018); do not treat as production SoR |

PostgreSQL — not MongoDB — must be verified for production recording readiness.
