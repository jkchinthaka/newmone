# Risk Register

**Status:** Analysis phase — no remediation executed  
**Legend:** Likelihood L1–L5 · Impact I1–I5 · Score = L×I · Status OPEN unless noted

| ID | Risk | Category | L | I | Score | Priority | Evidence | Mitigation direction | Owner perspective |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | Compromised MongoDB root credential enables full DB takeover | Security / Data | 4 | 5 | 20 | P0 | Operator-reported exposure | Rotate root (and evaluate app user + JWT secrets); revoke old creds; audit access | AppSec + Ops |
| R-02 | Production cookies `Secure=true` when `NODE_ENV=production` — browsers drop cookies on public HTTP | Auth / Availability | 5 | 5 | 25 | P0 | `auth.controller.ts`, `session-cookies.ts` | Explicit opt-in `COOKIE_SECURE=false` + `ALLOW_INSECURE_HTTP=true`; default secure; temporary HTTP risk acceptance | Backend + Security |
| R-03 | Nginx sends all `/api/*` to Nest — browser BFF path `/api/backend` never reaches Next.js | Auth / Session | 5 | 5 | 25 | P0 | `infra/nginx/default.conf`, `api-url.ts` | Add `/api/backend/` location to web **before** `/api/`; verify path rewriting | DevOps + Architect |
| R-04 | BFF upstream may resolve to localhost/public URL inside Docker instead of `http://api:3000/api` | Reliability | 4 | 4 | 16 | P0 | BFF `API_INTERNAL_URL` optional; compose web env lacks it | Set `API_INTERNAL_URL` in web service; fail closed if missing in Docker | DevOps |
| R-05 | Root `.dockerignore` omits `.env` while Dockerfiles `COPY . .` — secrets can enter image layers | Security | 4 | 5 | 20 | P0 | `.dockerignore`, Dockerfiles | Exclude `.env*`, keys, certs; rebuild without cache; rotate any baked secrets | DevOps + AppSec |
| R-06 | Compose requires `.env.compose-ci` before `.env` — CI placeholders may partially drive production | Config / Security | 3 | 5 | 15 | P0 | `docker-compose.yml`, `.env.compose-ci` | Production compose profile without CI file; require real env file | DevOps |
| R-07 | MinIO ports 9000/9001 published on host in compose | Network exposure | 4 | 4 | 16 | P0 | `docker-compose.yml` | Bind to 127.0.0.1 or remove publish; firewall deny | DevOps |
| R-08 | Nest cookie `SameSite=None` in production conflicts with same-origin BFF design and HTTP | Auth | 4 | 4 | 16 | P1 | `auth.controller.ts` | Align Nest cookies with BFF (Lax) when same-origin; Secure policy via env | Backend |
| R-09 | Stale Playwright tests assert localStorage access tokens — false confidence / regressions | QA | 5 | 3 | 15 | P1 | `e2e/auth.spec.ts` | Rewrite cookie/BFF e2e; block merge on stale expectations | QA |
| R-10 | No real-stack E2E through Nginx→BFF→API→Mongo | Quality | 4 | 4 | 16 | P1 | Mocked routes in Playwright | Disposable stack e2e harness | QA + DevOps |
| R-11 | Floating `minio:latest` / `mc:latest` image tags | Supply chain | 3 | 4 | 12 | P1 | compose | Pin digest/version | DevOps |
| R-12 | npm audit high/critical non-blocking in CI | Supply chain | 4 | 3 | 12 | P2 | `pr-validation.yml` | Controlled upgrade groups; fail on critical for runtime deps | AppSec |
| R-11b | Missing container memory/CPU limits and log rotation in compose | Reliability | 4 | 3 | 12 | P1 | compose has no `deploy.resources` / logging options | Add limits + json-file rotation | SRE |
| R-13 | Docker Desktop on Windows Server — reboot/start fragility | Availability | 3 | 4 | 12 | P1 | Architecture context | Auto-start policy; document reboot test | SRE |
| R-14 | Backup/restore RPO/RTO undefined; off-server copies unknown | DR | 4 | 5 | 20 | P1 | Unanswered questions | Define RPO/RTO; scheduled mongodump + MinIO sync; restore drill | Ops |
| R-15 | Production commit SHA may be unknown / placeholder | Traceability | 3 | 3 | 9 | P1 | `.env.compose-ci` placeholders; prior staging `unknown` | Inject `APP_COMMIT_SHA` at deploy | DevOps |
| R-16 | ERP sync partial failure / ownership ambiguity | Business | 3 | 4 | 12 | P1 | ERP modules + unanswered SoT | Explicit SoT matrix + reconciliation jobs | BA + Backend |
| R-17 | Segregation-of-duties gaps (same user request+approve+issue) | Compliance | 3 | 4 | 12 | P1 | Role catalog large; SoD rules not fully evidenced | SoD matrix + enforcement tests | BA + AppSec |
| R-18 | Finance three-way match / period close incomplete vs ERP expectations | Finance | 3 | 4 | 12 | P2 | Schema has PO/approvals/ERP sync; no full AP module | Scope MVP vs integrate-only | BA |
| R-19 | Public HTTP session hijacking / MITM | Security | 5 | 4 | 20 | P0 (accepted residual if HTTP required) | Business HTTP requirement | Short-lived tokens, network controls, accelerate TLS | AppSec |
| R-20 | Server config drifts from Git | Governance | 3 | 4 | 12 | P1 | Unanswered production branch | Source-of-truth deploy from tagged SHA | Tech Lead |

## Residual risk acceptance (HTTP)

Public HTTP **cannot** be made equivalent to HTTPS. Even with `COOKIE_SECURE=false` opt-in:

- Credentials and session cookies travel in cleartext.
- Active network attackers can intercept or inject.
- CSRF/XSS defenses remain necessary but do not stop network MITM.

**Required:** written business acceptance, time-boxed HTTP exception, TLS migration date.
---

## Phase 1 update (2026-07-31)

| Risk | Update |
| --- | --- |
| R-05 Docker secret bake-in | Mitigated in repo via `.dockerignore` hardening + image path checks — **rebuild prod images required on server** |
| R-06 CI env in production | Mitigated in repo: base compose no longer loads `.env.compose-ci`; production overlay requires `.env` — **operator must deploy with production compose files** |
| R-07 MinIO public ports | Mitigated in repo compose (expose-only + 127.0.0.1 in production) — **redeploy compose on server required** |
| R-01 Compromised Mongo root | **OPEN / OPERATOR_ACTION_REQUIRED** — runbook only |
---

## Phase 2 update (2026-07-21)

| Risk | Update |
| --- | --- |
| R-02 Secure cookies break HTTP | Mitigated in source via dual opt-in; default Secure; live smoke operator-owned |
| R-03 Nginx BFF bypass | Mitigated in source (`/api/backend/` -> web); redeploy required |
| R-04 Missing API_INTERNAL_URL | Mitigated in production compose |
| R-08 Nest SameSite=None | OPEN (TODO-P2-004) |
| R-19 HTTP MITM | Accepted residual if HTTP mode used; HTTPS recommended |
| R-01 Compromised Mongo root | Still OPEN |

---

## Phase 2 closeout risk update

| Risk | Update |
| --- | --- |
| R-08 Nest SameSite=None | **Mitigated in source (Option A)** — Nest no longer issues browser session cookies; BFF owns Lax cookies |
| R-02 / R-19 HTTP cookies | Unchanged: dual opt-in required; HTTPS recommended; live smoke operator-owned |
| R-01 Mongo root | Still OPERATOR_ACTION_REQUIRED |

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

| Playwright missing disposable env | Mitigated by centralized E2E env loader |
| E2E env template missing final newline / fragile append | Mitigated by materialize + NL validators (attempt 3) |
| Nginx 502 on successful BFF login (large Set-Cookie) | Mitigated by enlarged `/api/backend/` proxy buffers + auth-path A/B/C gate (attempt 4) |
| API login 401 vs browser 502 correlation | Open until request-ID evidence; do not assume same request |
| Login success 201 (Nest POST default) vs Playwright 200 | Mitigated by explicit `@HttpCode(200)` + contract tests (attempt 5) |
| Authenticated E2E used isolated Playwright request (no browser cookies) | Mitigated by browser-session helpers + request-context validator (attempt 6) |
| Logout Nest POST default 201 | Mitigated by explicit logout HTTP 200 contract (attempt 6) |
| E2E work-order create omitted required `createdById` | Mitigated by `/auth/me` actor resolution + payload validator (attempt 7) |
| Client-supplied `createdById` vs authenticated actor attribution | P1 BUSINESS_CONTRACT_REVIEW — not redesigned in Phase 4B attempt 7 |
| Inventory list 403 for inventory keeper in disposable E2E | P1 PRODUCT_GAP / optional ERP control — does not block Phase 4B partial runtime validation |
| Phase 4B attempt 7 runtime | PARTIAL_RUNTIME_VALIDATION — run `30696336211`, SHA `0ecd3fa` |

## INV-RBAC-ROUTE-GAP (Phase 5A mitigated)

| Field | Value |
| --- | --- |
| Risk | Inventory Keeper 403 on parts list despite seeded permissions |
| Classification | RBAC_ROUTE_CONTRACT_DEFECT |
| Mitigation | Option A: add keeper to INVENTORY_READ_ROLES; keep inventory.manage |
| Residual | Option B inventory.view deferred; ERP apply role narrowing P1 |

| CI E2E Compose `down --volumes` | CI_CLEANUP_SAFETY_DEFECT | Corrected to `down --remove-orphans`; validator prevents regression | Open until corrected SHA rerun |

## Phase 5C risks

- P1: Receipt reversal not implemented (immutable posted receipts).
- P1: Production poNumber uniqueness migration needs operator audit.
- P1: FINANCE/PROCUREMENT_OFFICER production user migration operator-owned.
- P0 closed in source: client totals, PATCH RECEIVED, live ERP in E2E, keeper apply.

## Phase 5D residual risks

| Risk | Severity | Mitigation / residual |
| --- | --- | --- |
| Client-side KPI aggregation undercounts (WO pageSize 25) | P0 until fixed | Server-side dashboard snapshot; E2E-KPI / E2E-DASH |
| Financial double-count (WO actualCost + parts + PO) | P0 until fixed | FINANCIAL_REPORT_RECONCILIATION_CONTRACT; labeled bases |
| Hardcoded USD on LKR reports | P1 | REPORT_TIME_AND_CURRENCY_CONTRACT; currencyCode metadata |
| Broad role arrays vs granular `reports.*` | P1 | REPORT_ACCESS_MATRIX; seed + operator migration |
| FINANCE vs FINANCE_APPROVER divergence | P1 | FINANCE canonical; FINANCE_APPROVER display alias only |
| Login failures not queryable | P1 | AUDIT_EVENT_COVERAGE_MATRIX; safe security events |
| CSV formula injection | P0 until fixed | REPORT_EXPORT_SAFETY_CONTRACT; E2E-REPORT-020 |
| Silent truncated exports | P1 | Truncation metadata mandatory |
| ERP secret leakage on dashboard | P0 | ERP_MONITORING_DASHBOARD_CONTRACT allowlist |
| MTBF shown as zero when unsupported | P1 | value null + INSUFFICIENT_DATA; E2E-KPI-012 |
| Unbounded report queries / memory | P1 | PERF controls; bounded aggregates |
| catch-to-null hides degraded sources | P1 | coverageStatus DEGRADED/UNAVAILABLE; E2E-DASH-010 |
| Production `reports.*` permission migration | P1 | Operator-owned; not executed by CI |
| Phase 5D runtime not yet validated | — | No invented SHA; gate pending |

Preserve Phase 5B/5C closed evidence; Phase 5C residual P1s (receipt reversal, poNumber migration, FINANCE/PROCUREMENT production users) remain open and out of 5D scope.

Authoritative evidence to preserve: Phase 5B fe3b3992d883d33c916b3595769add2c4db8878a / workflow 30712469601; Phase 5C 512745d678a4be6b0d0a62f2400763ff9fd4ec08 / workflow 30715842098.
