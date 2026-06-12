# MaintainPro Risk Register

## Active Risks

### RISK-SEC-010-TOKEN-SESSION-HARDENING-DRIFT
- **Category:** Security / Authentication
- **Description:** Token/session handling regressions (cookie flags, CSRF validation, refresh rotation) could reintroduce account takeover vectors.
- **Impact:** Session hijack risk, unauthorized account access, compliance gaps.
- **Likelihood:** Low-Medium
- **Current Mitigation:**
  - Refresh tokens are cookie-based and HTTP-only.
  - CSRF double-submit validation is enforced on refresh/logout cookie flows.
  - Refresh token persistence + rotation + revocation paths are covered by automated tests.
- **Residual Risk:** Browser/client edge-case regressions if future auth changes bypass shared API client/cookie flow.
- **Owner:** API/Auth
- **Review Cadence:** Every auth-related release.

### RISK-SEC-011-WEBSOCKET-TENANT-LEAKAGE
- **Category:** Security / Multi-tenancy
- **Description:** Mis-scoped websocket rooms/events could leak live notifications/fleet telemetry across tenants.
- **Impact:** Cross-tenant data exposure, incident response burden, contractual risk.
- **Likelihood:** Low (post SEC-011)
- **Current Mitigation:**
  - JWT + active-user validation on websocket handshake.
  - Tenant room scoping for notifications/fleet channels.
  - Dedicated gateway tests for room routing and unauthorized connection rejection.
- **Residual Risk:** New gateway/event additions must consistently apply room scoping rules.
- **Owner:** Platform Realtime
- **Review Cadence:** Every websocket/gateway change.

### RISK-SEC-006-TENANT-ISOLATION-RESIDUAL
- **Category:** Security / Multi-tenancy
- **Description:** Residual tenant isolation risk after SEC-006 closure — new endpoints or refactors may omit tenant filters.
- **Impact:** Potential cross-tenant read/write leakage on newly added code paths.
- **Likelihood:** Low (post-closure) with ongoing review; was Medium during sweep.
- **Current Mitigation:**
  - SEC-006 closed 5 high-risk gaps (vehicle delete, WO assign, fleet alerts/geofences, notification reference mutations).
  - Targeted isolation tests for vehicles, work-orders, fleet, notifications, trips, users, utilities.
  - `TenantContextGuard` enforces membership; services use `requestContext.getTenantId()` patterns.
  - SUPER_ADMIN cross-tenant access is explicit (null tenant or validated `X-Tenant-Id`), not accidental for normal users.
  - QA checklist includes manual cross-tenant access attempts.
- **Residual Risk:** In-memory fleet geofences (tenant-scoped at API layer but not persisted); notification list is user-scoped not tenant-column-scoped.
- **Owner:** API Platform
- **Review Cadence:** Every new tenant-owned module or Prisma mutation; quarterly spot audit.

### RISK-SEC-012-REDIS-QUEUE
- **Category:** Security / Reliability
- **Description:** Redis or Bull queue connectivity failures can degrade notification/report dispatch and operational automation.
- **Impact:** Delayed or dropped async tasks, reduced observability, operational blind spots.
- **Likelihood:** Medium
- **Current Mitigation:**
  - Queue/Redis status is surfaced in readiness and system health output.
  - Queue failures update health state with sanitized error metadata.
  - Notification dispatch falls back to direct send when queue is unavailable.
  - Redis-related bootstrap failures are logged through structured queue-health logging.
- **Residual Risk:** If Redis remains unavailable for an extended period, async throughput may degrade despite fallback.
- **Owner:** Platform / API
- **Review Cadence:** Each release and after any Redis infrastructure change.

### RISK-SEC-013-UNSAFE-MOCK-MODES
- **Category:** Security / Compliance / Revenue Integrity
- **Description:** Production integrations running in implicit mock/no-op modes can hide delivery failures and create false operational/billing outcomes.
- **Impact:** Fake ERP/billing success, missed notifications, incorrect compliance posture, and audit/revenue risk.
- **Likelihood:** Medium (without strict mode validation); Low (with SEC-013 controls).
- **Current Mitigation:**
  - Explicit integration mode envs (`ERP_MODE`, `BILLING_MODE`, `EMAIL_MODE`, `SMS_MODE`, `PUSH_MODE`, `STORAGE_MODE`).
  - Production startup validation blocks unsafe mock modes unless `ALLOW_MOCK_IN_PRODUCTION=true`.
  - Readiness/system health exposes `mock`, `misconfigured`, `disabled`, `failed`, `degraded`, and `operational` integration states.
  - Billing and ERP services enforce runtime mode checks to prevent unsafe production mock success paths.
- **Residual Risk:** Temporary production mock overrides (`ALLOW_MOCK_IN_PRODUCTION=true`) require strict operational governance and expiry tracking.
- **Owner:** Platform / API + DevOps
- **Review Cadence:** Every release and every production env change.

### RISK-BUILD-REGISTER-SUSPENSE-BLOCKER
- **Category:** Delivery / Build Stability
- **Description:** Web auth `/register` previously failed static prerender because `useSearchParams` was used without a Suspense boundary.
- **Impact:** Was blocking full monorepo build and delaying release confidence.
- **Likelihood:** Low (resolved by WEB-001 refactor).
- **Current Mitigation:**
  - Route now uses server `page.tsx` + `<Suspense>` wrapper with client child component for `useSearchParams` access.
  - Verified passing `npm run build --workspace @maintainpro/web` and full `npm run build` monorepo build.
- **Residual Risk:** Similar regressions can recur if future App Router pages use client navigation hooks in prerendered routes without Suspense/client separation.
- **Owner:** Web Platform
- **Review Cadence:** Every auth-route structural change and before release cut.

### RISK-UX-003-LOGIN-IDENTIFIER-AMBIGUITY
- **Category:** Security / UX / Authentication
- **Description:** Login UI that accepts ambiguous identifiers (username vs email) or silently rewrites credentials can confuse enterprise users and hide incorrect sign-in attempts.
- **Impact:** Support friction, mistaken lockouts, or accidental reliance on undocumented alias behavior in production.
- **Likelihood:** Low after UX-003 (email-only UI aligned to backend contract).
- **Current Mitigation:**
  - Backend login is email-only (`LoginDto.email`, Prisma lookup by `User.email`).
  - Web login validates work email format before submit and sends trimmed email to API.
  - Silent `@maintainpro.local` alias removed from default production behavior.
  - Optional dev alias requires explicit `NEXT_PUBLIC_LOGIN_DEV_LOCAL_ALIAS=true`.
- **Residual Risk:** Future login changes must preserve email-only contract unless backend adds real username support.
- **Owner:** Web Platform + API/Auth
- **Review Cadence:** Every auth UI/API contract change.

### RISK-UX-002-AUTH-UI-REGRESSION
- **Category:** Security / UX / Authentication
- **Description:** Auth UI refactors can accidentally reintroduce public sign-up links, demo credentials, or break cookie/CSRF login compatibility.
- **Impact:** Unauthorized account creation exposure, credential leakage perception, or login/session failures.
- **Likelihood:** Low-Medium during ongoing Phase 2 auth UX work.
- **Current Mitigation:**
  - Login page rebuilt without public sign-up link and with invitation-only guidance.
  - Existing login API contract preserved (`email` + password; work email validation on web).
  - SEC-010 cookie/CSRF refresh flow untouched in API client/auth storage.
  - Playwright auth e2e selectors updated for new login copy/button text.
- **Residual Risk:** Future login/register UX edits must preserve invitation-only posture and cookie-based refresh behavior.
- **Owner:** Web Platform + API/Auth
- **Review Cadence:** Every auth UI release and before production deploy.

### RISK-UX-004-ROLE-LANDING-MISROUTING
- **Category:** UX / Security / Authorization Clarity
- **Description:** Incorrect post-login landing routes can send users to the wrong module and create confusion about frontend vs backend authorization boundaries.
- **Impact:** Poor first-login UX, support friction, and mistaken assumptions that landing page access implies full module permissions.
- **Likelihood:** Low-Medium while role-specific routes are still being built.
- **Current Mitigation:**
  - Centralized role redirect helper with explicit route availability checks and `/dashboard` fallback.
  - Login/register success no longer hardcodes legacy `/home`.
  - Unit tests for role mapping/fallback and e2e checks for admin/technician landing paths.
  - QA checklist documents per-role landing expectations.
- **Residual Risk:** New roles/routes must update the centralized map; backend RBAC remains mandatory for actual access control.
- **Owner:** Web Platform
- **Review Cadence:** Every auth/navigation release and when new role landing pages are added.

### RISK-UX-005-LEGACY-HOME-CONFUSION
- **Category:** UX / Product Clarity
- **Description:** Users may still discover archived `/home` (legacy FMS) via bookmarks, old links, or legacy module navigation and mistake it for the primary product dashboard.
- **Impact:** Operational confusion, duplicated workflows, and reduced trust in platform navigation.
- **Likelihood:** Low-Medium while legacy module remains accessible.
- **Current Mitigation:**
  - `/home` no longer used for login/register/splash/maintenance default redirects.
  - Legacy page, FMS layout, and maintenance shell clearly label archive/read-only status.
  - Prominent CTA links from legacy surfaces to `/dashboard`.
  - QA checklist covers non-`/home` post-login routing and legacy labelling.
- **Residual Risk:** Legacy module routes (`/machinery`, `/service`, etc.) remain until a later archival/removal decision.
- **Owner:** Web Platform
- **Review Cadence:** When legacy FMS module is retired or further isolated.

### RISK-UX-006-NAV-VS-AUTHORIZATION
- **Category:** UX / Security / Authorization Clarity
- **Description:** Role-aware navigation visibility may be mistaken for backend authorization; users may assume hidden modules are inaccessible server-side or that visible modules grant full permissions.
- **Impact:** Support confusion, attempted unauthorized actions, or false confidence in access controls.
- **Likelihood:** Medium while frontend RBAC UX evolves ahead of complete route coverage.
- **Current Mitigation:**
  - Navigation config documented as frontend UX only; backend RBAC remains authoritative.
  - Unknown/missing roles fall back to minimal Dashboard-only navigation.
  - Legacy `/home` is not exposed as primary Home; archived label used when shown to admins.
  - Unit tests for role-to-nav mapping, active route matching, and no primary `/home` nav.
  - QA checklist covers per-role nav visibility and logout behavior.
- **Residual Risk:** New routes/roles must update centralized nav config; direct URL access must remain server-enforced.
- **Owner:** Web Platform
- **Review Cadence:** Every navigation release and when new modules/roles are added.

### RISK-UX-011-ERROR-DISPLAY-BALANCE
- **Category:** UX / Security / Supportability
- **Description:** Over-sanitized error states can hide actionable failures; under-sanitized states can expose tokens, stack traces, or internal infrastructure details.
- **Impact:** Harder incident diagnosis, user confusion, or accidental disclosure of sensitive implementation details.
- **Likelihood:** Low-Medium while pages migrate to shared state components.
- **Current Mitigation:**
  - Shared `toSafeDisplayMessage` / `toSafeApiErrorMessage` helpers filter unsafe patterns and length.
  - Error states use generic fallbacks for technical failures while preserving safe API messages.
  - Retry actions retained on existing refetch flows.
  - QA checklist covers safe messaging and no raw technical leakage.
- **Residual Risk:** New pages must adopt shared helpers; server logs remain the source of truth for detailed diagnostics.
- **Owner:** Web Platform
- **Review Cadence:** When adding new data-fetching pages or changing error handling.

### RISK-UX-009-TABLE-REFACTOR-REGRESSION
- **Category:** UX / Regression
- **Description:** Shared DataTable rollout may hide row actions, break selection, or display mismatched columns on mobile card fallback.
- **Impact:** Users unable to complete workflows (approve PO, assign technician, stock in/out, change asset status) from list views.
- **Likelihood:** Low-Medium during incremental rollout.
- **Current Mitigation:**
  - Rolled out to Work Orders, Inventory, Procurement, and Assets (UX-009B partial migration).
  - Assets: column picker filters columns before DataTable render; server pagination kept outside DataTable; row actions/status prompts preserved in `AssetRowActions`; selection via leading checkboxes.
  - Existing row actions and callbacks preserved; no API/query changes.
  - Mobile card fallback renders same cell content and action slots.
  - Unit tests for client-table helpers and assets column visibility helper; QA checklist for row actions and pagination.
- **Residual Risk:** Other legacy tables remain on old patterns until follow-up rollout; Assets row motion animations simplified (no framer-motion table rows).
- **Owner:** Web Platform
- **Review Cadence:** Before each additional table migration.

### RISK-UX-009B-ASSETS-TABLE-REGRESSION
- **Category:** UX / Regression
- **Description:** Assets table migration is high-complexity (column picker, inline status prompts, bulk selection, custom pagination). Regression may break status changes, QR actions, or bulk workflows.
- **Impact:** Asset registry workflows blocked or data actions misfire (wrong status, failed bulk export/delete).
- **Likelihood:** Low-Medium immediately after migration; monitor first production use.
- **Current Mitigation:**
  - Scoped change to list UI only (`assets-table.tsx` + page wiring); no backend/API changes.
  - Preserved column picker, filters, server-side pagination footer, bulk bar, row menu actions, disposal reason validation.
  - Added list-level LoadingState/ErrorState (UX-011); empty state via shared EmptyState.
  - `assets-table.spec.ts` covers column visibility helper; QA checklist section 2e for manual Assets table verification.
- **Residual Risk:** Inline status prompt inside mobile bottom sheet may require scroll on very small screens; manual device QA recommended.
- **Owner:** Web Platform
- **Review Cadence:** After first manual QA pass on Assets desktop + mobile.

### RISK-UX-010-DIALOG-REGRESSION
- **Category:** UX / Safety / Regression
- **Description:** Replacing browser-native dialogs with custom components may accidentally skip confirmations, allow double-submit, or change cancel semantics on destructive flows.
- **Impact:** Accidental data loss (delete vehicle/work order), unintended deactivations, or users proceeding without required input (rejection reason).
- **Likelihood:** Low-Medium during dialog rollout and future feature work.
- **Current Mitigation:**
  - Reusable `ConfirmDialog` / `PromptDialog` with destructive variant, loading state, and keyboard/backdrop handling.
  - `useConfirmDialog` / `usePromptDialog` hooks preserve async confirm-before-action pattern.
  - Destructive actions retain explicit confirmation; prompt flows validate required fields.
  - Regression test greps high-impact paths for native dialog usage; `validatePromptInput` unit tests.
  - QA checklist covers cancel/confirm behavior and mobile/keyboard usability.
- **Residual Risk:**
  - Legacy SCHEDULE_TASK cancel still schedules without due date (preserved from `window.prompt` behavior); consider UX fix in follow-up.
  - Pages outside high-impact audit may still use native dialogs until migrated.
- **Owner:** Web Platform
- **Review Cadence:** When adding new destructive actions or inline input flows.

### RISK-UX-007-BREADCRUMB-ROUTE-MISMATCH
- **Category:** UX / Navigation
- **Description:** Breadcrumb labels or parent links may not match actual routes after refactors, or unmigrated pages may lack breadcrumbs entirely.
- **Impact:** User confusion, broken navigation links, or misleading location context.
- **Likelihood:** Low-Medium as new routes are added without updating `lib/breadcrumbs.ts`.
- **Current Mitigation:**
  - Centralized route helper with explicit patterns for high-impact pages.
  - `PageBreadcrumbs` supports per-page `items` overrides when entity labels are already loaded.
  - Legacy `/home` labeled “Legacy FMS Archive” only; dashboard uses `/dashboard`.
  - Unit tests for known route mappings; QA checklist for link/current-page behavior.
- **Residual Risk:** Modal-only detail flows (work orders, assets) have no deep-route crumbs until dedicated routes exist.
- **Owner:** Web Platform
- **Review Cadence:** When adding or renaming dashboard routes.

### RISK-UX-012-MOBILE-LAYOUT-REGRESSION
- **Category:** UX / Mobile / Regression
- **Description:** Responsive polish may still miss edge cases on unmigrated pages, fixed-position menus, or legacy tables without mobile card fallbacks.
- **Impact:** Horizontal overflow, clipped actions, or hard-to-tap controls on phones/tablets.
- **Likelihood:** Low-Medium on legacy routes; Low on modernized DataTable/auth/shell surfaces after UX-012.
- **Current Mitigation:**
  - Shared DataTable mobile card improvements (wrap, overflow-visible actions, touch-leading cells).
  - Assets mobile row menu uses bottom sheet + backdrop; auth/nav/dialog touch targets standardized to min 44px where updated.
  - Root viewport + PWA metadata centralized in `lib/pwa-metadata.ts`; `mobile-pwa.spec.ts` guards branding/helpers.
  - QA checklist section 2i covers login, drawer, breadcrumbs, DataTable pages, dialogs, and PWA metadata.
- **Residual Risk:** Cleaning/farm/utilities and other legacy table pages may still scroll horizontally; iOS safe-area overlap on bottom sheets not fully tested.
- **Owner:** Web Platform
- **Review Cadence:** Before release QA on real devices (375px–430px) and after migrating additional tables.

### RISK-UX-013-A11Y-REGRESSION
- **Category:** UX / Accessibility / Compliance
- **Description:** Incremental ARIA/focus/semantics changes may regress keyboard flows, screen reader announcements, or visible focus indicators on unmigrated pages.
- **Impact:** Users relying on assistive tech cannot complete auth, navigation, or high-impact table/dialog workflows; potential WCAG compliance gaps.
- **Likelihood:** Low-Medium on legacy routes; Low on updated core components after UX-013.
- **Current Mitigation:**
  - Centralized helpers in `lib/accessibility.ts` with unit tests (`accessibility.spec.ts`).
  - Core shell/auth/nav/breadcrumb/DataTable/dialog/page-state updates only; no business logic changes.
  - QA checklist section 2j for keyboard, screen reader, and focus-visible verification.
  - Existing mobile/PWA/dialog tests retained.
- **Residual Risk:** No automated axe/Lighthouse gate yet; legacy module pages and modal-only flows not fully audited; focus trap not implemented in drawer.
- **Owner:** Web Platform
- **Review Cadence:** When adding new interactive components or migrating additional pages.

### RISK-UX-008-COMMAND-PALETTE-VISIBILITY
- **Category:** UX / Navigation / Authorization
- **Description:** Command palette visibility is derived from frontend navigation config; drift from backend RBAC or incomplete nav registration could show/hide wrong routes or imply access the user lacks.
- **Impact:** Users attempt unavailable pages (403/errors) or miss allowed modules; false sense of access if palette shows routes backend denies.
- **Likelihood:** Low-Medium when new routes/modules ship without updating `navigation.ts`.
- **Current Mitigation:**
  - Commands built exclusively from `getVisibleNavigationItems()` + `EXISTING_NAV_ROUTES` (same as UX-006 sidebar).
  - Navigation-only actions; no mutations/destructive commands in palette.
  - Dashboard command uses `/dashboard`; `/home` only as labeled Legacy FMS Archive when nav exposes it.
  - Unit tests (`command-palette.spec.ts`) verify role filtering, search, route alignment, and dashboard/legacy separation.
  - QA checklist section 2k for keyboard, role visibility, and navigation behavior.
- **Residual Risk:** Backend remains authoritative; palette is UX convenience only. Entity search and cross-module actions not included.
- **Owner:** Web Platform
- **Review Cadence:** When adding routes, roles, or nav items.
