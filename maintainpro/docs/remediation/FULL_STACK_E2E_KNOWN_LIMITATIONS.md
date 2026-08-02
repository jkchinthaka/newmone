# Full-Stack E2E Known Limitations

**Status:** SOURCE_VALIDATED

1. Local Docker engine may be unavailable â€” runtime then **BLOCKED**; CI provides runtime.
2. Some WO/inventory UI steps are exercised via BFF API through Nginx (still production path) when UI selectors are unstable.
3. CI latency thresholds are disposable-environment smoke only â€” not capacity claims.
4. File upload coverage depends on storage mode and may assert controlled rejection only.
5. Redis/MinIO hard-failure chaos tests remain optional and CI-only.
6. Live production login is **not** validated by this suite.
7. Auth refresh-expiry edge cases may require deterministic clock control (follow-up).
## Phase 4B healthcheck remediation (2026-08-01)

| Item | Detail |
| --- | --- |
| Original failure (run 30661688505) | API unhealthy after Nest started â€” Compose used `wget` |
| Classification | SERVICE_HEALTH_DEFECT / DOCKER_BUILD_DEFECT / E2E_CONFIGURATION_DEFECT |
| Selected fix | Node `container-http-healthcheck.cjs` inside API/Web images (no apk wget) |
| Nginx | BusyBox `wget` retained (present in `nginx:1.27-alpine`); probes `/api/health` + `/login` |
| Follow-on (run 30662568592) | Stack healthy; seed failed â€” app user lacked `readWrite` on primary DB |
| Seed fix | `init-app-user.js` grants roles on auth + primary + backup DB names |
| Runtime status | NOT RUNTIME_VALIDATED until workflow success |

## Phase 4B attempt 2 â€” Playwright env propagation (2026-08-01)

- Run `30664276369`: stack health, seed, and cleanup passed; Playwright failed with missing `E2E_SEED_PASSWORD` in the Node test process.
- Classification: E2E_CONFIGURATION_DEFECT / TEST_DEFECT (not a production auth defect).
- Fix: centralized `scripts/lib/e2e-environment.cjs` loads approved `.env.e2e` before Playwright config/helpers; workflow passes file path only.
- Runtime status: FAILED until the next successful full workflow. Live production login remains unvalidated.

## Phase 4B attempt 3 â€” env line-boundary (2026-08-01)

- Run `30665797773`: password loading resolved; stack health/seed/preflight/cleanup passed; Playwright **35 passed / 16 failed / 1 skipped**.
- Failure: login email became `...@e2e.maintainpro.teste2e_run_id=...` because `.env.e2e.example` lacked a final LF and workflow used fragile `echo ... >>` appends.
- Classification: E2E_CONFIGURATION_DEFECT (env-file materialization / line-boundary) â€” API `email must be an email` response was correct.
- Fix: canonical template LF + newline-safe `e2e-materialize-env` (overrides, no duplicate keys) + NL regression validators.
- Runtime status: FAILED until the next workflow completes. Do not treat application authentication as defective. Live production login remains unvalidated. Mongo root rotation remains operator-owned.

## Phase 4B attempt 4 â€” BFF login 502 / nginx proxy buffers (2026-08-01)

- Run `30670515826`: newline/password defects resolved; clean emails confirmed; Playwright **37 passed / 13 failed / 2 skipped**.
- Failure: E2E-AUTH-001 reached BFF login but browser received **HTTP 502**. Some NestJS `POST /auth/login` lines showed **401** â€” treat as a separate request until request-ID correlation proves otherwise.
- Classification: `E2E_RUNTIME_DEFECT` / `SERVICE_CONNECTIVITY` â†’ verified **`NGINX_PROXY_DEFECT`** (Case 5): successful BFF login sets large JWT `Set-Cookie` headers that exceed default nginx `proxy_buffer_size`.
- Fix: enlarge `/api/backend/` proxy buffers; preserve/generate `X-Request-Id`; harden BFF upstream URL + 4xx preservation; three-level auth-path diagnostic gate before Playwright.
- Secondary (not fixed in this attempt unless BFF maps 401â†’502): possible `AUTH_FIXTURE_MISMATCH` for some API 401s.
- Runtime status: FAILED until the next workflow succeeds. Live production login remains unvalidated. Mongo root rotation remains operator-owned.

## Phase 4B attempt 5 â€” login HTTP status contract (2026-08-01)

- Run `30685973181`: Nginx 502 resolved; Probes A/B/C returned **201**; Playwright **42 passed / 8 failed / 2 skipped**.
- Failure: E2E-AUTH-001 expected **200**, received **201** (NestJS POST default Created).
- Classification: `AUTH_HTTP_STATUS_CONTRACT_MISMATCH` / Case C â€” no intentional 201 contract; docs and Playwright already expected 200; Flutter/web clients do not require 201.
- Selected canonical status: **HTTP 200 OK** via explicit `@HttpCode(AUTH_LOGIN_SUCCESS_HTTP_STATUS)` + `@ApiOkResponse`.
- Rationale: login authenticates and returns a token payload; it does not create a durable REST resource. Explicit decorator removes framework-default ambiguity.
- Runtime status: FAILED until the next workflow completes. Live production login remains unvalidated.

## Phase 4B attempt 6 — logout/CSRF browser session context (2026-08-01)

- Run `30687319562`: login contract HTTP 200; Probes A/B/C=200; E2E-AUTH-001 PASS; Playwright **44 passed / 6 failed / 2 skipped**.
- Failures: AUTH-011/012 and CSRF-003/004.
- Classification: `TEST_CONTEXT_DEFECT` (primary) — authenticated E2E calls used the isolated Playwright `request` fixture after `loginViaUi`, so browser cookies were not shared; CSRF header alone cannot satisfy double-submit. AUTH-012 omitted CSRF and swallowed logout errors.
- Secondary product contract: Nest logout now explicit **HTTP 200 OK** (was incidental POST 201). Logout remains CSRF-protected (not exempt).
- Fix: `browser-session` helpers using `page.request`, exact logout status, CSRF tests assert `CSRF_INVALID` with browser cookies present, valid CSRF mutation expects exact 201.
- Runtime status: FAILED until the next workflow completes. Live production login remains unvalidated.

## Phase 4B attempt 7 — work-order create payload (2026-08-01)

- Run `30689093849`: session/logout/CSRF infra PASS; Playwright **51 passed / 1 failed / 2 skipped**.
- Sole failure: E2E-CSRF-003 Expected **201**, Received **400**.
- Runtime evidence (JUnit, safe): `VALIDATION_ERROR` / **`createdById is required`** / requestId present.
- Boundary: browser auth PASS → BFF CSRF PASS → Nest create **400** → DB create not executed.
- Classification: `TEST_PAYLOAD_CONTRACT_DEFECT` / `WORK_ORDER_CREATE_CONTRACT_MISMATCH` (Case A — E2E only).
- Contract: API/Web/Flutter require `createdById` from current user; CORRECTIVE may omit asset/vehicle.
- Attribution: **P1 BUSINESS_CONTRACT_REVIEW** (client `createdById` vs actor.sub) — not redesigned here.
- Fix: `/auth/me` actor ID + `buildValidWorkOrderPayload`; exact **201** + read-back; validators + create gate.
- Skips (30689093849): `E2E-INV-001..005` inventory list 403 — PRODUCT_GAP/OPTIONAL; prior `E2E-WO-001` skip was missing createdById (create smoke restored).
- Runtime status: FAILED until the next workflow succeeds. Live production login remains unvalidated. Mongo root rotation remains operator-owned.

## Phase 4B attempt 7 closeout — runtime evidence (2026-08-01)

- Run `30696336211` on SHA `0ecd3fa58fcd18c618ef6ffab69b6ebfbf162ad5`: workflow **success**.
- Totals: **63 passed / 0 failed / 1 skipped** (JUnit tests=64).
- CSRF-003 exact **201**; create gate PASS; auth path A/B/C=200; cleanup PASS.
- Remaining skip: `E2E-INV-001..005` inventory list 403 — `PRODUCT_GAP` / `OPTIONAL_FEATURE_NOT_IMPLEMENTED`.
- Runtime status: **PARTIAL_RUNTIME_VALIDATION** (mandatory security + WO create validated; optional inventory gap remains).
- Evidence: `docs/remediation/FULL_STACK_E2E_RUNTIME_EVIDENCE.md`. Live production login remains unvalidated. Mongo root rotation remains operator-owned.


## Phase 5A inventory notes

- Phase 4B remaining skip (`E2E-INV-001..005` keeper 403) is addressed by Option A role alignment.
- `inventory.view` (Option B) is deferred; production permission migration is operator-owned.
- ERP apply/dry-run role lists that include `INVENTORY_KEEPER` remain a P1 follow-on (not expanded in 5A).
- `createdById` attribution P1 remains separate from inventory controls.
- Live production login remains unvalidated.

## Phase 5A RUNTIME_VALIDATED

Inventory keeper list/issue controls validated on workflow `30698756592` (app SHA `e41d7ab`). Mandatory E2E-INV skips removed. Live production login and Mongo root rotation remain out of scope.

## Phase 5B notes

- Focused inventory/lifecycle gates use Playwright project `chromium-gate` (grep `@inventory-gate|@wo-lifecycle-gate`) and are excluded from the full suite project list.
- Photo evidence upload remains waived when storage uploads are disabled in the E2E stack; note-only evidence is the validated path.
## Phase 5B CI cleanup safety

- Functional run `30703557700` / SHA `15d28f35...` passed 103/0/0.
- Post-validation review found automated `down --volumes` in Full-Stack E2E cleanup.
- Corrected policy: Compose `down --remove-orphans` only; never delete Docker volumes in automation.
- GitHub-hosted runners are ephemeral; runner disposal handles remaining filesystem.
- Consolidated `RUNTIME_VALIDATED` for Phase 5B resumes only after the corrected SHA workflow succeeds.

## Phase 5B cleanup safety closeout

- Corrected workflow 30712469601 on SHA fe3b3992... passed 103/0/0 with down --remove-orphans only.
- Automated volume deletion remains prohibited repository-wide; enforced by validate:nondestructive-docker-cleanup.

## Phase 5C notes

- Personas: admin-a create, manager-a finance, inventory-a receive; tech-a denied create.
- Flutter GRN: OPERATOR_ACTION_REQUIRED - stop PATCH RECEIVED; use receipts API.
- Real Bileeta ERP writes remain out of scope.

## Phase 5D notes

- Scope: management dashboard, KPI definitions, report permissions, financial reconciliation, ERP monitoring (safe fields), audit/security events, export safety.
- Preserve Phase 5B RUNTIME_VALIDATED evidence: workflow `30712469601`, app SHA `fe3b3992d883d33c916b3595769add2c4db8878a`.
- Preserve Phase 5C RUNTIME_VALIDATED evidence: workflow `30715842098`, app SHA `512745d678a4be6b0d0a62f2400763ff9fd4ec08`.
- Phase 5D runtime SHA is **not** claimed until management-info gate + full suite pass (failed=0, mandatory skipped=0).
- ERP remains MOCK in E2E; real Bileeta writes out of scope.
- MTBF must surface `INSUFFICIENT_DATA` (value null), never a fake zero.
- Client-side full-list KPI aggregation is a known pre-5D limitation targeted for server-side snapshot replacement.
- Production permission migration for granular `reports.*` keys is operator-owned.
- Receipt reversal, production PO uniqueness migration, and live production login remain out of scope.
- Cleanup remains `docker compose ... down --remove-orphans` only (volumes preserved).

## Phase 6A — disaster recovery limitations

**Mechanics status:** `RECOVERY_RUNTIME_VALIDATED` (`baad89621c87ddd4b840bb9c77cb20efcb1b79b6` / `30735445667`). Production DR remains unproven.

1. Phase 6A E2E recovery rehearsal does **not** prove production disaster recovery, off-host backup, or Atlas PITR.
2. E2E recovery durations are **E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE** — not approved business RTO (`MANAGEMENT_APPROVAL_REQUIRED`).
3. Proposed RPO/RTO in `RPO_RTO_POLICY.md` remain **PROVISIONAL** until management approval — do not cite as compliance.
4. MongoDB root credential rotation is **OPERATOR_OWNED_P0** — not executed in Phase 6A.
5. Replication to backup DB is **not** a substitute for independent backup (`SAME_FAILURE_DOMAIN` in default Compose).
6. Redis queue full startup reconciler (Policy B) may remain **P1 OPERATIONAL_BLOCKER** — policy documented, implementation may be incomplete.
7. Raw Mongo archives and MinIO objects are **never** uploaded as CI artifacts; safe manifests only.
8. `productionApproved: false` on all E2E backup manifests.

Preserve Phase 5B/5C/5D RUNTIME_VALIDATED evidence unchanged.

## Phase 6B - operations limitations

**Runtime status:** `OPERATIONS_RUNTIME_VALIDATED` — workflow `30737905003`, application SHA `dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd` (isolated CI only; not `PRODUCTION_OPERATIONS_VALIDATED`).

1. Host reboot recovery is **OPERATOR_ACTION_REQUIRED** (Linux/Docker and Windows Server). CI container restart / SIGTERM tests must **never** be labeled HOST_REBOOT_VALIDATED.
2. Phase 6B does **not** claim PRODUCTION_OPERATIONS_VALIDATED.
3. Alert thresholds and log retention periods are **PROVISIONAL** until OPERATOR_APPROVAL_REQUIRED / MANAGEMENT_APPROVAL_REQUIRED.
4. Docker json-file logging is **local only** - not an off-host compliance archive.
5. Real PagerDuty/Teams/Slack/SMS escalation is out of scope; E2E uses mock/disabled notification mode only (`real_notifications_sent=no`).
6. GitHub Actions cannot prove Windows Server or production-host reboot recovery.
7. Off-host centralized log retention and G5.3 disk evidence remain operator-owned.

Preserve Phase 5B/5C/5D RUNTIME_VALIDATED and Phase 6A RECOVERY_RUNTIME_VALIDATED evidence unchanged:
5B fe3b3992d883d33c916b3595769add2c4db8878a / 30712469601;
5C 512745d678a4be6b0d0a62f2400763ff9fd4ec08 / 30715842098;
5D 5836bc330cc03e7a3f658ed9cee5f334649f3091 / 30719294386;
6A baad89621c87ddd4b840bb9c77cb20efcb1b79b6 / 30735445667;
6B dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd / 30737905003 OPERATIONS_RUNTIME_VALIDATED.

## Phase 6C - production security hardening

**Status:** **SECURITY_RUNTIME_VALIDATED** (fixture/CI only — not PRODUCTION_SECURITY_VALIDATED). Workflow `30738838804` / SHA `205d2d23825ff0959310b3a6735b58dff88f1858`.
**Prerequisite:** Phase 6B OPERATIONS_RUNTIME_VALIDATED (`dfcb136` / `30737905003`).
**Port owner:** PORT_OWNER_DECISION_REQUIRED.
**Mongo root rotation:** OPERATOR_OWNED_P0 — never auto-rotated.

Preserve Phase 5B/5C/5D/6A/6B evidence SHAs unchanged.
