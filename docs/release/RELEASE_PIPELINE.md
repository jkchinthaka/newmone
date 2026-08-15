# Phase 21 — Release pipeline

| Item | Status |
| --- | --- |
| CI quality gates (ruff/mypy/bandit/pip-audit/tests/image) | Present on `main` (`.github/workflows/ci.yml`) |
| Automatic deploy to production on `main` push | **MUST NOT** — not configured; must remain disabled |
| Explicit production deployment gate | **REQUIRED** — human approval after [RELEASE_GATE.md](RELEASE_GATE.md) PASS |
| Release version / git tag | **FORBIDDEN until all gates PASS** — no `v*` production tag created for Phase 21 |

Direct-main development history does **not** authorize production deployment.
