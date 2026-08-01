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

## Phase 4B attempt 3 — env line-boundary (2026-08-01)

- Run `30665797773`: password loading resolved; stack health/seed/preflight/cleanup passed; Playwright **35 passed / 16 failed / 1 skipped**.
- Failure: login email became `...@e2e.maintainpro.teste2e_run_id=...` because `.env.e2e.example` lacked a final LF and workflow used fragile `echo ... >>` appends.
- Classification: E2E_CONFIGURATION_DEFECT (env-file materialization / line-boundary) — API `email must be an email` response was correct.
- Fix: canonical template LF + newline-safe `e2e-materialize-env` (overrides, no duplicate keys) + NL regression validators.
- Runtime status: FAILED until the next workflow completes. Do not treat application authentication as defective. Live production login remains unvalidated. Mongo root rotation remains operator-owned.

## Phase 4B attempt 4 — BFF login 502 / nginx proxy buffers (2026-08-01)

- Run `30670515826`: newline/password defects resolved; clean emails confirmed; Playwright **37 passed / 13 failed / 2 skipped**.
- Failure: E2E-AUTH-001 reached BFF login but browser received **HTTP 502**. Some NestJS `POST /auth/login` lines showed **401** — treat as a separate request until request-ID correlation proves otherwise.
- Classification: `E2E_RUNTIME_DEFECT` / `SERVICE_CONNECTIVITY` → verified **`NGINX_PROXY_DEFECT`** (Case 5): successful BFF login sets large JWT `Set-Cookie` headers that exceed default nginx `proxy_buffer_size`.
- Fix: enlarge `/api/backend/` proxy buffers; preserve/generate `X-Request-Id`; harden BFF upstream URL + 4xx preservation; three-level auth-path diagnostic gate before Playwright.
- Secondary (not fixed in this attempt unless BFF maps 401→502): possible `AUTH_FIXTURE_MISMATCH` for some API 401s.
- Runtime status: FAILED until the next workflow succeeds. Live production login remains unvalidated. Mongo root rotation remains operator-owned.
