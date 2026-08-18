# Nelna FG Digital Recording System

Secure, auditable Finished Goods digital recording delivered as a modular Django monolith with a responsive web UI. Longer-term direction includes an installable PWA (ADR-003); **PWA is not implemented yet**.

## Project purpose

Provide named-account, scoped-role digital recording, checking, verification, evidence capture, and audit export for Finished Goods operations — using approved business rules only, with Sinhala-capable operator experiences, without requiring ERP availability for factory-floor recording.

## Canonical status

**Prefer [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** over summary tables in this README when they differ.

| Label | Current claim |
| --- | --- |
| Implementation baseline | Phase **10A** QA disposition foundation on `main` (see PROJECT_STATUS for SHA) |
| Production readiness | **Not claimed** |
| UAT | **Not passed** |
| FG-QA-001 | Project-proposed **DRAFT** only — **not** approved for production |
| DB platform | PostgreSQL (+ Redis). MongoDB is **not** part of the architecture |

Status vocabulary (IMPLEMENTED ≠ BUSINESS APPROVED ≠ PRODUCTION READY) is defined in PROJECT_STATUS.

## Phase summary (evidence-based)

| Phase | Status |
| --- | --- |
| Phase 00 — Discovery and governance | Complete; governance baseline refreshed 2026-08-09 |
| Phase 01A–01C — Design | Approved (01C with deferred Sinhala condition; DEBT-01C-R-NOTO open) |
| Phase 02 — Django/PostgreSQL foundation | Approved with conditions; merged |
| Phase 03 — Accounts / scoped RBAC | Approved with conditions; merged |
| Authentication UI polish | Merged (English foundation; not Sinhala UI approval) |
| Phase 04A/04B — Shift foundation + UI | Implemented; official Shift values still evidence-required |
| Phase 05A/05B — FG Product foundation | Implemented; MASTER-001 evidence-required |
| Phase 06A–06E — Checklist definition / draft loader / provisional workflow | Implemented; FG-QA-001 not production-approved |
| Phase 07A/07B — ChecklistTask + batch-source readiness | Implemented; real generation blocked |
| Phase 08A/08B — Draft recording + immutable submission | Implemented; production recording blocked |
| Phase 09A/09B — Supervisor review + correction | Implemented; production review blocked |
| Phase 10A — QA final disposition (manual RELEASE/HOLD/REJECT) | Implemented; production QA blocked; no ERP side effects |
| Phase 11+ | Not started |

**Numbering rule:** Preserve roadmap phase numbers. Do **not** relabel later modules as Phase 04.

**Deferred Sinhala condition:** Noto Sans Sinhala is **not** finally verified. Operator Sinhala UAT, pilot, and production remain **blocked** until DEBT-01C-R-NOTO is closed with evidence.

## Approved architecture (technical direction)

| Area | Direction |
| --- | --- |
| Backend | Python 3.13.x, Django 5.2 LTS |
| Architecture | Modular monolith |
| Database | PostgreSQL 17.x (+ JSONB where appropriate) |
| Cache / jobs | Redis, Celery |
| Dependency mgmt | uv (`pyproject.toml` + `uv.lock`) |
| UI | Django Templates, HTMX, Tailwind; **no PWA yet** |
| Evidence | MinIO locally later; S3-compatible object storage in production (Phase 11) |
| Local dev | Docker Compose (`compose.yaml`) |
| Identity | Employee-code session authentication; scoped RBAC; security audit events — **no seeded users/orgs/roles** |
| Tests | Pytest via host `uv` **or** Compose profile `test` |
| CI | GitHub Actions quality gates |
| AI | Optional local assistance later; never final FS/QA/loading/CAPA/access decisions |

Exact pins: [docs/architecture/PHASE_02_TECHNICAL_BASELINE.md](docs/architecture/PHASE_02_TECHNICAL_BASELINE.md).

## Repository status

| Item | Status |
| --- | --- |
| Application modules on `main` | `core`, `accounts`, `organizations`, `access_control`, `security_audit`, `master_data`, `checklists`, `scheduling`, `recording`, `reviews`, `quality` |
| Production readiness | **Not claimed** |
| Secrets in repo | None intended; do not add any |
| Governance | [docs/governance/](docs/governance/) |

## Quick start (local)

Prefer `C:\Projects\nelna-fg-digital-recording-system` on Windows (not OneDrive). See [docs/operations/LOCAL_DEVELOPMENT.md](docs/operations/LOCAL_DEVELOPMENT.md).

```powershell
Copy-Item .env.example .env
uv sync --locked
npm ci
npm run build
docker compose up -d postgres redis
uv run python manage.py migrate
uv run python manage.py runserver 127.0.0.1:8000
```

Docker validation (dedicated `test` service — not `web`):

```powershell
docker compose up -d postgres redis
docker compose --profile test build test
docker compose --profile test run --rm test pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
docker compose down --volumes
```

Do **not** use `docker compose run --rm web pytest` — pytest is intentionally absent from the runtime image. See [docs/operations/DOCKER_DEVELOPMENT.md](docs/operations/DOCKER_DEVELOPMENT.md).

## Documentation map (selected)

| Document | Path |
| --- | --- |
| **Canonical project status** | [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) |
| Engineer handover / onboarding | [docs/handover/HANDOVER_README.md](docs/handover/HANDOVER_README.md) |
| Governance index | [docs/governance/README.md](docs/governance/README.md) |
| Approval register | [docs/governance/APPROVAL_REGISTER.md](docs/governance/APPROVAL_REGISTER.md) |
| Roadmap | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Module map | [docs/architecture/MODULE_MAP.md](docs/architecture/MODULE_MAP.md) |
| Assumption register | [docs/business/ASSUMPTION_REGISTER.md](docs/business/ASSUMPTION_REGISTER.md) |
| Continuity / handover | [docs/operations/CONTINUITY_AND_HANDOVER_PLAN.md](docs/operations/CONTINUITY_AND_HANDOVER_PLAN.md) |
| Approvals index | [docs/approvals/](docs/approvals/) |
| Local development | [docs/operations/LOCAL_DEVELOPMENT.md](docs/operations/LOCAL_DEVELOPMENT.md) |
| Testing guide | [docs/testing/TESTING_GUIDE.md](docs/testing/TESTING_GUIDE.md) |

## Contribution workflow

1. Prefer phase-specific branches and pull requests for review when practical.
2. Do not force-push to `main` or merge without human review.
3. Do not invent Nelna operational values; use assumption/evidence gates and the Approval Register.
4. Do not deploy to production without explicit written approval.
5. Follow version-controlled Cursor rules under `.cursor/rules/`.
6. Keep PROJECT_STATUS truthful when capability status changes.

## Next action

1. Drive open items in [docs/governance/APPROVAL_REGISTER.md](docs/governance/APPROVAL_REGISTER.md) (especially FG-QA-001, role mappings, batch source, hosting).
2. Keep **DEBT-01C-R-NOTO** open until Noto Sans Sinhala is evidenced.
3. Re-run Phase 10A Docker validation when the Docker engine is healthy (no new business features required for that).
4. Do **not** claim UAT, pilot, or production readiness until gates and written approvals close.

## License / confidentiality

Internal project materials. Do not publish secrets, production data, or unsupported compliance claims.
