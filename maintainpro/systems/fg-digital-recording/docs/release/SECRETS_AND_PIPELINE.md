# Phase 21 — Secrets and release pipeline

## Secrets

| Rule | Status |
| --- | --- |
| Company-controlled production secrets only | **Required** |
| Secrets in GitHub / git history | **Prohibited** — `.env` not for prod; use approved vault |
| Production `DJANGO_SECRET_KEY`, DB, Redis, storage keys | **NOT PROVISIONED** in recorded prod (no prod host) |

## CI / CD

| Item | Status |
| --- | --- |
| Controlled CI on `main` / PRs | Exists (ruff, mypy, bandit, pip-audit, pytest, image build) |
| Production deployment job | **NOT AUTHORIZED** — no automatic prod deploy from `main` |
| Explicit production gate | **CLOSED** — see [RELEASE_GATE.md](RELEASE_GATE.md) |

**Direct-main development ≠ production deployment.**
