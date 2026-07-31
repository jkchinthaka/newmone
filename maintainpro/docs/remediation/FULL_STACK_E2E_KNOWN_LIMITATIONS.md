# Full-Stack E2E Known Limitations

**Status:** SOURCE_VALIDATED

1. Local Docker engine may be unavailable — runtime then **BLOCKED**; CI provides runtime.
2. Some WO/inventory UI steps are exercised via BFF API through Nginx (still production path) when UI selectors are unstable.
3. CI latency thresholds are disposable-environment smoke only — not capacity claims.
4. File upload coverage depends on storage mode and may assert controlled rejection only.
5. Redis/MinIO hard-failure chaos tests remain optional and CI-only.
6. Live production login is **not** validated by this suite.
7. Auth refresh-expiry edge cases may require deterministic clock control (follow-up).
## Phase 4B healthcheck remediation (2026-08-01)

| Item | Detail |
| --- | --- |
| Original failure (run 30661688505) | API unhealthy after Nest started — Compose used `wget` |
| Classification | SERVICE_HEALTH_DEFECT / DOCKER_BUILD_DEFECT / E2E_CONFIGURATION_DEFECT |
| Selected fix | Node `container-http-healthcheck.cjs` inside API/Web images (no apk wget) |
| Nginx | BusyBox `wget` retained (present in `nginx:1.27-alpine`); probes `/api/health` + `/login` |
| Follow-on (run 30662568592) | Stack healthy; seed failed — app user lacked `readWrite` on primary DB |
| Seed fix | `init-app-user.js` grants roles on auth + primary + backup DB names |
| Runtime status | NOT RUNTIME_VALIDATED until workflow success |

## Phase 4B attempt 2 — Playwright env propagation (2026-08-01)

- Run `30664276369`: stack health, seed, and cleanup passed; Playwright failed with missing `E2E_SEED_PASSWORD` in the Node test process.
- Classification: E2E_CONFIGURATION_DEFECT / TEST_DEFECT (not a production auth defect).
- Fix: centralized `scripts/lib/e2e-environment.cjs` loads approved `.env.e2e` before Playwright config/helpers; workflow passes file path only.
- Runtime status: FAILED until the next successful full workflow. Live production login remains unvalidated.
