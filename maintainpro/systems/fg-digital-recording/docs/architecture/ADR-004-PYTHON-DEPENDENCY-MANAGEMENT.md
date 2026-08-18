# ADR-004 — Python Dependency Management

**Status:** Accepted (Phase 02 technical foundation)
**Date:** 2026-08-05
**Phase:** 02 — Django/PostgreSQL foundation
**Branch:** `foundation/django-postgresql`

## Context

Phase 02 introduces application code with pinned runtime and tool dependencies. The project needs reproducible installs for local development, Docker images, and CI without committing secrets or inventing operational data.

## Decision

Use **uv** as the Python package and environment manager, with:

| Artefact | Role |
| --- | --- |
| `pyproject.toml` | Declared dependencies and tool config (ruff, mypy, pytest, coverage, djlint, bandit) |
| `uv.lock` | Locked transitive resolution — required for reproducible sync |
| Dependency groups | `development`, `testing`, `security` (default-synced locally via `[tool.uv]`) |
| CI / Docker | `uv sync --locked` (or `--frozen` in image builds) |

Pinned toolchain for Phase 02:

| Tool / runtime | Version |
| --- | --- |
| Python | 3.13.14 |
| uv | 0.11.29 |

Runtime packages are exact-pinned in `pyproject.toml` (see [PHASE_02_TECHNICAL_BASELINE.md](PHASE_02_TECHNICAL_BASELINE.md)).

## Alternatives considered

| Option | Why not selected |
| --- | --- |
| pip + `requirements.txt` only | Weaker lock/reproducibility story than uv lock |
| Poetry | Extra tool surface; uv already covers install + lock for this stack |
| Unpinned ranges only | CI and Docker drift risk |

## Consequences

- Contributors install with `uv sync --locked`.
- Lockfile changes are reviewable in PRs (`uv lock --check` in CI).
- New dependencies require an explicit pin and lockfile update; justify non-trivial additions in an ADR or decision register entry.
- Production images sync without development/testing/security groups.

## Non-claims

- This ADR does not approve production deployment.
- This ADR does not close DEBT-01C-R-NOTO.

## References

- [PHASE_02_TECHNICAL_BASELINE.md](PHASE_02_TECHNICAL_BASELINE.md)
- [ADR-001-MODULAR-MONOLITH.md](ADR-001-MODULAR-MONOLITH.md)
- `pyproject.toml`, `uv.lock`
