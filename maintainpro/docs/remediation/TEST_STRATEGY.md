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
tear down volumes for e2e project only
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

