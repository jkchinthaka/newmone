# Phase 21 — Release package

**Hard rule:** Do not invent go-live PASS, production hosts, secrets, loaded catalogues, or signatures.

| Document | Role |
| --- | --- |
| [HARD_PREREQUISITES.md](HARD_PREREQUISITES.md) | STOP gate |
| [RELEASE_GATE.md](RELEASE_GATE.md) | UAT/pilot/QA/IT/management approvals |
| [PRODUCTION_ENVIRONMENT.md](PRODUCTION_ENVIRONMENT.md) | Prod stack verification |
| [ENVIRONMENT_SEPARATION.md](ENVIRONMENT_SEPARATION.md) | local / test / staging-UAT / production |
| [PRODUCTION_DATA_LOAD.md](PRODUCTION_DATA_LOAD.md) | Approved config load checklist |
| [SECRETS_AND_PIPELINE.md](SECRETS_AND_PIPELINE.md) | Secrets + CI/CD production gate |
| [SECRETS_AND_VAULT.md](SECRETS_AND_VAULT.md) | Vault custody notes (if present) |
| [RELEASE_PIPELINE.md](RELEASE_PIPELINE.md) | Pipeline gate notes (if present) |
| [DB_CHANGE_AND_SMOKE.md](DB_CHANGE_AND_SMOKE.md) | Migration backup + controlled smoke |
| [DATABASE_CHANGE_CONTROL.md](DATABASE_CHANGE_CONTROL.md) | DB change control (if present) |
| [PRODUCTION_SMOKE_TEST.md](PRODUCTION_SMOKE_TEST.md) | Smoke checklist (if present) |
| [SUPPORT_AND_HANDOVER.md](SUPPORT_AND_HANDOVER.md) | Support model + handover |
| [SUPPORT_MODEL.md](SUPPORT_MODEL.md) | Support contacts (if present) |
| [HANDOVER_CHECKLIST.md](HANDOVER_CHECKLIST.md) | Handover checklist (if present) |
| [BUS_FACTOR.md](BUS_FACTOR.md) | Repo/vault/infra ownership |
| [PAPER_DECOMMISSION.md](PAPER_DECOMMISSION.md) | Paper must continue until approved |
| [POST_GO_LIVE.md](POST_GO_LIVE.md) / [POST_GO_LIVE_MONITORING.md](POST_GO_LIVE_MONITORING.md) | Post-release monitoring |
| [PHASE_21_FINAL_REPORT.md](PHASE_21_FINAL_REPORT.md) | Go / no-go |
| [GO_LIVE_SIGNOFF.md](GO_LIVE_SIGNOFF.md) | Blank business/IT signoff |
| [../business/PHASE_21_PRODUCTION_RELEASE.md](../business/PHASE_21_PRODUCTION_RELEASE.md) | Phase narrative |
| [../architecture/ADR-033-PRODUCTION-GO-LIVE-GATE.md](../architecture/ADR-033-PRODUCTION-GO-LIVE-GATE.md) | Process ADR |

## Current outcome

**STATUS: PHASE 21 GO-LIVE BLOCKED** — see [PHASE_21_FINAL_REPORT.md](PHASE_21_FINAL_REPORT.md).
