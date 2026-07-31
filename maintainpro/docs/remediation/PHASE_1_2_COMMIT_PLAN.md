# Phase 1 + Phase 2 Commit Plan

**Branch:** `fix/phase1-phase2-production-remediation`  
**Rule:** Do **not** use `git add .`. Do not commit automatically. Stage only listed paths.

**Note:** An earlier operator commit (`okk` / `49bbd3d`) may already include Phase 1+2 source on this branch. Use this plan for:

1. Reviewing what belongs together, and/or
2. Splitting future amendments (Nest cookie closeout + docs) into reviewable commits.

Do not include real `.env`, `node_modules`, `.next`, `dist`, or secret-bearing screenshots.

---

## Commit A — Phase 1 secret and production configuration safety

**Suggested message:**

```text
security(config): separate production configuration and protect secrets
```

**Exact files (include only these):**

- `.dockerignore` (repo root) — if present in the change set
- `.github/workflows/docker-build-check.yml`
- `.github/workflows/pr-validation.yml`
- `maintainpro/.dockerignore`
- `maintainpro/apps/api/.dockerignore`
- `maintainpro/apps/web/.dockerignore`
- `maintainpro/docker-compose.yml` (Phase 1 portions: no compose-ci env_file; MinIO expose)
- `maintainpro/docker-compose.ci.yml`
- `maintainpro/docker-compose.local-admin.yml`
- `maintainpro/docker-compose.production.yml` (Phase 1 secrets/ports; see mixed-file note for Phase 2 web env)
- `maintainpro/.env.production.example` (Phase 1 template; see mixed-file note)
- `maintainpro/.env.production.structure-fixture.example`
- `maintainpro/scripts/validate-secret-safety.mjs`
- `maintainpro/scripts/validate-image-secret-paths.mjs`
- `maintainpro/package.json` scripts for `validate:secret-safety` / `validate:image-secrets` only (see mixed-file note)
- `maintainpro/docs/remediation/OPERATOR_SECRET_ROTATION_RUNBOOK.md`
- `maintainpro/docs/remediation/DOCKER_IMAGE_SECRET_VERIFICATION.md`
- Phase 1 sections in remediation docs (if splitting docs by commit, prefer Commit A for initial docs creation and Commit B for Phase 2 appendices)

**Staging example:**

```bash
git add -- \
  .dockerignore \
  .github/workflows/docker-build-check.yml \
  .github/workflows/pr-validation.yml \
  maintainpro/.dockerignore \
  maintainpro/apps/api/.dockerignore \
  maintainpro/apps/web/.dockerignore \
  maintainpro/docker-compose.ci.yml \
  maintainpro/docker-compose.local-admin.yml \
  maintainpro/scripts/validate-secret-safety.mjs \
  maintainpro/scripts/validate-image-secret-paths.mjs \
  maintainpro/docs/remediation/OPERATOR_SECRET_ROTATION_RUNBOOK.md \
  maintainpro/docs/remediation/DOCKER_IMAGE_SECRET_VERIFICATION.md
```

---

## Commit B — Phase 2 HTTP/BFF authentication and routing (+ closeout)

**Suggested message:**

```text
fix(auth): align HTTP cookie mode and same-origin BFF routing
```

**Exact files:**

- `maintainpro/apps/web/lib/runtime-security-config.ts`
- `maintainpro/apps/web/lib/session-cookies.ts`
- `maintainpro/apps/web/lib/bff-auth.ts`
- `maintainpro/apps/web/lib/bff-proxy.ts`
- `maintainpro/apps/web/app/api/backend/[...path]/route.ts`
- `maintainpro/apps/web/e2e/auth.spec.ts`
- `maintainpro/apps/api/src/modules/auth/auth.controller.ts`
- `maintainpro/apps/api/src/modules/auth/auth-cookie.policy.ts`
- `maintainpro/apps/api/src/modules/tenancy/tenancy.controller.ts`
- `maintainpro/apps/api/test/runtime-security-config.spec.ts`
- `maintainpro/apps/api/test/bff-auth.spec.ts`
- `maintainpro/apps/api/test/bff-backend-route.spec.ts`
- `maintainpro/apps/api/test/nest-auth-cookies.spec.ts`
- `maintainpro/apps/api/tsconfig.json` (excludes for web-importing tests)
- `maintainpro/infra/nginx/default.conf`
- `maintainpro/scripts/validate-nginx-bff-routing.mjs`
- `maintainpro/docs/remediation/HTTP_BFF_SMOKE_TEST.md`
- `maintainpro/docs/remediation/BFF_CSRF_EXEMPTIONS.md`
- `maintainpro/docs/remediation/PHASE_1_2_COMMIT_PLAN.md`
- Phase 2 evidence updates in `MASTER_TODO.md`, `RISK_REGISTER.md`, `ARCHITECTURE_FINDINGS.md`, `TEST_STRATEGY.md`, `GO_LIVE_GATES.md`, `ASSUMPTIONS_AND_QUESTIONS.md`

**Staging example:**

```bash
git add -- \
  maintainpro/apps/web/lib/runtime-security-config.ts \
  maintainpro/apps/web/lib/session-cookies.ts \
  maintainpro/apps/web/lib/bff-auth.ts \
  maintainpro/apps/web/lib/bff-proxy.ts \
  maintainpro/apps/web/app/api/backend/[...path]/route.ts \
  maintainpro/apps/web/e2e/auth.spec.ts \
  maintainpro/apps/api/src/modules/auth/auth.controller.ts \
  maintainpro/apps/api/src/modules/auth/auth-cookie.policy.ts \
  maintainpro/apps/api/src/modules/tenancy/tenancy.controller.ts \
  maintainpro/apps/api/test/runtime-security-config.spec.ts \
  maintainpro/apps/api/test/bff-auth.spec.ts \
  maintainpro/apps/api/test/bff-backend-route.spec.ts \
  maintainpro/apps/api/test/nest-auth-cookies.spec.ts \
  maintainpro/infra/nginx/default.conf \
  maintainpro/scripts/validate-nginx-bff-routing.mjs \
  maintainpro/docs/remediation/HTTP_BFF_SMOKE_TEST.md \
  maintainpro/docs/remediation/BFF_CSRF_EXEMPTIONS.md \
  maintainpro/docs/remediation/PHASE_1_2_COMMIT_PLAN.md
```

---

## Commit C — Unrelated HTTP exception filter correction

**Suggested message:**

```text
fix(api): preserve permission-denied error classification
```

**Exact files:**

- `maintainpro/apps/api/src/common/filters/http-exception.filter.ts`
- `maintainpro/apps/api/test/http-exception-database-unavailable.spec.ts`

```bash
git add -- \
  maintainpro/apps/api/src/common/filters/http-exception.filter.ts \
  maintainpro/apps/api/test/http-exception-database-unavailable.spec.ts
```

---

## Mixed files — staged-hunk strategy

These files contain both Phase 1 and Phase 2 concerns:

| File | Phase 1 content | Phase 2 content | Strategy |
| --- | --- | --- | --- |
| `maintainpro/docker-compose.production.yml` | Required `.env`, loopback ports, secret `${VAR:?}` | Web `API_INTERNAL_URL`, `COOKIE_*`, `NEXT_PUBLIC_USE_BFF` | Prefer **one commit** with Phase 2 message if already intertwined; or `git add -p` to stage Phase 1 hunks in Commit A and Phase 2 env hunks in Commit B |
| `maintainpro/.env.production.example` | Secret placeholders, Mongo/JWT/MinIO | Cookie HTTP dual opt-in comments, `API_INTERNAL_URL` | Same as above — `git add -p` |
| `maintainpro/package.json` | `validate:secret-safety`, `validate:image-secrets` | `validate:nginx-routing` | `git add -p` or include full scripts block in Commit B if tiny |
| Remediation docs | Phase 1 evidence sections | Phase 2 / closeout sections | Append-only docs: Commit A for initial create; Commit B for Phase 2 appendices if history allows; otherwise one docs commit with clear message |

**Safe `git add -p` rules:**

1. Never stage hunks that introduce real secrets.
2. Never stage `maintainpro/.env` (must remain untracked).
3. If unsure, put the whole mixed file in Commit B and mention Phase 1 carry-over in the commit body.

---

## Out of scope for these commits

- MongoDB root rotation evidence
- Live HTTP smoke results
- Docker image secret scan evidence from production hosts
- Generated build artifacts

---

## Commit execution status

**Not executed by the agent.** Operator/Tech Lead runs commits manually after review.