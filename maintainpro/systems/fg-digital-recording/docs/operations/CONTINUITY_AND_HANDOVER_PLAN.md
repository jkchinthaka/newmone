# Continuity and Handover Plan

**Document status:** DRAFT continuity / handover baseline — not a legal opinion
**Created:** 2026-08-09
**Related:** [BUSINESS_CONTINUITY_DRAFT.md](BUSINESS_CONTINUITY_DRAFT.md) (factory fallback SOP draft), [RACI.md](../governance/RACI.md), [APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md)

This document addresses **engineering and operational continuity**. It does **not** make legal conclusions about IP, employment, or contract rights. Those require **written company clarification**.

---

## 1. Repository ownership

| Topic | Current evidence | Action required |
| --- | --- | --- |
| Git hosting | Private GitHub repository (DEC-012 technical direction) | Confirm company org ownership vs personal fork — APR-025 |
| Default branch | `main` | Keep protected where GitHub permissions allow |
| Access roster | OWNER TO BE CONFIRMED | IT Manager + Management Sponsor name admins and developers |

---

## 2. Credentials ownership

| Secret / credential class | Storage today | Owner |
| --- | --- | --- |
| Local `.env` | Developer workstation (not in git) | Developer (local); production OWNER TO BE CONFIRMED |
| GitHub Actions secrets | GitHub (if configured) | IT Manager / System Administrator — OWNER TO BE CONFIRMED |
| PostgreSQL / Redis passwords | Env vars | System Administrator — OWNER TO BE CONFIRMED |
| Object storage keys (future) | Env / IAM | System Administrator — OWNER TO BE CONFIRMED |
| ERP / Bileeta credentials (future) | Vault TBD | IT Manager + Vendor — OWNER TO BE CONFIRMED |

**Rule:** No secrets in source control. Vault product and custodians = APR-026 (**NOT REQUESTED** until IT names them).

---

## 3. Environment ownership

| Environment | Exists? | Owner |
| --- | --- | --- |
| Local developer (uv + Compose postgres/redis) | Yes | Developer |
| Shared UAT / staging | Not evidenced | IT Manager — OWNER TO BE CONFIRMED (ASM-015 / APR-021) |
| Production | Not deployed | IT Manager — OWNER TO BE CONFIRMED |

Compose services: `postgres`, `redis`, `web`, `celery-worker`, `test` (profile). Authoritative DB remains PostgreSQL.

---

## 4. Architecture documentation (must remain discoverable)

Minimum set for a successor engineer:

- [PROJECT_STATUS.md](../PROJECT_STATUS.md)
- [ROADMAP.md](../ROADMAP.md)
- [MODULE_MAP.md](../architecture/MODULE_MAP.md)
- ADRs under `docs/architecture/`
- [APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md)
- [DECISION_LOG.md](../governance/DECISION_LOG.md)
- Readiness gates under `docs/business/PHASE_*_GATE.md`
- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md), [DOCKER_DEVELOPMENT.md](DOCKER_DEVELOPMENT.md), [CONFIGURATION_REFERENCE.md](CONFIGURATION_REFERENCE.md)

---

## 5. Deployment runbook status

| Item | Status |
| --- | --- |
| Local runbook | Documented (LOCAL_DEVELOPMENT / DOCKER_DEVELOPMENT) |
| Staging deploy runbook | **Not production-ready** — hosting decision open |
| Production deploy runbook | **Does not exist as approved** — blocked by APR-021 and Phase 21 |

Do not treat local Compose success as production deployment capability.

---

## 6. Backup / restore ownership

| Item | Owner | Status |
| --- | --- | --- |
| Backup policy / RPO / RTO | IT Manager — OWNER TO BE CONFIRMED | ASM-016 open |
| PostgreSQL backup execution | System Administrator — OWNER TO BE CONFIRMED | Not evidenced for production |
| Restore drill evidence | IT Manager — OWNER TO BE CONFIRMED | Required before PRODUCTION READY |
| Object-storage backup (future evidence) | System Administrator — OWNER TO BE CONFIRMED | Phase 11+ |

---

## 7. Support contacts by role

| Role | Contact |
| --- | --- |
| Management Sponsor | OWNER TO BE CONFIRMED |
| IT Manager | OWNER TO BE CONFIRMED |
| QA Manager | OWNER TO BE CONFIRMED |
| Production Manager | OWNER TO BE CONFIRMED |
| System Administrator | OWNER TO BE CONFIRMED |
| Developer / maintainers | OWNER TO BE CONFIRMED |
| Bileeta Vendor | OWNER TO BE CONFIRMED |

Factory digital-outage fallback behaviours: see [BUSINESS_CONTINUITY_DRAFT.md](BUSINESS_CONTINUITY_DRAFT.md) (**not** approved SOP).

---

## 8. Knowledge transfer checklist

When handing over, complete:

1. Walkthrough of PROJECT_STATUS status vocabulary and open gates
2. Demo of local boot + test profile
3. Explanation of unseeded master data and permission model
4. Explanation that RELEASE/HOLD/REJECT are application labels only (ADR-017)
5. Review of APPROVAL_REGISTER blockers
6. Transfer of credential locations (not values in chat logs)
7. Confirm second person has GitHub admin access

---

## 9. IP / ownership / portfolio use — clarification required

The following require **written company clarification** (legal/commercial). This repository documentation must not assert conclusions:

- Who owns the repository and commit history commercially?
- What portfolio / demonstration rights exist for individuals?
- What happens to environments and secrets on contract end?
- Which artefacts are confidential Nelna operational content?

Track as APR-025 until answered in writing.

---

## 10. Immediate continuity actions (recommended)

1. Name Management Sponsor, IT Manager, QA Manager, System Administrator in RACI.
2. Confirm GitHub organization ownership and admin redundancy (bus-factor mitigation).
3. Decide secret vault approach (APR-026).
4. Keep PRODUCTION READY = No until restore + UAT + written go-live exist.
