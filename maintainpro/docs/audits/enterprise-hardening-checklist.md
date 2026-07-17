# Enterprise Hardening — Implementation Checklist

**Branch:** `fix/enterprise-production-hardening`  
**Updated:** 2026-07-17

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked (operator)

---

## Running log

| Date | Item | Notes |
|------|------|-------|
| 2026-07-17 | Phase 0 baseline | Commands green; lint alias + CI path + secret exposure documented |
| 2026-07-17 | Branch created | `fix/enterprise-production-hardening` from `main` |
| 2026-07-17 | Phase 1 P0 | Public user select, audit/replication redaction, secret-leak tests |
| 2026-07-17 | Phase 5 partial | Root PR/docker/staging workflows; nested workflows removed |

### Failed commands

| Command | Exit | Notes |
|---------|-----:|-------|
| `npm audit` | 1 | Expected — 65 vulns reported (evidence, not a build break) |

### Operator-owned actions

| ID | Action | Owner |
|----|--------|-------|
| OP-01 | Enable GitHub branch protection requiring new root PR workflow | Repo admin |
| OP-02 | Rotate any staging credentials if secret-leak tests find historical exposure | Security |
| OP-03 | Schedule dependency upgrades (Next, nodemailer, OpenNext, xlsx replacement) | DevOps |
| OP-04 | Configure production Sentry / OTel endpoints (no secrets in repo) | Ops |
| OP-05 | Production environment approval gate in GitHub Environments | DevOps |
| OP-06 | Staging Playwright credentials for real E2E in CI | QA |

### Unresolved blockers

| ID | Blocker |
|----|---------|
| BL-01 | Real browser E2E against live staging requires operator secrets (OP-06) |
| BL-02 | Cookie-only web auth needs CORS/`credentials` and same-site domain alignment on Cloudflare + Render |

---

## Phase 0 — Baseline

- [x] Inspect architecture, docs, tests, guards, Prisma middleware, workflows
- [x] Run `npm ci`, `db:generate`, `typecheck`, `lint`, `test`, `build`
- [x] Record npm audit
- [x] Create `docs/audits/enterprise-hardening-baseline.md`
- [x] Create this checklist

## Phase 1 — Sensitive-data exposure

- [x] Central `public-user.select.ts`
- [x] Replace unrestricted user relation includes
- [x] Response secret-leak detector tests
- [x] Central audit redaction + tests
- [x] Replication data classification + tests
- [x] Document API response data-classification policy

## Phase 2 — Multi-tenancy fail-closed

- [ ] Tenant scope decorators / metadata
- [ ] Guard fail-closed for tenant-scoped routes
- [ ] Mandatory tenant query helper / repository pattern
- [ ] Cross-tenant FK validation for critical modules
- [ ] Tenant isolation test matrix

## Phase 3 — Auth / session

- [ ] Stop password trim on login
- [ ] Cookie-only web session + CSRF
- [ ] Remove localStorage access token
- [ ] Refresh token family / reuse detection
- [ ] Production JWT secret validation
- [ ] Production CSP without `unsafe-eval`

## Phase 4 — RBAC

- [ ] Resolve 24 TODO routes
- [ ] Regenerate RBAC audit (0 high-risk TODO)
- [ ] CI failure on RBAC regression
- [ ] Stripe webhook signature verification confirmed

## Phase 5 — CI/CD

- [x] Move workflows to root `.github/workflows/`
- [x] Root PR validation (ci, security tests, artifacts)
- [ ] Real ESLint (not typecheck alias)
- [ ] Coverage gates for auth/tenancy
- [ ] Security pipeline (CodeQL, dependency review, audit)
- [ ] Deployment approval + rollback docs

## Phases 6–12

- [ ] Navigation registry + role dashboards (6)
- [ ] Operational UI standards (7)
- [ ] QA pyramid + real E2E env (8)
- [ ] Cloud/deployment architecture decision (9)
- [ ] Observability + graceful shutdown (10)
- [ ] Business workflows / KPIs (11)
- [ ] Migration + go-live pack (12)

---

## Acceptance criteria tracker

See master prompt. Do **not** mark production-ready until Security / Quality / Operations / Business sections have automated evidence.
