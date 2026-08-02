# Architecture Findings

**Phase:** Discovery / analysis only  
**Stack under review:** Browser → Nginx:80 → Next.js web → BFF `/api/backend` → NestJS API → MongoDB / Redis / MinIO

## 1. Intended secure request path

```text
Browser (same origin)
  GET/POST /api/backend/*   → Nginx → Next.js (BFF sets HttpOnly cookies)
  GET/POST /api/*           → Nginx → NestJS (non-BFF API / health / webhooks)
  /socket.io/*              → Nginx → NestJS
  /*                        → Nginx → Next.js
```

## 2. Current repository configuration (verified)

### 2.1 Nginx (`infra/nginx/default.conf`)

| Location | Upstream | Finding |
| --- | --- | --- |
| `/socket.io/` | `api:3000` | Matches intent |
| `^~ /api/backend/` | `web:3001` (no URI strip) | **Phase 2:** placed before `/api/` |
| `/api/` | `api:3000/api/` | Nest generic API / health |
| `/` | `web:3001` | Pages |

**Static validation:** `npm run validate:nginx-routing`. Live 401-vs-404 proof remains operator-owned (`HTTP_BFF_SMOKE_TEST.md`).

### 2.2 Frontend API base (`apps/web/lib/api-url.ts`)

- Default `apiBaseUrl = "/api/backend"`.
- Opt-out: `NEXT_PUBLIC_USE_BFF=false`.

### 2.3 BFF upstream (`apps/web/lib/bff-proxy.ts`)

Resolution order:

1. `API_INTERNAL_URL`
2. `NEXT_PUBLIC_API_URL`
3. `NEXT_PUBLIC_API_BASE_URL`
4. `${apiOrigin}/api`

**Phase 2:** Production compose requires `API_INTERNAL_URL=http://api:3000/api` and `NEXT_PUBLIC_USE_BFF=true`.

**Login success status (Phase 4B attempt 5):** NestJS `POST /auth/login` returns exactly **HTTP 200 OK** via `@HttpCode(AUTH_LOGIN_SUCCESS_HTTP_STATUS)` — not Nest's POST default 201. BFF preserves the upstream status; browser cookies remain BFF-owned.

### 2.4 Cookie policy

| Layer | Secure | SameSite | Notes |
| --- | --- | --- | --- |
| Next BFF `session-cookies.ts` | `resolveCookieSecurityConfig` | `lax` | Production default Secure; HTTP needs dual opt-in |
| Nest `AuthController` | still `NODE_ENV===production` | may still use `none` | Phase 2 P1 leftover (TODO-P2-004) |

**HTTP compatibility (explicit, fail-closed):**

```text
ALLOW_INSECURE_HTTP=true
COOKIE_SECURE=false
```

HTTP does not encrypt credentials or sessions. HTTPS remains recommended.

### 2.5 Auth storage

- Runtime: access/refresh not stored in localStorage (`auth-storage.ts`).
- Tests: Playwright asserts null localStorage tokens + HttpOnly cookies (`e2e/auth.spec.ts`).

## 3. Docker / secrets / env precedence

### 3.1 Build context leakage

- Root `.dockerignore` excludes node_modules/git/logs but **not** `.env`, `.env.*`, `*.pem`, `*.key`.
- API app `.dockerignore` excludes `.env` but compose build context is monorepo root with root ignore file.
- `COPY . .` in API and web Dockerfiles can bake secrets into intermediate layers.

### 3.2 Runtime env precedence

```yaml
env_file:
  - path: .env.compose-ci   # required: true  (committed CI placeholders)
  - path: .env              # required: false
```

Compose merges later files over earlier for duplicate keys **when both exist**, but if production `.env` is missing, CI placeholders (including JWT secrets and DB URLs) become live configuration. `.env.compose-ci` also sets `APP_COMMIT_SHA=ci-placeholder`.

**Safe strategy (recommended):**

1. Keep `.env.compose-ci` for CI only.
2. Production compose profile / override file that **does not** load CI placeholders.
3. Require operator-provided `.env.production` (not committed).
4. Fail boot if `JWT_*` / DB URL still match known CI sentinel strings.

### 3.3 Port exposure (repo compose)

| Service | Published ports | Expected for public HTTP MVP |
| --- | --- | --- |
| nginx | `80:80` | Yes |
| minio | `9000:9000`, `9001:9001` | **No — should be localhost-only or internal** |
| api/web/mongo/redis | expose only | Prefer no public publish |

**Assumption:** Server maps Mongo to `127.0.0.1:27018` outside this file — must be verified on host.

### 3.4 Image pinning

- `mongo:7`, `redis:7-alpine`, `nginx:1.27-alpine` — major/minor pinned (acceptable interim).
- `minio/minio:latest`, `minio/mc:latest` — **not acceptable** for production.

### 3.5 Resource / logging

No `mem_limit` / `cpus` / `logging` options in compose — disk fill and OOM risk on Windows Server.

## 4. Source and deployment alignment

| Item | Finding |
| --- | --- |
| Default branch | `main` |
| Feature branches present | `fix/enterprise-production-hardening`, `fix/cpanel-windows-package-build`, others |
| Server-only branch | Not identifiable from clone — **unanswered** |
| Health build metadata | Code supports `APP_COMMIT_SHA`; CI file uses placeholders |
| Dual deploy paths | Docker Compose (Windows Server) + Cloudflare/cPanel/Render historically |

## 5. AuthN / AuthZ architecture (code)

- JWT + tenant middleware + Roles/Permissions guards — previously audited PASS in readiness report.
- Refresh token family reuse detection exists (schema/docs).
- CSRF: BFF mutations + Nest cookie refresh path; not universal on all Nest mutations if BFF bypassed.

## 6. Observability gaps

- Request IDs exist in API filter path (prior work).
- Compose lacks centralized metrics/alerting.
- No evidenced host disk/Mongo growth alerts in repo compose.

## 7. Architecture decisions required before coding

1. Confirm Nginx is sole public HTTP entry (not IIS).
2. Approve temporary insecure-cookie HTTP mode with expiry date.
3. Approve production env-file strategy (no CI file in prod).
4. Confirm BFF is mandatory for browser traffic (recommended: yes).
5. Confirm MinIO console must not be internet-reachable.
---

## Phase 1 architecture update (2026-07-31)

### Env loading (after Phase 1)

| Mode | Command pattern | Service `env_file` |
| --- | --- | --- |
| Local / base | `docker compose --env-file .env.compose-ci -f docker-compose.yml ...` | optional `.env` only |
| CI optional container fixture | add `-f docker-compose.ci.yml` | `.env.compose-ci` |
| Production | `docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml ...` | required `.env` (**never** compose-ci) |

### Ports (after Phase 1)

| Service | Base | Production overlay |
| --- | --- | --- |
| nginx | `80:80` | `80:80` (ownership unanswered) |
| mongo | unpublished | `127.0.0.1:27018:27017` |
| minio | expose only | `127.0.0.1:9000/9001` |
| redis/api/web | expose only | expose only |

Local admin loopback binds: `docker-compose.local-admin.yml`.
---

## Phase 2 closeout (Nest cookie ownership) — SOURCE_VALIDATED

**Selected option:** Option A — NestJS does **not** issue browser session cookies.

**Evidence:**
- Mobile clients use FlutterSecureStorage + JSON token bodies (apps/mobile/lib/core/storage/token_storage.dart).
- Next.js BFF strips tokens and sets maintainpro_* cookies (bff-proxy.ts).
- Nest previously used `SameSite=None` when Secure (auth.controller) and also set cookies from tenancy switch — conflicting with BFF Lax architecture.
- Nest `Set-Cookie` was not forwarded by the BFF anyway; tenancy switch left stale BFF access cookies.

**Changes:**
- Removed Nest `res.cookie` session issuance from auth login/register/refresh and tenancy switch.
- Logout still clears residual Nest-era cookies with `SameSite=Lax` only (never None).
- BFF updates access cookie on `tenants/:id/switch` and strips `accessToken` from browser-visible JSON.
- Policy module: `auth-cookie.policy.ts` (`NEST_ISSUES_BROWSER_SESSION_COOKIES=false`).

**OAuth:** Google callback returns profile JSON only — no BFF cookie handoff. Status: **P1 TODO** (incomplete browser OAuth session establishment).

**Operational status:** SOURCE_VALIDATED. Live HTTP login remains **OPERATOR_RUNTIME_VALIDATION_REQUIRED**. Phase 1 Mongo root rotation remains **OPERATOR_ACTION_REQUIRED**. Image secret scan may be **BLOCKED** without Docker engine.

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

### 2.x Release identity (Phase 3)

- Canonical env: `APP_VERSION`, `APP_COMMIT_SHA`, `APP_BUILD_TIMESTAMP`, `APP_ENVIRONMENT`, `APP_SERVICE_NAME`.
- API exposes safe metadata via `/api/health`, `/api/build-info`.
- Web exposes safe metadata via `/api/build-info`.
- Production Compose requires SHA + timestamp and tags images `maintainpro-api|web:<SHA>`.
- Direct server source edits forbidden; use `audit-server-release.ps1`.

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

## Phase 5A inventory architecture

- Read routes share `INVENTORY_READ_ROLES` including `INVENTORY_KEEPER`.
- Stock-out requires tenant-scoped `workOrderId`, atomic conditional decrement, optional tenant-scoped idempotency (`InventoryStockIssueIdempotency`).
- Movement records carry tenant/WO/actor for reconciliation.
- E2E creates WO via manager context; no hardcoded ObjectIds.

## Phase 5C architecture

PurchaseReceipt models added. PO creator + maker-checker enforced. ERP payloads sanitized. inventory.erp_apply separated.

## Phase 5D architecture — management information layer

### Decisions

1. **Single KPI catalog** (`KPI_DEFINITION_CATALOG.md`) owns definitions; API keys align to catalog keys.
2. **Server-side dashboard snapshot** extends `GET /reports/dashboard` (validated DTO) rather than competing duplicate APIs; browser stops aggregating full lists for org KPIs.
3. **Coverage status** on every section: COMPLETE | DEGRADED | UNAVAILABLE | INSUFFICIENT_DATA — never fake zeros for missing data; MTBF uses null + INSUFFICIENT_DATA.
4. **Time/currency**: storage UTC; reporting TZ Asia/Colombo; currency LKR; locale en-LK; no silent FX.
5. **Report ACL**: granular `reports.<module>.view` + `reports.export`; system logs also need `audit.view`.
6. **FINANCE** is canonical; **FINANCE_APPROVER** is a display/JWT alias with identical ACL.
7. **Financial bases** are explicit; default Total Expenses = consumed WO `actualCost` + utilities + farm; committed PO is a separate card; exclude WO parts when `actualCost` present.
8. **ERP monitoring** is safe-field-only; MOCK in E2E; no URLs/payloads/keys.
9. **Exports** neutralize formula prefixes, bound rows, require audit + truncation metadata.
10. **Security events** for login failure are queryable without storing credentials.

### Related contracts

- `DASHBOARD_ACCESS_MATRIX.md`
- `REPORT_ACCESS_MATRIX.md`
- `REPORT_TIME_AND_CURRENCY_CONTRACT.md`
- `FINANCIAL_REPORT_RECONCILIATION_CONTRACT.md`
- `ERP_MONITORING_DASHBOARD_CONTRACT.md`
- `AUDIT_EVENT_COVERAGE_MATRIX.md`
- `REPORT_EXPORT_SAFETY_CONTRACT.md`

### Evidence continuity

- Phase 5B: `fe3b3992d883d33c916b3595769add2c4db8878a` / workflow `30712469601`
- Phase 5C: `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / workflow `30715842098`
- Phase 5D: `5836bc330cc03e7a3f658ed9cee5f334649f3091` / workflow `30719294386`

## Phase 6A — backup versus replication

- **Replication** (`ReplicationOutbox` → backup DB) is a near-current secondary copy, often **SAME_FAILURE_DOMAIN** as primary in Compose (one `mongo` service/volume).
- **Backup** requires off-host encrypted archive, SHA-256 manifest, and tested restore to a **fresh** database namespace.
- E2E rehearsal (`maintainpro_e2e_*` → `maintainpro_restore_*`) validates mechanics only — not production DR or approved RPO/RTO.
- Readiness must keep `replicationStatus` and `backupRestoreTestStatus` separate.
- **RECOVERY_RUNTIME_VALIDATED:** SHA `baad89621c87ddd4b840bb9c77cb20efcb1b79b6` / workflow `30735445667` (not `PRODUCTION_DR_VALIDATED`).

Preserve Phase 5B/5C/5D evidence SHAs unchanged.

## Phase 6B - observability and operations findings

- MaintainPro historically exposes public /api/health and protected detailed readiness; Phase 6B splits **live** (process) vs **ready** (traffic/CI) to stop container restart loops when dependencies flap.
- Request IDs exist in API middleware and BFF but length/allowlist must converge to max 64 and A-Za-z0-9._:-; Nginx must generate when absent; IDs must never become metric labels.
- Operational metrics must stay low-cardinality; forensic detail stays in logs + AuditLog/SecurityEvent.
- Alert thresholds are catalogued as PROVISIONAL only - not approved SLOs.
- Queue recovery remains Policy B (Mongo authoritative) with explicit startup reconciliation, idempotent enqueues, and stable job IDs.
- Shutdown requires SIGTERM drain and ordered disconnect (HTTP -> queues -> Redis -> Mongo) within bounded grace.
- Startup is staged 1-11 so live comes before ready; queue reconcile gates ready when enabled.
- Host reboot recovery is operator-owned on Linux/Docker and Windows Server; container restart evidence must not be labeled HOST_REBOOT_VALIDATED.
- Docker json-file logging is local-only; rotation and retention need operator/management approval (G5.3).
- Phase 6B status: **OPERATIONS_RUNTIME_VALIDATED** — SHA `dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd` / workflow `30737905003` — not PRODUCTION_OPERATIONS_VALIDATED.

Preserve Phase 5B/5C/5D RUNTIME_VALIDATED and Phase 6A RECOVERY_RUNTIME_VALIDATED evidence SHAs unchanged:
5B fe3b3992d883d33c916b3595769add2c4db8878a / 30712469601;
5C 512745d678a4be6b0d0a62f2400763ff9fd4ec08 / 30715842098;
5D 5836bc330cc03e7a3f658ed9cee5f334649f3091 / 30719294386;
6A baad89621c87ddd4b840bb9c77cb20efcb1b79b6 / 30735445667;
6B dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd / 30737905003.

## Phase 6C - production security hardening

**Status:** SOURCE_IMPLEMENTED — runtime pending; not PRODUCTION_SECURITY_VALIDATED.
**Prerequisite:** Phase 6B OPERATIONS_RUNTIME_VALIDATED (`dfcb136` / `30737905003`).
**Port owner:** PORT_OWNER_DECISION_REQUIRED.
**Mongo root rotation:** OPERATOR_OWNED_P0 — never auto-rotated.

Preserve Phase 5B/5C/5D/6A/6B evidence SHAs unchanged.
