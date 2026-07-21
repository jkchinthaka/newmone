# Source and Deployment Alignment

**Generated:** 2026-07-21
**Branch:** `fix/enterprise-production-hardening`
**Purpose:** Reconcile local commits, GitHub remote, and staging deployments before submit-reliability work.

## Git reconciliation (Phase 0)

| Item | Value |
|------|-------|
| Current local branch | `fix/enterprise-production-hardening` |
| Local HEAD SHA | `8827edcd52d25dfde3feff3669a457af71043ac6 (docs commit; subsequent reliability commits follow)` |
| `origin/fix/enterprise-production-hardening` (before push) | `99161ec79c6edb359ca6d717877d34296be52058` |
| `origin/main` SHA | `30afa06df860197702e179936c1c280528edb0cd` |
| Working tree | clean (no untracked / modified files at Phase 0 start) |
| Merge conflicts | none |
| Local commits absent from remote feature branch | **31** (tenant isolation + farm + RBAC hardening) |
| Remote commits absent from local | none on the feature branch tip; local is **behind `origin/main` by 2 merge commits** (`#6`, `#7`) which merged earlier slices of this branch into `main` |

### Commits present locally but not on remote feature branch (summary)

Includes work-orders/inventory/users-people tenancy, cleaning/utilities/operations/compliance, all farm modules, RBAC/platform-scope hardening, audit:rbac CI gate, Stripe webhook signature enforcement, and related docs/tests. Full list: `git log origin/fix/enterprise-production-hardening..HEAD --oneline`.

### Branch policy decision

Keep using `fix/enterprise-production-hardening` — it already contains the completed hardening work. Do not create a second branch. Do not push to `main`. Do not force-push.

## Staging URLs (treated as staging)

| Surface | URL |
|---------|-----|
| Frontend | https://newmone.chinthakajayaweera1.workers.dev |
| Frontend login | https://newmone.chinthakajayaweera1.workers.dev/login |
| API | https://newmone.onrender.com |

## Deployed revision identification (status)

| Surface | Deployed SHA | Status |
|---------|--------------|--------|
| Local feature branch | `a5b50e9…` | known |
| GitHub feature branch | 8827edc… (pushed) | aligned with local tip at push time |
| Cloudflare Workers frontend | **unknown** | no `/api/build-info` (or equivalent) exists yet |
| Render API | **unknown** | no `/api/build-info` exists yet |

**Blocker:** Frontend and API staging cannot be proven to share a compatible revision until safe build-info endpoints are shipped and both surfaces are redeployed from one selected release SHA.

## Known session architecture issues (pre-fix evidence)

Verified in source (`apps/web/lib/auth-storage.ts`, `apps/web/lib/api-client.ts`):

1. Access JWT stored in `localStorage` (`maintainpro_access_token`) — XSS-exposed.
2. Refresh relies on HttpOnly cookie on the **API** origin plus a non-HttpOnly `maintainpro_csrf` cookie.
3. Frontend attempts `document.cookie` read of `maintainpro_csrf` — **fails when web and API are different origins**, so refresh often cannot attach CSRF and returns false → session redirect.
4. No shared in-flight refresh promise for concurrent 401s (each interceptor may call refresh independently).
5. Active tenant ID stored in `localStorage` without mandatory membership revalidation on every bootstrap (`lib/tenant-context.ts`).

## Next actions

1. Push the 31 local commits to `origin/fix/enterprise-production-hardening`.
2. Add safe web + API build-info endpoints (`APP_COMMIT_SHA`, etc.).
3. Redeploy Cloudflare + Render from one verified SHA and record IDs here.
4. Proceed with same-origin BFF/session, tenant bootstrap, OpenAPI contracts, Docker CI, and real E2E.

## Verdict so far

**Source:** local hardening commits are valid and ahead of remote — push required.
**Deployment alignment:** **NOT ALIGNED / SHAs UNKNOWN** — NO-GO for production until build-info + redeploy evidence exists.
## Post-push update (2026-07-21)

- Pushed feature branch to origin/fix/enterprise-production-hardening.
- Remote and local matched at 8827edc immediately after push.
- Subsequent commits on this branch add BFF session, build-info, request IDs, Docker CI env, and refresh-token family.
- Cloudflare / Render deployed SHAs remain **unknown** until redeploy with APP_COMMIT_SHA set and build-info endpoints live.