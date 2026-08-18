# Decision Register

**Document status:** Living register — technical direction recorded; business decisions pending where noted
**Phase:** 00 — Discovery and governance
**Last updated:** 2026-08-09
**Canonical chronological log:** [../governance/DECISION_LOG.md](../governance/DECISION_LOG.md) (prefer for new entries; keep DEC-IDs stable here)

## Status labels

- **Accepted (technical direction)** — Approved architectural direction for this greenfield project
- **Proposed** — Awaiting named owner confirmation
- **Deferred** — Explicitly later

| ID | Decision | Status | Owner | Date | Reason | Alternatives | Consequences | Evidence | Review trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEC-001 | Use Python with Django 5.2 LTS for the backend | Accepted (technical direction) | Project technical lead (TBC name) | 2026-08-04 | Strong fit for forms, auth, admin, ORM, and small-team delivery | FastAPI+SPA; .NET | Django project structure; server-rendered first | Approved technical direction | Major framework upgrade or team skills change |
| DEC-002 | Deliver as a modular monolith | Accepted (technical direction) | Project technical lead (TBC) | 2026-08-04 | Solo/small team; shared transactions; lower ops burden | Microservices | Module discipline required; extraction later if needed | ADR-001 | Independent scale/team boundaries emerge |
| DEC-003 | PostgreSQL is the authoritative operational database | Accepted (technical direction) | IT owner (TBC) | 2026-08-04 | Relational integrity, ACID, reporting, JSONB where flexible | MongoDB primary; other RDBMS | Ops skill and hosting for PostgreSQL required | ADR-002 | Proven need for different primary store |
| DEC-004 | One responsive installable PWA | Accepted (technical direction) | Business / IT (TBC) | 2026-08-04 | Single codebase for operator to admin surfaces | Separate native apps | PWA constraints; offline later | ADR-003 | Pilot proves PWA insufficient |
| DEC-005 | No initial native mobile application | Accepted (technical direction) | Project owner (TBC) | 2026-08-04 | Avoid dual maintenance before pilot proof | Flutter / RN / native | Mobile features limited to PWA capabilities | ADR-003; mobile strategy | Post-pilot native reconsideration request |
| DEC-006 | Redis for cache, locks, and Celery broker/backend as needed | Accepted (technical direction) | IT owner (TBC) | 2026-08-04 | Background jobs and coordination | RQ only; DB broker | Redis operations required | Approved technical direction | Alternative job infra proposal |
| DEC-007 | Celery for scheduled and background processing | Accepted (technical direction) | IT owner (TBC) | 2026-08-04 | Fits Django ecosystem for async work | Dramatiq; cloud queues | Worker deployment required | Approved technical direction | Hosting model change |
| DEC-008 | MinIO locally; S3-compatible object storage in production for evidence | Accepted (technical direction) | IT owner (TBC) | 2026-08-04 | Keep binaries out of PostgreSQL | DB BLOBs; local disk only | Object-storage IAM and lifecycle needed | ADR-002; security baseline | Storage vendor change |
| DEC-009 | Django Templates + HTMX + Tailwind; minimal JS; Alpine.js only when needed | Accepted (technical direction) | Project technical lead (TBC) | 2026-08-04 | Fast server-driven UI with low JS complexity | React/Vue SPA | Different frontend skill profile | Approved technical direction | UX complexity exceeds HTMX comfort |
| DEC-010 | Local AI only as optional assistance; no paid external AI API required | Accepted (technical direction) | Project owner / QA (TBC) | 2026-08-04 | Cost, data control, non-critical assistance | Cloud AI APIs | Local model ops if used | AI safety policy | Business requests external AI |
| DEC-011 | AI must never make final food-safety, QA, loading-release, CAPA-closure, or access-control decisions | Accepted (technical direction) | QA owner (TBC) | 2026-08-04 | Safety and accountability | AI auto-decisioning | Human-in-the-loop mandatory | AI safety policy; constitution | Regulatory or policy change |
| DEC-012 | Private GitHub repository | Accepted (technical direction) | Project owner (TBC) | 2026-08-04 | Protect unpublished product and configs | Public repo | Access management required | Repo settings | Open-source decision |
| DEC-013 | Phase-by-phase delivery with branch/PR gates | Accepted (technical direction) | Project owner (TBC) | 2026-08-04 | Controllable greenfield delivery | Big-bang | Slower visible feature velocity | Roadmap; git rules | Delivery model change |
| DEC-014 | MVP includes exactly two approved checklist types | Proposed | QA / Business owners | TBC | Narrow pilot | Broader form set | Limits early value; reduces risk | MVP scope | Owner approval of form list |
| DEC-015 | Pilot site, users, devices, and dates | Proposed — DECISION REQUIRED | Business + QA + IT | TBC | Needed to bound pilot | Multiple sites first | Schedule and hardware planning blocked | Assumption register | Pilot planning workshop |
| DEC-016 | Hosting target for non-local environments | Proposed — DECISION REQUIRED | IT owner | TBC | Needed for env strategy execution | On-prem / cloud options | Cost, RPO/RTO, access model | Environment strategy | IT architecture approval |
| DEC-017 | Record retention period | Proposed — EVIDENCE REQUIRED | QA / Legal (TBC) | TBC | Compliance and storage sizing | Vary by record type | Backup and storage design | Controlled policy docs | Retention policy issued |

## Notes

- Unapproved business decisions (DEC-014 onward and similar) must not be implemented as if confirmed.
- Technical direction decisions still require named owner confirmation where “TBC” appears, but development may proceed against the stated direction in later authorized phases.

| DEC-046 | Phase 14: do not implement offline checklist drafts until evidence/approvals exist; continue online-only MVP | Accepted (2026-08-10) | Architecture + IT/QA gate review (owner signatures still EVIDENCE REQUIRED for any future offline enablement) | 2026-08-10 | Missing Wi-Fi/device/hosting/outage/security evidence; APR-022 open; ADR-003 online MVP | Build IndexedDB sync without surveys | Paper fallback for sustained outages; re-open Phase 14 on evidence | ADR-026; ADR-003; APR-022 | Written APR-022 approval + ASM-010 survey demonstrating offline need |

