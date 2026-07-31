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