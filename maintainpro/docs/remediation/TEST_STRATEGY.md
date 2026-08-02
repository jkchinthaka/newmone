# Test Strategy

**Goal:** Prove production readiness with evidence; never target production data for destructive or mutable E2E.

## 1. Test layers

| Layer | Purpose | Primary location | Gate |
| --- | --- | --- | --- |
| Unit | Pure logic, DTO validation, mappers | `apps/api/test/*.spec.ts`, web utils | PR |
| Integration | Nest + Prisma (test DB) | API Jest | PR |
| Contract | Request/response shapes | OpenAPI (planned) + form matrix | P1 |
| AuthN | Login, refresh, logout, cookie flags | API + BFF + Playwright | P0 |
| AuthZ / RBAC | Role/permission denial | `audit:rbac`, Jest RBAC suites | PR |
| Tenant isolation | Cross-tenant IDOR | Existing isolation suites | PR |
| CSRF / cookies | Double-submit, HttpOnly, Secure policy | BFF + Nest | P0 |
| HTTP-mode | Insecure cookie opt-in behaviour | New tests | P0 |
| Nginx routing | `/api/backend` vs `/api` | Compose/nginx integration | P0 |
| Full-stack E2E | Browser→Nginx→BFF→API→Mongo→Redis→MinIO | New disposable stack | P1 |
| ERP workflows | WO, stock, PO approvals | API e2e + Playwright | P1 |
| Inventory reconciliation | Movement sum = on-hand | DB assertions | P1 |
| Audit trail | Sensitive actions produce logs | Jest + e2e | P1 |
| Upload security | Type/size/path traversal | API tests | P1 |
| Queues / notifications | Bull jobs degrade safely | API tests | P2 |
| Performance | p50/p95/p99 | k6/Artillery against staging | P2 |
| Load / soak | Concurrent users, memory | Staging only | P2 |
| Backup / restore | mongodump restore counts | Ops runbook | P1 |
| Reboot | Docker auto-start | Windows Server drill | P1 |
| Rollback | Redeploy previous SHA | Deploy runbook | P1 |
| Browser / mobile / a11y | Chromium+Firefox+WebKit; responsive; axe | Playwright | P2 |

## 2. Environments

| Env | Data | Mutating tests | Notes |
| --- | --- | --- | --- |
| Local disposable | Seeded throwaway | Yes | Docker compose test profile |
| CI | Ephemeral | Yes | Current PR validation |
| Staging | Non-prod | Limited | Real URLs, synthetic users |
| Production | Real | **No** automated mutators | Read-only probes only |

## 3. Authentication test matrix (target architecture)

| Case | Expected |
| --- | --- |
| Valid login via `/api/backend/auth/login` | **HTTP 200 OK** (exact); **HttpOnly** access+refresh cookies; CSRF readable cookie; **no** access/refresh in localStorage; tokens stripped from JSON |
| Login over HTTP with secure defaults | Cookies may be rejected — session fails (documents need for explicit HTTP mode) |
| HTTP mode with `COOKIE_SECURE=false` + `ALLOW_INSECURE_HTTP=true` | Cookies set without Secure; warning logged |
| Mutation without CSRF | HTTP 403 |
| Refresh with reused revoked token | Family revoked |
| Logout | Cookies cleared |
| Unauthenticated `/api/backend/auth/me` | HTTP 401 (not 404) |

**Stale tests to replace:** ~~`apps/web/e2e/auth.spec.ts` expectations that `localStorage.maintainpro_access_token` is set.~~ **Phase 2:** e2e updated to assert null localStorage tokens + HttpOnly cookies (AUTH-STORAGE-001/002).

### Phase 2 automated coverage (source)

| Test ID | Coverage |
| --- | --- |
| HTTP-CONFIG-001…003 | `runtime-security-config.spec.ts` |
| COOKIE-001…003 | same |
| BFF-001…003 | `bff-auth.spec.ts` + `bff-backend-route.spec.ts` |
| CSRF-001…003 | `bff-backend-route.spec.ts` + exemption table |
| NGINX-BFF-001…002 | `scripts/validate-nginx-bff-routing.mjs` |
| AUTH-STORAGE-001…002 | cookie option + e2e assertions |
| HTTP-BFF-001…012 | Operator spec only — `HTTP_BFF_SMOKE_TEST.md` |

## 4. Nginx / BFF routing tests

1. `POST /api/backend/auth/login` hits Next (response lacks Nest-only headers pattern / sets frontend cookies).
2. `GET /api/health` hits Nest, HTTP 200.
3. `GET /api/backend/does-not-exist` is handled by BFF/Next, not Nest 404 HTML mismatch.
4. WebSocket `/socket.io` still reaches API.

## 5. Real-stack Playwright plan

```text
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up
seed disposable tenant A/B
playwright against http://localhost/login
stop E2E Compose project with volumes preserved
```

**Must cover:** login, tenant switch, create WO, stock issue (no negative), PO approval path, forbidden cross-tenant read, CSRF failure, session expiry UX.

## 6. ERP workflow tests (minimum)

| Workflow | Assertions |
| --- | --- |
| Stock out > available | Rejected; stock unchanged; audit reason |
| Part request approve + issue | Qty decreases once; WO link |
| PO operational then finance | Status transitions only in order |
| Same user SoD (if policy) | Second approval denied |
| ERP sync retry | Idempotent; mismatch recorded |

## 7. Performance budgets (initial proposals — confirm with business)

| Journey | p95 target (staging) |
| --- | --- |
| `GET /api/health` | ≤ 500 ms (95 of 100) |
| Login | ≤ 1500 ms |
| WO list page interactive | ≤ 3000 ms |
| Inventory list | ≤ 3000 ms |
| Report export (small) | ≤ 10 s |

## 8. Security tests

- External TCP connect to 27018/6379/9000/9001/3000/3001 from non-localhost **fails**.
- Only 80 publicly open during HTTP phase.
- Upload rejects executable content types.
- Secrets not present in image history (`docker history` / build args review).

## 9. Evidence standard

Every P0/P1 TODO acceptance criterion must attach:

- command output or CI run URL,
- screenshot or HAR for browser auth,
- commit SHA under test,
- environment name (never prod for mutators).

## 10. Non-goals

- Running `db:reset:all` against shared/staging without confirmations.
- Load testing production.
- Disabling auth to “make e2e easier”.
---

## Phase 1 test IDs (automated)

| ID | Automation |
| --- | --- |
| SEC-CONFIG-001 | `npm run validate:secret-safety` |
| SEC-CONFIG-002 | `npm run validate:secret-safety` |
| SEC-CONFIG-003 | `npm run validate:secret-safety` + compose config |
| SEC-CONFIG-004 | compose config with missing vars (expect failure) + validator |
| DEPLOY-CONFIG-001 | `docker compose ... config --quiet` base + production |
| DEPLOY-CONFIG-002 | `node scripts/validate-image-secret-paths.mjs ...` |
| NET-PORT-001 | `npm run validate:secret-safety` |
| NET-PORT-002 | `npm run validate:secret-safety` |
---

## Phase 2 closeout test IDs

COOKIE-CLOSE-001…010 covered by `bff-backend-route.spec.ts`, `nest-auth-cookies.spec.ts`, `runtime-security-config.spec.ts`, and e2e auth cookie assertions.

---

## Phase 3 source progress (2026-08-01)

| Item | Status |
| --- | --- |
| Branch / release model | SOURCE_VALIDATED (`RELEASE_BRANCH_STRATEGY.md`) |
| Build metadata strategy | SOURCE_VALIDATED (`APP_*` + readiness assessment) |
| Immutable API/Web image tags | SOURCE_VALIDATED (`maintainpro-*:${APP_COMMIT_SHA}`) |
| Deployment scenarios | SOURCE_VALIDATED (`DEPLOYMENT_SCENARIOS.md`) |
| Rollback architecture | SOURCE_VALIDATED (`PRODUCTION_ROLLBACK_RUNBOOK.md`) |
| Schema-change gate | SOURCE_VALIDATED (`PRISMA_SCHEMA_CHANGE_GATE.md`) |
| Branch protection operator config | OPERATOR_ACTION_REQUIRED |
| Mongo root rotation | BLOCKED / OPERATOR_ACTION_REQUIRED |
| Live HTTP smoke | OPERATOR_RUNTIME_VALIDATION_REQUIRED |
| Docker image secret-path scan (local engine) | BLOCKED when Docker unavailable; CI runs on ubuntu |
| Port 80 IIS vs Nginx ownership | unanswered (A-03) |
| Production deployment | NOT DONE (Phase 3 forbids live deploy) |

## Phase 3 release tests

| ID | Coverage |
| --- | --- |
| DEPLOY-REL-001..018 | `scripts/test/release-phase3.selftest.mjs` (`npm run test:release`) |
| Build metadata | `apps/api/test/release-metadata.spec.ts` |

---

## Phase 4 source progress (2026-08-01)

| Item | Status |
| --- | --- |
| Isolated E2E Compose | SOURCE_VALIDATED |
| E2E safety / no-mock validators | SOURCE_VALIDATED |
| Real-stack Playwright suite | SOURCE_VALIDATED |
| Full-stack E2E CI workflow | SOURCE_VALIDATED |
| Docker runtime on this agent | BLOCKED / OPERATOR_RUNTIME_VALIDATION_REQUIRED when engine down |
| Live production login | NOT validated |
| Node-based API/Web healthchecks | SOURCE_VALIDATED (Phase 4B) |
| Full-stack CI runtime | NOT RUNTIME_VALIDATED |

| Playwright E2E env loader | SOURCE_VALIDATED (Phase 4B attempt 2) |
| E2E env line-boundary / materialize | SOURCE_VALIDATED (Phase 4B attempt 3) |
| BFF upstream / nginx buffer / auth-path probes | SOURCE_VALIDATED (Phase 4B attempt 4) |
| Login success HTTP 200 contract | SOURCE_VALIDATED (Phase 4B attempt 5) |
| Browser session / logout CSRF request-context | SOURCE_VALIDATED (Phase 4B attempt 6; runtime pending) |
| Work-order create payload (`createdById` via `/auth/me`) | SOURCE_VALIDATED (Phase 4B attempt 7; runtime pending) |
| Full-stack E2E CI runtime (attempt 7 SHA `0ecd3fa`) | PARTIAL_RUNTIME_VALIDATION (INV optional skip) |

## Phase 5A inventory validation

Static: `npm run validate:e2e-inventory-controls`, `test:inventory-access-contract`, `test:inventory-stock-issue-contract`.
CI: inventory controls gate after work-order create gate, before full Playwright suite.
Mandatory E2E-INV-001..016 must not use `test.skip`.

## Docker cleanup policy (Phase 5B+)

Automated E2E and CI cleanup must use docker compose ... down --remove-orphans only. Validate with 
npm run validate:nondestructive-docker-cleanup.

### Forbidden

- docker compose down -v
- docker compose down --volumes
- docker volume rm
- docker volume prune
- docker system prune

## Phase 5C procurement

Validate with validate:e2e-procurement-controls, contract self-tests, and Playwright @procurement-gate.
Mock ERP only. No direct PATCH RECEIVED.

## Phase 5D management information gate

Validate with:

- `npm run validate:e2e-management-info-controls` (when added)
- Contract self-tests for KPI/MTBF insufficient-data, financial basis, export neutralization, date/currency bounds
- Playwright focused gate: `@management-info-gate` (E2E-DASH / E2E-KPI / E2E-REPORT / E2E-AUDIT / E2E-ERP-MON)
- Full-Stack E2E after the focused gate; cleanup nondestructive

Assertions of record:

- Server-side dashboard snapshot (no page-25 WO aggregation for org KPIs)
- Module permissions + dual export permission
- Default Total Expenses excludes PO committed and WO parts when `actualCost` present
- MTBF null + INSUFFICIENT_DATA when intervals insufficient
- Login failure events store no passwords/tokens
- CSV formula prefixes neutralized
- MOCK ERP only; safe monitoring fields only

Preserve Phase 5B/5C evidence SHAs; do not invent Phase 5D runtime SHA early.

Authoritative evidence to preserve: Phase 5B fe3b3992d883d33c916b3595769add2c4db8878a / workflow 30712469601; Phase 5C 512745d678a4be6b0d0a62f2400763ff9fd4ec08 / workflow 30715842098.

## Phase 6A — recovery gate recipe

**Tag:** `@recovery-gate` (focused) + DR-E2E / DR-INTEGRITY / DR-OBJECT IDs in Full-Stack workflow.

### Execution order (after seed, alongside existing gates)

1. `npm run validate:recovery-safety`
2. `node scripts/recovery/validate-recovery-target.mjs` (DR-E2E-001)
3. Create Mongo backup → manifest → checksum (DR-E2E-002..004)
4. Corruption rejection on copied archive (DR-E2E-005, DR-INTEGRITY-*)
5. Restore to fresh `maintainpro_restore_*` without drop (DR-E2E-006..009)
6. Boot temporary recovery API — health, login, WO/inventory/PO/dashboard reads (DR-E2E-010..015)
7. Object backup/restore reconcile (DR-E2E-016..017, DR-OBJECT-*)
8. Assert replication ≠ backup in readiness (DR-E2E-018)
9. Full Playwright suite; cleanup `down --remove-orphans` only (DR-E2E-020)

### Contract tests

`npm run test:backup-manifest-contract`, `test:mongo-restore-contract`, `test:object-recovery-contract`, `test:recovery-readiness-contract`, `test:recovery-safety-contract`

### Timing evidence

Label all recovery durations **E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE** — not approved RTO.

**Runtime:** `RECOVERY_RUNTIME_VALIDATED` — SHA `baad89621c87ddd4b840bb9c77cb20efcb1b79b6` / workflow `30735445667` / full suite 103/0/0.

Preserve Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / `30715842098`; Phase 5D `5836bc330cc03e7a3f658ed9cee5f334649f3091` / `30719294386`.

## Phase 6B - operations gate recipe

**Tag focus:** `@operations-gate` covering E2E-OPS IDs; exact-service rehearsal covers restart + Mongo/Redis/MinIO recovery.

### Execution order (disposable E2E stack)

1. Confirm contracts present under docs/remediation (Phase 6B set).
2. Boot stack; poll GET /api/health/live until 200 (container HC target).
3. Poll GET /api/health/ready until 200 before traffic tests (CI gate).
4. E2E-OPS: correlation - valid X-Request-Id echoed; missing ID generated; invalid replaced; ID not used as metrics label in any scrape fixture.
5. E2E-OPS: ready returns 503 reasons when primary Mongo stopped (controlled); live remains 200 if process up.
6. E2E-FAIL: SIGTERM API container; assert ready=503 then clean exit within grace; restart reaches ready=200.
7. E2E-QUEUE: Redis flush/cold; Mongo pending anchor; restart API; stable jobId enqueued once; second reconcile idempotent.
8. Assert detailed /api/health/readiness rejects unauthorized (403).
9. Full Playwright suite; cleanup down --remove-orphans only.
10. Do **not** claim HOST_REBOOT_VALIDATED or PRODUCTION_OPERATIONS_VALIDATED from this recipe.

### Runtime evidence

**Runtime:** `OPERATIONS_RUNTIME_VALIDATED` — SHA `dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd` / workflow `30737905003` / ops gate 11/0/0 / full suite 103/0/0 / `volumes_removed=no` / `real_notifications_sent=no`.

### Threshold / retention notes

Alert numbers and log retention remain PROVISIONAL / OPERATOR_APPROVAL_REQUIRED / MANAGEMENT_APPROVAL_REQUIRED.

Preserve Phase 5B fe3b3992d883d33c916b3595769add2c4db8878a / 30712469601; Phase 5C 512745d678a4be6b0d0a62f2400763ff9fd4ec08 / 30715842098; Phase 5D 5836bc330cc03e7a3f658ed9cee5f334649f3091 / 30719294386; Phase 6A baad89621c87ddd4b840bb9c77cb20efcb1b79b6 / 30735445667 RECOVERY_RUNTIME_VALIDATED; Phase 6B dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd / 30737905003 OPERATIONS_RUNTIME_VALIDATED.

## Phase 6C - production security hardening

**Status:** **SECURITY_RUNTIME_VALIDATED** (fixture/CI only — not PRODUCTION_SECURITY_VALIDATED). Workflow `30738838804` / SHA `205d2d23825ff0959310b3a6735b58dff88f1858`.
**Prerequisite:** Phase 6B OPERATIONS_RUNTIME_VALIDATED (`dfcb136` / `30737905003`).
**Port owner:** PORT_OWNER_DECISION_REQUIRED.
**Mongo root rotation:** OPERATOR_OWNED_P0 — never auto-rotated.

Preserve Phase 5B/5C/5D/6A/6B evidence SHAs unchanged.
