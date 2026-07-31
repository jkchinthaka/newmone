# Assumptions and Unanswered Questions

**Document status:** Analysis only (no code or infrastructure changes)  
**Repository inspected:** `jkchinthaka/newmone` / `maintainpro/`  
**Default branch observed:** `main` (HEAD merge of cPanel + enterprise hardening PRs)  
**Analysis date:** 2026-07-31

## 1. Verified facts (from safe source inspection)

| Fact | Evidence |
| --- | --- |
| Browser API default is `/api/backend` (BFF) unless `NEXT_PUBLIC_USE_BFF=false` | `apps/web/lib/api-url.ts` |
| Nginx proxies **all** `/api/` to NestJS API | `infra/nginx/default.conf` `location /api/` |
| No Nginx location for `/api/backend` ahead of `/api/` | Same file — route order would still match `/api/` first even if a longer prefix were added incorrectly after |
| Nest auth cookies set `secure = (NODE_ENV === "production")` and `sameSite = secure ? "none" : "lax"` | `apps/api/src/modules/auth/auth.controller.ts` |
| Next BFF cookies set `secure: isProd` with `sameSite: "lax"` | `apps/web/lib/session-cookies.ts` |
| Web auth-storage no longer persists access/refresh JWTs | `apps/web/lib/auth-storage.ts` |
| Playwright `e2e/auth.spec.ts` still expects/mocks `localStorage` access tokens | `apps/web/e2e/auth.spec.ts` |
| Compose loads `.env.compose-ci` (required) then `.env` (optional) | `docker-compose.yml` |
| Root `.dockerignore` does **not** exclude `.env` / certificates | `maintainpro/.dockerignore` |
| API/web Dockerfiles `COPY . .` from monorepo context | `apps/api/Dockerfile`, `apps/web/Dockerfile` |
| MinIO publishes host ports `9000` and `9001` in compose | `docker-compose.yml` |
| Public nginx publishes host port `80` only (in repo compose) | `docker-compose.yml` |
| Mongo/Redis/API/Web use `expose` not `ports` in repo compose | `docker-compose.yml` |
| `minio/minio:latest` and `minio/mc:latest` floating tags | `docker-compose.yml` |
| npm audit in CI is non-blocking | `.github/workflows/pr-validation.yml` |
| Tenant isolation + RBAC audits previously reported PASS in readiness report | `PRODUCTION_READINESS_REPORT.md` |
| Go-live decision pack remains **NO-GO** | `docs/PRODUCTION_GO_LIVE_DECISION_PACK.md` |
| Negative stock blocked on stock-out path | `inventory.service.ts` (`negative_stock_blocked`) |
| PO dual approval workflow exists (operational + finance) | `inventory.service.ts` / Prisma `PurchaseOrder*` |

## 2. Explicit assumptions (must be validated)

| ID | Assumption | Impact if wrong |
| --- | --- | --- |
| A-01 | Production Windows Server uses repo `docker-compose.yml` + `infra/nginx/default.conf` with little/no undocumented override | Nginx/BFF findings may not match live routing |
| A-02 | Public users reach the app only via HTTP port 80 (no TLS terminator yet) | Cookie Secure=true will break login sessions |
| A-03 | IIS is **not** owning port 80 in the verified stack (Nginx in Docker owns 80) | Dual listeners / conflict risk |
| A-04 | Production `.env` exists on server and overrides CI placeholders for secrets | CI JWT/DB placeholders could win if `.env` missing |
| A-05 | Web container does **not** currently set `API_INTERNAL_URL=http://api:3000/api` | BFF may call public/localhost URLs from inside Docker |
| A-06 | Mongo published to host `127.0.0.1:27018` is a **server-only** override not in repo compose | Port exposure verification must be done on host, not only from repo |
| A-07 | Compromised MongoDB **root** credential is distinct from app user credential | Rotation scope may include both root and app users |
| A-08 | Business accepts temporary public HTTP only until TLS | Security residual risk acceptance required |
| A-09 | NestJS remains source of truth for transactions; Bileeta ERP is integration peer | Data ownership disputes |
| A-10 | Prior “containers healthy + /login 200” remains true; analysis did not re-probe live server | Runtime drift possible |

## 3. Unanswered questions (business / ops / security)

### Scale and availability
1. Exact production user count?
2. Expected concurrent users (peak and sustained)?
3. Business operating hours and peak windows?
4. Acceptable planned downtime (minutes / hours)?
5. Recovery Point Objective (RPO) in minutes/hours?
6. Recovery Time Objective (RTO) in minutes/hours?
7. Data-retention period for operational records?
8. Audit-log retention period and legal hold requirements?

### Access model
9. Is public HTTP temporary or permanent?
10. Target date for HTTPS / TLS certificate?
11. Internet-facing vs private/VPN-only access long-term?
12. Does IIS or Docker Nginx own public port 80 on the Windows Server?
13. Are there additional reverse proxies / CDN / firewall DNAT rules?

### ERP / finance / inventory policy
14. Approval hierarchy (roles, amounts, dual approval rules)?
15. Budget / approval thresholds by cost centre?
16. Inventory valuation method (FIFO / weighted average / standard)?
17. Warehouse structure (single site vs multi-warehouse)?
18. Are sales and finance implemented inside MaintainPro or only via ERP integration?
19. ERP source-of-truth ownership by entity (items, POs, stock, vendors, invoices)?
20. Supplier onboarding and quotation workflow requirements?
21. Invoice-matching requirements (2-way vs 3-way)?
22. Partial / over-receipt tolerances?
23. Required notifications (email/SMS/push) and SLAs?
24. Required management reports and export formats?
25. Required mobile / field workflows (Flutter vs PWA)?

### Delivery governance
26. Which Git commit/branch is actually running on the Windows Server?
27. Who is the release approval owner?
28. Who is the security incident owner for the credential exposure?
29. Where are off-server backups stored?
30. Who owns restore drills?
31. Is repository visibility private/public as intended?
32. Are GitHub branch protections and required checks enforced on `main`?

### Credential incident
33. When was the MongoDB root credential exposed, and to which channels?
34. Has any unauthorized access been observed since exposure?
35. Have application DB users and JWT secrets also been treated as potentially compromised?

## 4. Analysis limitations

- Production `.env` was **not** read (by design).
- Live containers / host firewall were **not** re-probed in this phase.
- No production MongoDB documents were queried.
- GitHub org settings (branch protection, secret scanning) are not fully visible from the local clone alone.
---

## Phase 1 answers / remaining questions (2026-07-31)

**Answered in source:** Production must not load `.env.compose-ci`; dedicated `docker-compose.production.yml` exists; MinIO not published on 0.0.0.0 in production compose.

**Still unanswered:** Exact public port 80 owner (IIS vs Docker Nginx) on the Windows Server; whether production host has already redeployed these compose changes; Mongo root rotation evidence.
---

## Phase 2 fact updates (2026-07-21)

- Nginx now has `location ^~ /api/backend/` before `/api/` (static validated).
- Next BFF cookies use `resolveCookieSecurityConfig` with dual HTTP opt-in.
- Production compose requires `API_INTERNAL_URL`; structure fixture uses `http://api:3000/api`.
- Playwright auth e2e no longer expects localStorage access tokens.
- Live HTTP login at `http://<PUBLIC_HOST>/login` remains unanswered until operator smoke evidence.
- Phase 1 Mongo root rotation remains OPERATOR_ACTION_REQUIRED.

---

## Phase 2 closeout assumption updates

- Nest no longer issues browser session cookies (verified Option A).
- Mobile remains JSON-token based with secure storage.
- OAuth Google browser cookie handoff remains unanswered / P1 incomplete.
