# MaintainPro Remediation Master TODO

**Document type:** Controlled, prioritized, testable remediation plan  
**Phase of work:** Analysis only — **no implementation in this document’s creation**  
**Related docs:** `ASSUMPTIONS_AND_QUESTIONS.md`, `RISK_REGISTER.md`, `ARCHITECTURE_FINDINGS.md`, `ERP_BUSINESS_ANALYSIS.md`, `TEST_STRATEGY.md`, `GO_LIVE_GATES.md`

## How to use

1. Execute phases in order unless a P0 emergency requires jump (still record evidence).
2. Do not mark `DONE` without **Required evidence**.
3. Operator-only tasks (credentials, firewall, Windows services) are labeled **OPERATOR** — engineers must not pull secrets into Git.
4. Default production posture remains secure; HTTP weakenings require explicit dual flags.

---

## Phase 0 — Discovery and verified baseline

**Objective:** Establish a shared, evidence-based baseline without changing prod.  
**Business value:** Prevents fixing the wrong environment; separates facts from assumptions.  
**Entry criteria:** Read-only access to repo; operator available for non-secret runtime facts.  
**Exit criteria:** Baseline checklist signed; unanswered questions assigned owners.  
**Required tests:** None (read-only probes only if approved).  
**Required evidence:** Completed checklist with dates/SHAs.  
**Rollback:** N/A (no changes).  
**Go/No-Go:** Proceed to Phase 1 only if R-01 owner assigned and exposure acknowledged.

### Tasks

#### TODO-P0-001 — Capture runtime baseline without secrets
- **Title:** Document live stack health and published ports (redacted)
- **Perspective/owner:** DevOps / SRE
- **Business reason:** Confirm what users actually hit before changing auth/routing
- **Priority:** P0
- **Current evidence:** Prior operator report: containers healthy; `/api/health` 200; `/login` 200; mongo localhost:27018
- **Assumption status:** A-01, A-10 unverified in this analysis pass
- **Affected modules:** N/A (ops)
- **Affected files:** N/A
- **API/DB/UI impact:** None
- **Security impact:** Must not print credentials
- **Performance impact:** None
- **Deployment impact:** None
- **Risks:** Observing wrong host
- **Dependencies:** Operator access
- **Implementation steps:** 1) Record compose project name / image IDs / container health 2) Record listening ports (no secrets) 3) Record whether IIS shares :80 4) File under ops notes (not Git if sensitive)
- **Acceptance criteria:** Written baseline lists public ports, private ports, and entry URL `http://<PUBLIC_IP>/login` confirmed or contradicted
- **Test cases:** `Test-NetConnection` style checks from external vs localhost for 80/27018/9000
- **Rollback plan:** N/A
- **Required evidence:** Redacted port matrix
- **Status:** NOT_STARTED

#### TODO-P0-002 — Map running Git SHA to repository
- **Title:** Identify production commit and branch
- **Perspective/owner:** Tech Lead / DevOps
- **Business reason:** Traceability and rollback
- **Priority:** P0
- **Current evidence:** Repo `main` at merge of PR #10; server SHA unknown
- **Assumption status:** A-06/A-01
- **Affected modules:** build-info
- **Affected files:** health/build-info controllers (read-only now)
- **API impact:** Read `GET /api/build-info` / health metadata
- **Database impact:** None
- **UI impact:** None
- **Security impact:** Low
- **Performance impact:** None
- **Deployment impact:** Informs release process
- **Risks:** Placeholder SHA (`ci-placeholder`)
- **Dependencies:** TODO-P0-001
- **Implementation steps:** Compare container labels/env (redacted) to `git rev-parse`
- **Acceptance criteria:** Production SHA recorded or explicitly marked UNKNOWN with ticket
- **Test cases:** Health metadata ≠ `unknown`/`ci-placeholder` OR UNKNOWN ticket filed
- **Rollback plan:** N/A
- **Required evidence:** SHA string or UNKNOWN ticket ID
- **Status:** NOT_STARTED

#### TODO-P0-003 — OPERATOR: Acknowledge MongoDB root credential compromise
- **Title:** Open security incident and assign rotation owner
- **Perspective/owner:** Application Security + Ops (**OPERATOR**)
- **Business reason:** Compromised root can destroy or exfiltrate all tenant data
- **Priority:** P0
- **Current evidence:** Stakeholder-reported exposure (no secret values inspected)
- **Assumption status:** A-07
- **Affected modules:** MongoDB
- **Affected files:** None in Git
- **API/DB/UI impact:** Credential rotation only
- **Security impact:** Critical
- **Performance impact:** Brief reconnects during rotation
- **Deployment impact:** Env update on server (not committed)
- **Risks:** Incomplete rotation leaves backdoor
- **Dependencies:** None
- **Implementation steps:** 1) Incident ticket 2) Inventory who had access 3) Plan rotation window 4) **Do not** paste secrets into chat/Git
- **Acceptance criteria:** Incident ID exists; owner named; rotation window scheduled
- **Test cases:** N/A (process)
- **Rollback plan:** Keep previous secret in sealed vault until new auth verified — never in Git
- **Required evidence:** Incident ID (no secrets)
- **Status:** NOT_STARTED

**Phase 0 exit tests/evidence:** Baseline port matrix; SHA status; incident ID.

---

## Phase 1 — Secret and configuration safety

**Objective:** Remove secret leakage paths and CI-placeholder risk in production.  
**Business value:** Prevent credential theft via images and misconfiguration.  
**Entry criteria:** Phase 0 exit; incident opened.  
**Exit criteria:** Secrets cannot enter build context; prod env strategy documented and applied by operator.  
**Required tests:** docker build context dry-run; boot refusal on CI sentinels (after impl).  
**Rollback:** Rebuild previous images from clean context.  
**Go/No-Go:** No production rebuild until `.dockerignore` fixed and root rotated (Phase 1 + P0-003 completion).

#### TODO-P1-001 — Exclude secrets from Docker build context
- **Title:** Harden root `.dockerignore` for env/keys/certs
- **Perspective/owner:** DevOps + AppSec
- **Business reason:** Stop baking production secrets into image layers
- **Priority:** P0
- **Current evidence:** Root `.dockerignore` lacks `.env` / `.env.*` / `*.pem` / `*.key`; Dockerfiles `COPY . .`
- **Assumption status:** Confirmed in repo
- **Affected modules:** api/web images
- **Affected files:** `maintainpro/.dockerignore`, possibly app dockerignores
- **API/DB/UI impact:** None functional
- **Security impact:** High positive
- **Performance impact:** Slightly smaller context
- **Deployment impact:** Requires image rebuild
- **Risks:** Over-ignore breaking required build files
- **Dependencies:** None
- **Implementation steps:** Add ignore patterns; verify `docker build` still succeeds; ensure examples remain available if needed via explicit COPY
- **Acceptance criteria:** `docker build` context listing shows no `.env`; rebuild uses `--no-cache` once after fix
- **Test cases:** Script asserts forbidden paths absent from context
- **Rollback plan:** Revert dockerignore; rebuild
- **Required evidence:** Build log + context audit output
- **Status:** NOT_STARTED

#### TODO-P1-002 — OPERATOR: Rotate MongoDB root (and evaluate app user + JWT)
- **Title:** Rotate compromised MongoDB root credential
- **Perspective/owner:** Ops / DBA (**OPERATOR**)
- **Business reason:** Invalidate exposed credential
- **Priority:** P0
- **Current evidence:** Exposure reported
- **Assumption status:** A-07
- **Affected modules:** mongo service
- **Affected files:** Server env only (not Git)
- **API impact:** Brief auth failures if mistimed
- **Database impact:** User credential update on admin DB
- **UI impact:** None if API stays up
- **Security impact:** Critical
- **Performance impact:** Momentary
- **Deployment impact:** Compose/env update + container recreate
- **Risks:** Lockout if app URL not updated atomically
- **Dependencies:** TODO-P0-003
- **Implementation steps:** 1) Create new root password in vault 2) Update Mongo users 3) Update server env 4) Rolling restart 5) Verify app auth 6) Destroy old secret copies outside vault
- **Acceptance criteria:** Old root password fails auth; app health 200; **no secret in Git/docs/logs**
- **Test cases:** Failed login with old secret (operator-only); app CRUD smoke on disposable record
- **Rollback plan:** Vault prior secret sealed; emergency restore only via break-glass
- **Required evidence:** Operator checklist signed (redacted)
- **Status:** NOT_STARTED

#### TODO-P1-003 — Production env-file strategy (stop CI placeholders in prod)
- **Title:** Separate compose CI env from production env loading
- **Perspective/owner:** DevOps
- **Business reason:** Avoid JWT/DB CI sentinels in production
- **Priority:** P0
- **Current evidence:** `docker-compose.yml` requires `.env.compose-ci` then optional `.env`
- **Assumption status:** A-04
- **Affected modules:** all services
- **Affected files:** `docker-compose.yml`, new override e.g. `docker-compose.prod.yml`, docs
- **API/DB/UI impact:** Config only
- **Security impact:** High
- **Performance impact:** None
- **Deployment impact:** Operator runbook change
- **Risks:** Breaking CI docker-build-check
- **Dependencies:** Keep CI path working with compose-ci
- **Implementation steps:** 1) Prod override without compose-ci 2) Boot-time guard rejecting known CI sentinel secrets 3) Document operator file locations outside repo
- **Acceptance criteria:** Production start fails if CI sentinel JWT detected; CI workflow still green
- **Test cases:** Unit/config test for sentinel detection; CI compose config validation
- **Rollback plan:** Prior compose file
- **Required evidence:** CI run + failed boot demo with sentinels
- **Status:** NOT_STARTED

#### TODO-P1-004 — Restrict MinIO host port publishing
- **Title:** Bind or unpublish MinIO 9000/9001 from public interfaces
- **Perspective/owner:** DevOps / AppSec
- **Business reason:** Object storage and console must not be internet-open
- **Priority:** P0
- **Current evidence:** compose publishes `9000:9000` and `9001:9001`
- **Assumption status:** Confirmed in repo
- **Affected modules:** minio
- **Affected files:** `docker-compose.yml` / prod override
- **API impact:** API still reaches minio via Docker network
- **Database impact:** None
- **UI impact:** None
- **Security impact:** High
- **Performance impact:** None
- **Deployment impact:** Recreate minio networking
- **Risks:** Break local admin workflows that used public ports
- **Dependencies:** Operator firewall rules
- **Implementation steps:** Change to `127.0.0.1:9000:9000` or remove ports; verify API uploads via internal DNS
- **Acceptance criteria:** External TCP to 9000/9001 fails; internal API upload succeeds in non-prod
- **Test cases:** Port scan from external vs docker exec curl to `minio:9000`
- **Rollback plan:** Revert compose ports
- **Required evidence:** Port scan results
- **Status:** NOT_STARTED

---

## Phase 2 — HTTP authentication and BFF routing

**Objective:** Make login sessions work for the declared access mode without silently weakening HTTPS.  
**Business value:** Users can authenticate at `http://<PUBLIC_IP>/login` if HTTP is required; HTTPS stays secure by default.  
**Entry criteria:** Phase 1 P0 secrets tasks complete or risk-accepted with ticket.  
**Exit criteria:** Routing + cookie tests pass on disposable stack; HTTP residual risk accepted if used.  
**Required tests:** Cookie/CSRF/HTTP-mode/Nginx tests from `TEST_STRATEGY.md`.  
**Rollback:** Revert nginx + cookie env flags; redeploy prior images.  
**Go/No-Go:** Pilot blocked until G1.* gates pass.

#### TODO-P2-001 — Nginx: route `/api/backend/` to Next.js before `/api/`
- **Title:** Fix BFF bypass in Nginx
- **Perspective/owner:** DevOps + Architect
- **Business reason:** Cookie auth and CSRF depend on same-origin BFF
- **Priority:** P0
- **Current evidence:** `infra/nginx/default.conf` sends all `/api/` to Nest
- **Assumption status:** Confirmed
- **Affected modules:** nginx, web BFF, auth
- **Affected files:** `infra/nginx/default.conf`
- **API impact:** Browser traffic shape changes
- **Database impact:** None
- **UI impact:** Login/session UX
- **Security impact:** Restores intended CSRF/cookie boundary
- **Performance impact:** Negligible
- **Deployment impact:** Nginx container reload
- **Risks:** Incorrect `proxy_pass` trailing slash rewriting
- **Dependencies:** TODO-P2-002 recommended same release
- **Implementation steps:** Add `location /api/backend/` → web; keep `/api/` → api; verify ordering; reload nginx
- **Acceptance criteria:** Request to `/api/backend/auth/me` unauthenticated returns **401** from app auth path, not Nest routing confusion; `/api/health` remains 200 via API
- **Test cases:** Curl header traces; Playwright login through `/api/backend`
- **Rollback plan:** Prior default.conf
- **Required evidence:** Curl `-v` traces for both paths
- **Status:** SOURCE_DONE — live curl **OPERATOR** (Phase 2 evidence)

#### TODO-P2-002 — Set `API_INTERNAL_URL` for web container
- **Title:** Point BFF upstream to Docker DNS `api`
- **Perspective/owner:** DevOps + Backend
- **Business reason:** BFF must not call localhost/public URL from inside container
- **Priority:** P0
- **Current evidence:** BFF reads `API_INTERNAL_URL` optionally; compose web env omits it
- **Assumption status:** A-05
- **Affected modules:** web BFF
- **Affected files:** `docker-compose.yml`, `.env*.example`
- **API impact:** Server-side proxy target
- **Database impact:** None
- **UI impact:** Fixes auth if broken
- **Security impact:** Keeps tokens server-side
- **Performance impact:** Lower latency vs hairpinning
- **Deployment impact:** Web recreate
- **Risks:** Wrong path doubling `/api/api`
- **Dependencies:** TODO-P2-001
- **Implementation steps:** Set `API_INTERNAL_URL=http://api:3000/api`; add example; integration test
- **Acceptance criteria:** From web container, BFF login succeeds against api service
- **Test cases:** docker exec wget/curl via BFF route; e2e login
- **Rollback plan:** Unset var / prior compose
- **Required evidence:** Container logs showing upstream host `api`
- **Status:** SOURCE_DONE — runtime on server **OPERATOR**

#### TODO-P2-003 — Explicit insecure HTTP cookie mode
- **Title:** Implement `COOKIE_SECURE` + `ALLOW_INSECURE_HTTP` opt-in
- **Perspective/owner:** Backend + Frontend + AppSec
- **Business reason:** Business requires HTTP now; must not break Secure-by-default HTTPS
- **Priority:** P0
- **Current evidence:** Nest and BFF set `secure` from `NODE_ENV===production` only
- **Assumption status:** A-02, A-08
- **Affected modules:** auth controller, session-cookies, env validation
- **Affected files:** `auth.controller.ts`, `session-cookies.ts`, `env.validation.ts`, docs
- **API impact:** Set-Cookie flags
- **Database impact:** None
- **UI impact:** Session persistence over HTTP
- **Security impact:** Residual MITM risk — must document
- **Performance impact:** None
- **Deployment impact:** Env flags on server
- **Risks:** Accidental disable of Secure on HTTPS
- **Dependencies:** Written risk acceptance
- **Implementation steps:** 1) Secure iff (`COOKIE_SECURE` not false) and not (ALLOW_INSECURE_HTTP) 2) Require both flags for insecure 3) Refuse insecure if `X-Forwarded-Proto=https` unless override 4) Startup warn 5) Align Nest SameSite to Lax for same-origin BFF
- **Acceptance criteria:** With both flags, cookies lack Secure over HTTP and login session sticks; without flags in production, Secure remains true; HTTPS deploy unaffected
- **Test cases:** Cookie attribute assertions in HTTP-mode and default-mode tests
- **Rollback plan:** Remove flags; restart
- **Required evidence:** Browser Application panel screenshots (redacted) + tests
- **Status:** SOURCE_DONE (web BFF) — Nest SameSite align remains TODO-P2-004; live smoke **OPERATOR**

#### TODO-P2-004 — Align Nest cookie SameSite with BFF
- **Title:** Stop production `SameSite=None` when using same-origin BFF
- **Perspective/owner:** Backend
- **Business reason:** `None` requires Secure and is unnecessary for same-site BFF
- **Priority:** P1
- **Current evidence:** `auth.controller.ts` uses None when secure
- **Assumption status:** Confirmed
- **Affected modules:** auth
- **Affected files:** `auth.controller.ts`
- **API impact:** Cookie header
- **Database impact:** None
- **UI impact:** Session reliability
- **Security impact:** Positive for HTTP/HTTPS clarity
- **Performance impact:** None
- **Deployment impact:** API restart
- **Risks:** Breaking true cross-site cookie clients if any remain
- **Dependencies:** Confirm no cross-site cookie clients
- **Implementation steps:** Default Lax; document if cross-site ever needed
- **Acceptance criteria:** Production same-origin login works with Lax; no cross-site dependency in web
- **Test cases:** Login + refresh e2e
- **Rollback plan:** Feature flag prior behavior
- **Required evidence:** E2E pass
- **Status:** NOT_STARTED

---

## Phase 3 — Deployment and source alignment

**Objective:** Make production builds traceable and reproducible.  
**Business value:** Faster incident response and safe rollback.  
**Entry criteria:** Phase 2 auth works in target mode.  
**Exit criteria:** Real SHA in health; deploy runbook uses tags.  
**Required tests:** build-info assertion; rollback drill.  
**Rollback:** Redeploy previous tag.  
**Go/No-Go:** No wide pilot without G2 gates.

#### TODO-P3-001 ? Inject real `APP_COMMIT_SHA` / build timestamp at deploy
- **Priority:** P1 | **Owner:** DevOps | **Status:** SOURCE_VALIDATED  
- **Evidence now:** `build-info.util.ts` + production Compose require SHA/timestamp; `prepare-release-build.mjs`; release CI injects SHA  
- **Acceptance criteria:** Health/build-info returns actual SHA matching deployed tag  
- **Remaining:** OPERATOR_RUNTIME_VALIDATION_REQUIRED on production host  
- **Affected files:** compose, prepare-release, Docker build args, health/build-info  
- **Rollback:** Prior image  

#### TODO-P3-002 ? Pin MinIO/mc image digests; review mongo/redis/nginx tags
- **Priority:** P1 | **Owner:** DevOps | **Status:** OPERATOR_ACTION_REQUIRED  
- **Acceptance criteria:** No `latest` in production compose; digests documented  
- **Note:** App images now use immutable SHA tags; dependency image digest pinning still open  

#### TODO-P3-003 ? Document server vs Git drift process
- **Priority:** P1 | **Owner:** Tech Lead | **Status:** SOURCE_VALIDATED  
- **Acceptance criteria:** Drift checklist exists; differences ticketed  
- **Evidence:** `RELEASE_BRANCH_STRATEGY.md`, `audit-server-release.ps1`, DEPLOY-REL-013/014  

#### TODO-P3-004 ? Windows reboot auto-start verification
- **Priority:** P1 | **Owner:** SRE (**OPERATOR**) | **Status:** OPERATOR_RUNTIME_VALIDATION_REQUIRED  
- **Acceptance criteria:** After reboot, nginx/web/api/mongo/redis healthy without manual docker desktop rediscovery (or documented manual step with owner)  

---

## Phase 4 — Automated QA and full-stack E2E

**Objective:** Replace contradictory auth tests; prove Nginx→BFF→API path.  
**Business value:** Prevent auth regressions that look “healthy” at `/login` HTML only.  
**Entry criteria:** Phase 2 complete on disposable stack.  
**Exit criteria:** Cookie e2e green; real-stack smoke green.  
**Required tests:** See TEST_STRATEGY.  
**Rollback:** Revert test-only changes freely; app rollback via prior SHA.  
**Go/No-Go:** G3 gates.

#### TODO-P4-001 — Rewrite Playwright auth specs for cookie BFF
- **Priority:** P0 | **Owner:** QA + Frontend | **Status:** NOT_STARTED  
- **Current evidence:** `e2e/auth.spec.ts` expects `localStorage.maintainpro_access_token`  
- **Acceptance criteria:** Zero assertions that access/refresh JWTs exist in localStorage; cookie presence asserted instead  
- **Affected files:** `apps/web/e2e/auth.spec.ts` and helpers  

#### TODO-P4-002 — Disposable real-stack e2e compose profile
- **Priority:** P1 | **Owner:** QA + DevOps | **Status:** NOT_STARTED  
- **Acceptance criteria:** Pipeline/job brings up stack, runs smoke, tears down e2e volumes only; never points at prod URLs  

#### TODO-P4-003 — CSRF and session-expiry UX e2e
- **Priority:** P1 | **Owner:** QA | **Status:** NOT_STARTED  
- **Acceptance criteria:** Missing CSRF → 403; expired session → login recovery without blank page  

#### TODO-P4-004 — Contract/OpenAPI drift check (follow-on)
- **Priority:** P2 | **Owner:** Backend | **Status:** NOT_STARTED  

---

## Phase 5A — Inventory Keeper access and stock issue (DONE)

#### TODO-P5A-001 — Inventory Keeper read + WO-linked stock issue
- **Priority:** P0 | **Owner:** Backend + QA | **Status:** IN_PROGRESS
- **Decision:** Option A RBAC (`INVENTORY_READ_ROLES` includes `INVENTORY_KEEPER`)
- **Acceptance:** E2E-INV-001..016 no skip; focused inventory gate; negative/idempotent/tenant controls

#### TODO-P5A-002 — ERP apply role narrowing (follow-on)
- **Priority:** P1 | **Owner:** BA + Backend | **Status:** NOT_STARTED
- **Note:** Legacy ERP apply still lists keeper — do not expand in 5A

---

## Phase 5B — Work-order lifecycle (IN PROGRESS)

#### TODO-P5B-001 — Complete WO lifecycle controls + E2E
- **Priority:** P0 | **Owner:** Backend + QA | **Status:** IN_PROGRESS
- **Acceptance:** Maker-checker, assignment sync, start gate, verify-supervisor, E2E-WO-LC mandatory skips=0

---

## Phase 5 — ERP workflow and control validation

**Objective:** Prove inventory, WO, purchasing controls for pilot.  
**Business value:** Prevent financial/stock leakage at go-live.  
**Entry criteria:** Auth stable; disposable data available.  
**Exit criteria:** Negative stock, dual approval, audit, tenant isolation demos signed.  
**Required tests:** ERP workflow tests.  
**Rollback:** Data fixes via compensating transactions; no silent deletes.  
**Go/No-Go:** G4 gates.

#### TODO-P5-001 — Inventory negative-stock and concurrency tests
- **Priority:** P1 | **Owner:** Backend + QA | **Status:** NOT_STARTED  
- **Evidence:** `negative_stock_blocked` exists — needs concurrency proof  
- **Acceptance criteria:** Parallel stock-out cannot drive qty below zero  

#### TODO-P5-002 — PO operational + finance approval SoD matrix
- **Priority:** P1 | **Owner:** BA + Backend | **Status:** NOT_STARTED  
- **Acceptance criteria:** Documented SoD rules enforced or explicitly waived per tenant policy  

#### TODO-P5-003 — Work-order lifecycle pilot script
- **Priority:** P1 | **Owner:** BA + QA | **Status:** NOT_STARTED  
- **Acceptance criteria:** Scripted WO path with evidence + close + audit rows  

#### TODO-P5-004 — ERP source-of-truth matrix workshop
- **Priority:** P1 | **Owner:** BA + customer | **Status:** NOT_STARTED  
- **Acceptance criteria:** Signed matrix for items/PO/stock/vendors/invoices  

#### TODO-P5-005 — Maker-checker gaps on stock adjustments
- **Priority:** P2 | **Owner:** BA + Backend | **Status:** NOT_STARTED  

#### TODO-P5-006 — Three-way match / AP scope decision
- **Priority:** P2 | **Owner:** Product + BA | **Status:** NOT_STARTED  
- **Acceptance criteria:** Written decision: integrate-only vs build  

---

## Phase 6 — Performance and scalability

**Objective:** Establish latency budgets and index health.  
**Entry criteria:** Stable staging-like environment.  
**Exit criteria:** p95 budgets measured; hot indexes listed.  
**Go/No-Go:** Soft for pilot; hard for scale-up.

#### TODO-P6-001 — Baseline p50/p95/p99 for health/login/WO list/inventory
- **Priority:** P2 | **Owner:** Performance | **Status:** NOT_STARTED  

#### TODO-P6-002 — Mongo slow-query + index review for largest collections
- **Priority:** P2 | **Owner:** Backend + DBA | **Status:** NOT_STARTED  

#### TODO-P6-003 — Compose memory/CPU limits
- **Priority:** P1 | **Owner:** SRE | **Status:** NOT_STARTED  
- **Acceptance criteria:** Each service has memory limit; OOM behavior documented  

#### TODO-P6-004 — Soak test 4h staging
- **Priority:** P2 | **Owner:** Performance | **Status:** NOT_STARTED  

---

## Phase 7 — Observability and operational readiness

**Objective:** Detect failures before users report them.  
**Entry criteria:** Phase 2–3 complete.  
**Exit criteria:** Request ID correlation documented; disk/log alerts exist.  

#### TODO-P7-001 — Confirm request ID propagation Nginx→web→api
- **Priority:** P2 | **Owner:** Backend | **Status:** NOT_STARTED  

#### TODO-P7-002 — Docker json-file log rotation
- **Priority:** P1 | **Owner:** SRE | **Status:** NOT_STARTED  
- **Acceptance criteria:** `max-size`/`max-file` set; disk growth bounded in 7-day test  

#### TODO-P7-003 — Queue/ERP/notification failure dashboards or log queries
- **Priority:** P2 | **Owner:** SRE + Backend | **Status:** NOT_STARTED  

#### TODO-P7-004 — Uptime check on `/login` and `/api/health`
- **Priority:** P1 | **Owner:** SRE | **Status:** NOT_STARTED  

---

## Phase 8 — Backup, restore, and disaster recovery

**Objective:** Meet agreed RPO/RTO (once defined).  
**Entry criteria:** Unanswered RPO/RTO answered or interim defaults approved.  
**Exit criteria:** Restore drill success.  

#### TODO-P8-001 — Define interim RPO/RTO if business unanswered
- **Priority:** P1 | **Owner:** Tech Lead + customer | **Status:** NOT_STARTED  
- **Acceptance criteria:** Numeric RPO/RTO recorded  

#### TODO-P8-002 — Scheduled Mongo backup off-server
- **Priority:** P1 | **Owner:** Ops | **Status:** NOT_STARTED  
- **Acceptance criteria:** Daily backup artifact outside server disk; checksum stored  

#### TODO-P8-003 — Isolated restore drill
- **Priority:** P1 | **Owner:** Ops + Backend | **Status:** NOT_STARTED  
- **Acceptance criteria:** Restored DB collection counts match backup manifest  

#### TODO-P8-004 — MinIO backup/versioning policy
- **Priority:** P2 | **Owner:** Ops | **Status:** NOT_STARTED  

---

## Phase 9 — Security hardening

**Objective:** Reduce attack surface beyond P0 blockers.  
**Entry criteria:** P0 auth/secrets closed.  

#### TODO-P9-001 — npm audit controlled upgrade groups
- **Priority:** P2 | **Owner:** AppSec | **Status:** NOT_STARTED  
- **Evidence:** CI audit non-blocking; advisories historically present  
- **Acceptance criteria:** Grouped PRs with regression tests; critical runtime vulns ticketed  

#### TODO-P9-002 — Dependency scanning / secret scanning enablement
- **Priority:** P2 | **Owner:** AppSec + GitHub admin | **Status:** NOT_STARTED  

#### TODO-P9-003 — Branch protection + required checks on `main`
- **Priority:** P1 | **Owner:** Tech Lead | **Status:** NOT_STARTED  
- **Acceptance criteria:** Force-push denied; PR validation required  

#### TODO-P9-004 — TLS plan and HTTP exception expiry
- **Priority:** P0 (governance) | **Owner:** Security + business | **Status:** NOT_STARTED  
- **Acceptance criteria:** Written HTTPS target date; HTTP risk acceptance signed  

#### TODO-P9-005 — External port exposure continuous check
- **Priority:** P1 | **Owner:** SRE | **Status:** NOT_STARTED  

---

## Phase 10 — Controlled pilot and go-live

**Objective:** Limited production use with rollback ready.  
**Entry criteria:** Gates G0–G3 + G4.1 + G5.1–G5.2.  
**Exit criteria:** Pilot report; GO/NO-GO for wider rollout.  

#### TODO-P10-001 — Pilot user/tenant selection and training
- **Priority:** P1 | **Owner:** PM + BA | **Status:** NOT_STARTED  

#### TODO-P10-002 — Pilot execution (min 5 business days)
- **Priority:** P1 | **Owner:** PM + Ops | **Status:** NOT_STARTED  
- **Acceptance criteria:** Daily incident log; no unresolved P0  

#### TODO-P10-003 — Go-live decision pack update with evidence links
- **Priority:** P1 | **Owner:** Tech Lead | **Status:** NOT_STARTED  
- **Acceptance criteria:** Verdict GO or NO-GO with gate checklist attached  

#### TODO-P10-004 — Wider rollout only after pilot exit
- **Priority:** P2 | **Owner:** PM | **Status:** NOT_STARTED  

---

## Cross-cutting UI/UX TODOs (schedule into Phases 2/4/5)

| ID | Title | Priority | Status |
| --- | --- | --- | --- |
| TODO-UX-001 | Session-expired banner + safe redirect for cookie auth | P1 | NOT_STARTED |
| TODO-UX-002 | Approval inbox clarity for PO/part-request | P2 | NOT_STARTED |
| TODO-UX-003 | Stock availability warnings before issue | P2 | NOT_STARTED |
| TODO-UX-004 | Accessibility pass on login + WO forms | P3 | NOT_STARTED |
| TODO-UX-005 | Mobile responsive check for technician WO evidence | P2 | NOT_STARTED |

## Cross-cutting performance TODOs

| ID | Title | Priority | Status |
| --- | --- | --- | --- |
| TODO-PERF-001 | Pagination audit on unbounded lists | P2 | NOT_STARTED |
| TODO-PERF-002 | Export job async for large reports | P3 | NOT_STARTED |

---

## Priority backlog snapshot

**P0 (do first):** P0-001…003, P1-001…004, P2-001…003, P4-001, P9-004  
**P1:** Remaining Phase 2–5/7–8 gates  
**P2/P3:** Performance polish, full AP, a11y, advanced ERP

---

## Confirmation

This file is a plan. Implementation begins only when explicitly authorized after this analysis phase.
---

## Phase 1 implementation evidence (2026-07-31)

**Scope executed:** Secret/config safety only (no HTTP cookies, no Nginx BFF changes).

| TODO | Status | Evidence |
| --- | --- | --- |
| P1-SEC-001 Docker/Git secret exclusion | VALIDATED (structural) | Updated `.dockerignore` files; `validate:secret-safety` SEC-CONFIG-002 |
| P1-SEC-002 Automated validation script | VALIDATED | `scripts/validate-secret-safety.mjs` + npm script |
| P1-CONFIG-001 Production compose layer | VALIDATED (structural) | `docker-compose.production.yml` |
| P1-CONFIG-002 Port exposure | VALIDATED (structural) | MinIO removed from public base publish; prod binds `127.0.0.1` only; Redis/API/Web unpublished |
| P1-CONFIG-003 Production env template | VALIDATED | `.env.production.example` + `.env.production.structure-fixture.example` |
| P1-CONFIG-004 CI separation | VALIDATED (workflow updated) | Base no longer loads compose-ci; CI uses `--env-file .env.compose-ci`; prod config uses structure fixture |
| P1-OPS-001 Rotation runbook | DONE (doc) | `OPERATOR_SECRET_ROTATION_RUNBOOK.md` |
| TODO-P1-002 Actual Mongo root rotation | **OPERATOR_ACTION_REQUIRED / BLOCKED** | No automatic rotation; awaiting operator evidence |
| P1-SEC-003 Image path verification | VALIDATED when CI/local image check run | `validate-image-secret-paths.mjs` + `DOCKER_IMAGE_SECRET_VERIFICATION.md` |
| Public port 80 ownership | UNANSWERED | Documented; not changed this phase |

**Test IDs covered:** SEC-CONFIG-001…004, DEPLOY-CONFIG-001…002, NET-PORT-001…002.
---

## Phase 2 implementation evidence (2026-07-21)

**Scope:** Fail-closed HTTP cookie mode, Nginx `/api/backend/` to Web, `API_INTERNAL_URL`, BFF/CSRF tests, auth e2e alignment. No production deploy. Live HTTP login **not** claimed.

| Item | Status | Evidence |
| --- | --- | --- |
| Runtime cookie config | SOURCE_VALIDATED | `runtime-security-config.ts` + unit tests (HTTP-CONFIG-*, COOKIE-*) |
| Session cookies | SOURCE_VALIDATED | `session-cookies.ts` |
| BFF + CSRF | SOURCE_VALIDATED | `bff-auth.ts`, `bff-proxy.ts`, `BFF_CSRF_EXEMPTIONS.md`, route tests |
| Nginx BFF routing | SOURCE_VALIDATED (static) | `default.conf` + `validate:nginx-routing` |
| API_INTERNAL_URL | SOURCE_VALIDATED (compose) | `docker-compose.production.yml` + env examples |
| Auth e2e cookie architecture | SOURCE_UPDATED | `e2e/auth.spec.ts` |
| Operator smoke | SPEC ONLY | `HTTP_BFF_SMOKE_TEST.md` � table empty |
| Mongo root rotation (Phase 1) | **OPERATOR_ACTION_REQUIRED** | Still open |
| HTTPS recommendation | DOCUMENTED | HTTP is not secure transport; dual opt-in required |

---

## Phase 2 closeout (Nest cookie ownership) — SOURCE_VALIDATED

**Selected option:** Option A — NestJS does **not** issue browser session cookies.

**Evidence:**
- Mobile clients use FlutterSecureStorage + JSON token bodies (pps/mobile/lib/core/storage/token_storage.dart).
- Next.js BFF strips tokens and sets maintainpro_* cookies (ff-proxy.ts).
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

---

## Phase 4 source progress (2026-08-01)

| Item | Status |
| --- | --- |
| Isolated E2E Compose | SOURCE_VALIDATED |
| E2E safety / no-mock validators | SOURCE_VALIDATED |
| Real-stack Playwright suite | SOURCE_VALIDATED |
| Full-stack E2E CI workflow | SOURCE_VALIDATED |
| Node-based API/Web healthchecks | SOURCE_VALIDATED (Phase 4B) |
| Container healthcheck validator | SOURCE_VALIDATED |
| Docker runtime on this agent | BLOCKED / OPERATOR_RUNTIME_VALIDATION_REQUIRED when engine down |
| Full-stack CI runtime | IN_PROGRESS / not yet RUNTIME_VALIDATED |
| Live production login | NOT validated |

| Playwright E2E env loader | SOURCE_VALIDATED (Phase 4B attempt 2) |
| E2E env line-boundary / materialize | SOURCE_VALIDATED (Phase 4B attempt 3) |
| Nginx BFF proxy buffers + auth-path diag | SOURCE_VALIDATED (Phase 4B attempt 4) |
| Login success HTTP 200 contract | SOURCE_VALIDATED (Phase 4B attempt 5) |
| Browser session request-context + logout CSRF | SOURCE_VALIDATED (Phase 4B attempt 6; runtime pending) |
| Work-order create payload + CSRF-003 exact 201 | SOURCE_VALIDATED (Phase 4B attempt 7; runtime pending) |
| Full-stack CI runtime evidence (`30696336211` / `0ecd3fa`) | PARTIAL_RUNTIME_VALIDATION (superseded by Phase 5A) |
| Phase 5A inventory runtime (`30698756592` / `e41d7ab`) | RUNTIME_VALIDATED |



## Phase 5B status

- Status: **RUNTIME_VALIDATED** (workflow `30703557700`, app SHA `15d28f35f4c3ab23dd851b6a7ea232678f47a2ae`)
- Scope: work-order lifecycle approval → assignment → start → inventory → evidence → technician completion → supervisor verification
- Not go-live ready; Phase 5C/5D remain
