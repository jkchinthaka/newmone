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

### RISK-UX-014-LOCALIZATION-DRIFT
- **Category:** UX / Locale / Data Presentation
- **Description:** Date, time, currency, and number formatting remains partially hardcoded across unmigrated pages (`en-US`, `USD`, `$`, browser-default `Intl`) while rolled-out modules use centralized `en-LK` / `Asia/Colombo` / `LKR` helpers.
- **Impact:** Users see inconsistent amounts and timestamps across modules; finance/reporting views may imply wrong currency; timezone confusion for operational dates.
- **Likelihood:** Medium until remaining high-traffic pages migrate to `lib/localization.ts`.
- **Current Mitigation:**
  - Shared helpers in `apps/web/lib/localization.ts` with safe fallbacks and unit tests (`localization.spec.ts`).
  - Controlled rollout to inventory, work orders, assets, procurement, reports summary formatting, and dashboard fleet costs.
  - English UI default preserved; `ui-copy.ts` documents future Sinhala/Tamil approach without changing API payloads.
  - QA checklist section 2l for LKR/date/fallback verification.
- **Residual Risk:** Farm, vehicles, fuel, predictive-ai, and legacy FMS pages still use ad hoc formatting; full translation not started.
- **Owner:** Web Platform
- **Review Cadence:** When touching date/currency display in any module; migrate to shared helpers before adding new formatted fields.

### RISK-DASH-001-DASHBOARD-ROLE-DRIFT
- **Category:** UX / Dashboard / Authorization
- **Description:** Dashboard section visibility is derived from frontend role grouping (`dashboard-roles.ts`); drift from backend RBAC or incomplete role mapping could show/hide wrong panels or imply access the user lacks.
- **Impact:** Users see irrelevant panels, attempt unavailable modules (403/errors), or miss useful summaries; stale metrics if APIs fail silently.
- **Likelihood:** Low-Medium when new roles ship without updating dashboard grouping.
- **Current Mitigation:**
  - Pure role grouping helpers with unit tests (`dashboard-roles.spec.ts`).
  - Admin-only driver intelligence and system health panels; viewer/minimal read-only paths.
  - Safe empty states when aggregate APIs do not exist (cleaner/driver); no fake metrics.
  - UX-011 loading/error states on each data panel with retry.
  - QA checklist section 2m for per-role manual verification.
- **Residual Risk:** Backend remains authoritative; technician assignment filter depends on user id alignment; admin dashboard may trigger multiple existing API calls.
- **Owner:** Web Platform
- **Review Cadence:** When adding roles, dashboard modules, or new summary APIs.

### RISK-ADMIN-001-ADMIN-VISIBILITY-DRIFT
- **Category:** UX / Admin / Authorization
- **Description:** `/admin` visibility is controlled by frontend role checks and navigation config; backend RBAC on settings/users/roles/tenant APIs remains the real authorization boundary.
- **Impact:** Non-admins could see admin nav if role config drifts; admins may see console cards for modules backend denies; users may assume frontend gating equals security.
- **Likelihood:** Low-Medium when roles/nav change without updating `admin-console.ts` and navigation tests.
- **Current Mitigation:**
  - `isAdminConsoleRole()` + `PermissionState` on `/admin` for non-admin access attempts.
  - Nav/command palette visibility limited to ADMIN/SUPER_ADMIN via existing `getVisibleNavigationItems()`.
  - Read-only cards only; no user/tenant/RBAC mutation actions added in admin console.
  - No fake user/tenant counts; tenants card explicitly marked requires API.
  - Unit tests (`admin-console.spec.ts`) for role visibility and safe section definitions.
  - QA checklist section 2n for manual admin visibility verification.
- **Residual Risk:** Settings page still exposes mutating admin flows outside dedicated admin console; dedicated tenant admin API not built.
- **Owner:** Web Platform
- **Review Cadence:** When adding admin modules, roles, or backend admin endpoints.

### RISK-ADMIN-002A-USER-DATA-EXPOSURE
- **Category:** Security / Admin / Privacy
- **Description:** Admin user review surfaces identity and access metadata; drift in DTO sanitization or tenant scoping could expose sensitive auth fields or cross-tenant user records.
- **Impact:** Password/token leakage, unauthorized visibility of users in other tenants, compliance/privacy violations.
- **Likelihood:** Low if sanitized endpoint and tests remain aligned; Medium if `/users` public responses are reused without review.
- **Current Mitigation:**
  - Dedicated read-only `GET /admin/users` with `@Roles(ADMIN, SUPER_ADMIN)` backend guard.
  - `findAllForAdminAccessView()` returns explicit sanitized DTO; strips passwordHash and omits failedLoginAttempts/lockedUntil.
  - ADMIN tenant membership filter; SUPER_ADMIN cross-tenant behavior documented in UI.
  - Frontend table field allowlist excludes sensitive columns; tests in `admin-users-access.spec.ts` and `admin-users.spec.ts`.
  - QA checklist section 2o for manual verification.
- **Residual Risk:** Legacy `GET /users` now uses `PublicUserResponse` allowlist (ADMIN-002C); Settings mutations remain outside admin console.
- **Owner:** Web Platform + API
- **Review Cadence:** When extending admin user views or changing User model/API responses.

### RISK-ADMIN-002B-STATUS-MUTATION-MISUSE
- **Category:** Security / Admin / Authorization
- **Description:** Admin user status mutation (`PATCH /admin/users/:id/status`) could be misused to lock out tenants, super admins, or cross-tenant users if RBAC, tenant scoping, or protection rules drift from the sanitized DTO contract.
- **Impact:** Unauthorized account lockout, tenant admin denial-of-service, privilege escalation attempts, or exposure of sensitive user fields if response sanitization regresses.
- **Likelihood:** Low with current guards/tests; Medium if settings `/users/:id/status` and admin endpoint diverge or frontend-only checks replace backend enforcement.
- **Current Mitigation:**
  - Dedicated admin status endpoint with `@Roles(ADMIN, SUPER_ADMIN)` and shared `applyProtectedUserStatusUpdate()` protection rules (self-deactivation block, ADMIN vs SUPER_ADMIN block, last active SUPER_ADMIN block, tenant membership scope for ADMIN).
  - Legacy `PATCH /users/:id/status` reuses the same shared mutation protections (ADMIN-002C).
  - Returns sanitized `AdminUserAccessRow` / `PublicUserResponse` only; no password/token/internal auth fields.
  - Frontend action visibility via `canShowAdminUserStatusAction()` is UX-only; ConfirmDialog required for admin mutations.
  - Tests in `admin-users-status.spec.ts`, `users-legacy-hardening.spec.ts`, and related admin-users specs.
  - QA checklist sections 2p and 2q for manual verification.
- **Residual Risk:** Settings page still exposes invite/delete/role/password flows outside admin console scope.
- **Owner:** Web Platform + API
- **Review Cadence:** When adding admin user mutations, changing User model status fields, or altering admin DTO allowlists.

### RISK-ADMIN-002C-LEGACY-USER-DTO-DRIFT
- **Category:** Security / Admin / Privacy
- **Description:** Legacy `GET /users` and `PATCH /users/:id/status` could drift from admin hardened paths, re-exposing internal auth fields or weaker status mutation rules.
- **Impact:** Sensitive field leakage, inconsistent lockout protections, unauthorized cross-tenant or super-admin status changes via Settings.
- **Likelihood:** Low after shared `applyProtectedUserStatusUpdate()` and `PublicUserResponse` allowlist; Medium if future endpoints revert to raw Prisma spreads.
- **Current Mitigation:**
  - `PublicUserResponse` explicit allowlist on all legacy user read/write responses from `UsersService`.
  - Shared status mutation protections for admin and legacy endpoints.
  - Tests in `users-legacy-hardening.spec.ts` plus existing admin-users tests.
  - QA checklist section 2q.
- **Residual Risk:** Settings retains broader permission-based status access (`users.status.manage`) and other mutating flows (invite/delete/roles) outside admin console.
- **Owner:** API + Web Platform
- **Review Cadence:** When changing UsersService mappers, user Prisma selects, or Settings user management.

### RISK-ADMIN-003A-TENANT-DATA-EXPOSURE
- **Category:** Security / Admin / Privacy
- **Description:** Admin tenant review surfaces organization metadata; drift in DTO sanitization, Prisma selects, or tenant scoping could expose secrets, cross-tenant records, or billing/integration config.
- **Impact:** Credential leakage, unauthorized cross-tenant visibility, compliance/privacy violations.
- **Likelihood:** Low with explicit `AdminTenantOverviewRow` allowlist and scoped queries; Medium if admin endpoints begin loading subscription/stripe/env relations without review.
- **Current Mitigation:**
  - Dedicated read-only `GET /admin/tenants` with `@Roles(ADMIN, SUPER_ADMIN)`.
  - `findAllForAdminTenantReview()` returns explicit sanitized DTO; Prisma select limited to safe tenant fields + membership count.
  - ADMIN filtered to own `tenantId`; SUPER_ADMIN cross-tenant behavior documented in UI.
  - Tests in `admin-tenants-access.spec.ts` and `admin-tenants.spec.ts`; QA checklist section 2r.
- **Residual Risk:** Session tenant switch (`POST /tenants/:id/switch`) and `/tenants/me` remain outside admin workspace; tenant mutation/invitation flows still deferred.
- **Owner:** Web Platform + API
- **Review Cadence:** When extending admin tenant views, adding tenant mutations, or changing Tenant model/API responses.

### RISK-ADMIN-004A-RBAC-VISIBILITY-DRIFT
- **Category:** Security / Admin / Authorization
- **Description:** Admin roles/permissions matrix exposes RBAC structure; drift in DTO sanitization, tenant scoping, or future mutation endpoints could leak user assignments, secrets, or enable unauthorized role changes.
- **Impact:** Unauthorized visibility of access patterns, accidental exposure of internal auth data, future mutation misuse if read-only guards regress.
- **Likelihood:** Low with sanitized matrix endpoint and tests; Medium if legacy `/roles` responses are reused without review or admin mutation endpoints are added without protection.
- **Current Mitigation:**
  - Dedicated read-only `GET /admin/roles-permissions` with `@Roles(ADMIN, SUPER_ADMIN)`.
  - Explicit matrix DTO; permissions global, roles tenant-scoped for ADMIN.
  - Legacy `GET /roles` and `GET /roles/permissions` now use `PublicRoleResponse` / `PublicPermissionResponse` allowlists (ADMIN-004B).
  - Frontend matrix is read-only (`adminRolesMatrixAllowsMutations()` false); no assignment/edit controls.
  - Tests in `admin-roles-access.spec.ts`, `admin-roles.spec.ts`, and `roles-legacy-hardening.spec.ts`; QA checklist sections 2s and 2t.
- **Residual Risk:** Settings `/roles` mutation APIs remain active; user-role assignment and invitation flows still deferred.
- **Owner:** Web Platform + API
- **Review Cadence:** When adding role/permission mutations, changing seed/RBAC model, or extending admin matrix scope.

### RISK-ADMIN-004B-LEGACY-ROLE-DTO-DRIFT
- **Category:** Security / Admin / Authorization
- **Description:** Legacy `/roles` read endpoints could drift from admin matrix DTOs or re-expose raw Prisma relation payloads (`roleIds`, `permissionIds`, user lists).
- **Impact:** Internal RBAC structure leakage, inconsistent frontend expectations, future exposure of sensitive metadata if raw objects return.
- **Likelihood:** Low after `PublicRoleResponse` / `PublicPermissionResponse` mappers and tests; Medium if mutation handlers revert to `include: { permissions: true }` without review.
- **Current Mitigation:**
  - Explicit allowlist mappers in `RolesService` with Prisma field `select` limits.
  - Settings-compatible permission summaries nested under roles.
  - Tests in `roles-legacy-hardening.spec.ts`; QA checklist section 2t.
- **Residual Risk:** Settings mutation endpoints still accept permission/role changes outside admin console read-only views.
- **Owner:** API + Web Platform
- **Review Cadence:** When changing RolesService responses, Settings RBAC UI, or admin matrix DTOs.

### RISK-ADMIN-003B-INVITATION-TOKEN-EXPOSURE
- **Category:** Security / Admin / Privacy
- **Description:** Tenant invitation records contain sensitive tokens; drift in admin or legacy invitation list endpoints could expose tokens, invitation links, or provider secrets.
- **Impact:** Unauthorized account onboarding, token replay, privacy/compliance violations.
- **Likelihood:** Low for list/review endpoints and hardened create DTOs with explicit tests; Medium if create handlers revert to spreading raw Prisma invitation rows.
- **Current Mitigation:**
  - Dedicated read-only `GET /admin/invitations` with `@Roles(ADMIN, SUPER_ADMIN)` and token-free `AdminInvitationReviewRow` DTO.
  - Legacy list endpoint uses `PublicTenantInvitationResponse` allowlist via `toPublicTenantInvitationResponse()` with Prisma `select` excluding token.
  - Create responses use `CreateTenantInvitationResponse` with `invitationLink` only (no separate token field) for `POST /admin/invitations` and `POST /tenants/:id/invitations`.
  - Admin create UI shows one-time copy panel only; links are not persisted client-side or listed in review tables.
  - Tests in `admin-invitations-access.spec.ts`, `admin-invitations.spec.ts`, `admin-invitations-create.spec.ts`, and `invitations-legacy-hardening.spec.ts`; QA checklist sections 2u–2w.
- **Residual Risk:** Invitation links still grant onboarding access if leaked; email/SMS dispatch and resend/revoke flows remain deferred.
- **Owner:** Web Platform + API
- **Review Cadence:** When adding invitation mutations, email dispatch, or changing TenantInvitation model/API responses.

### RISK-ADMIN-003C-LEGACY-INVITATION-DTO-DRIFT
- **Category:** Security / Admin / Privacy
- **Description:** Legacy tenant invitation list responses could drift from admin review DTOs or re-expose raw Prisma payloads including tokens.
- **Impact:** Token leakage via list/review endpoints, inconsistent frontend expectations, onboarding security regressions.
- **Likelihood:** Low after `PublicTenantInvitationResponse` mapper and tests; Medium if list handlers revert to `include` without review.
- **Current Mitigation:**
  - Explicit allowlist mapper in `InvitationsService.listInvitations()` with Prisma field `select` limits.
  - Shared field naming aligned with admin review rows (invitee/inviter display names, ISO dates).
  - Tests in `invitations-legacy-hardening.spec.ts`; QA checklist section 2v.
- **Residual Risk:** Create responses include one-time `invitationLink`; list/review endpoints remain link-free. Resend/revoke and email dispatch deferred.
- **Owner:** Web Platform + API
### RISK-ADMIN-003D-INVITATION-LINK-HANDLING
- **Category:** Security / Admin / Privacy
- **Description:** One-time invitation links grant onboarding access; unsafe UI persistence, logging, or list exposure could leak links after creation.
- **Impact:** Unauthorized tenant onboarding if links are copied, stored, or shared beyond the intended recipient.
- **Likelihood:** Low after one-time panel UX and token-free create DTO tests; Medium if future UI stores links or adds email without secure delivery review.
- **Current Mitigation:**
  - Create DTO returns `invitationLink` without separate raw token fields.
  - Admin UI shows copy panel only after create with explicit warning; no localStorage/sessionStorage persistence; review table excludes links.
  - Tests in `admin-invitations-create.spec.ts` and updated frontend helper specs; QA checklist section 2w.
- **Residual Risk:** Email/SMS provider integration not implemented; operators must manually share links securely.
- **Owner:** Web Platform + API
- **Review Cadence:** When adding email dispatch, resend flows, or changing invitation link UX.

### RISK-BUILD-001-FACILITY-SCOPE-CREEP
- **Category:** Product / Architecture
- **Description:** Building/facility module could duplicate Work Orders, Assets, Cleaning, or Inventory instead of extending them.
- **Impact:** Maintenance burden, inconsistent workflows, tenant data fragmentation, delayed Nelna rollout.
- **Likelihood:** Medium without enforced BUILD-001 plan boundaries; Low if BUILD-002+ follows documented reuse decisions.
- **Current Mitigation:**
  - `docs/BUILDING_FACILITY_MODULE_PLAN.md` defines MVP, out-of-scope items, reuse matrix, and phased rollout.
  - FAC-* backlog mapped to BUILD-002 through BUILD-008 implementation order.
- **Residual Risk:** Stakeholder requests for BIM/IoT/public portal may pressure MVP scope before core hierarchy lands.
- **Owner:** Product + Platform Architecture
- **Review Cadence:** Before each BUILD/FAC implementation task.

### RISK-BUILD-001-FACILITY-TENANT-ISOLATION
- **Category:** Security / Multi-tenancy
- **Description:** New facility hierarchy and issue endpoints could leak cross-tenant building/room/issue data if guards or query filters drift.
- **Impact:** Privacy violations, unauthorized facility access, compliance failures.
- **Likelihood:** Medium during new module introduction; Low after tenant isolation test suite per endpoint.
- **Current Mitigation:**
  - Plan mandates `tenantId` on all proposed models and TenantContextGuard on mutations/lists.
  - Reuse existing tenancy test patterns from SEC-006 and admin module specs.
- **Residual Risk:** Public repair portal (BUILD-008) introduces new unauthenticated intake surface.
- **Owner:** API Platform
- **Review Cadence:** At BUILD-002 schema review and each new facility endpoint.

### RISK-BUILD-001-FACILITY-ATTACHMENT-STORAGE
- **Category:** Security / Operations
- **Description:** Facility issue photos and documents depend on optional Cloudinary/MinIO integrations; misconfiguration could expose blobs or fail silently.
- **Impact:** Data loss, unauthorized media access, incomplete repair evidence.
- **Likelihood:** Medium when photo volume grows; Low if existing asset/cleaning attachment patterns are reused.
- **Current Mitigation:**
  - Reuse existing optional storage env-gating and attachment URL patterns from assets/cleaning modules.
  - Plan documents signed/expiring URL requirement for object storage.
- **Residual Risk:** No dedicated facility attachment retention policy yet.
- **Owner:** API + DevOps
- **Review Cadence:** At BUILD-004 issue API implementation.

### RISK-BUILD-001-FACILITY-ERP-INVENTORY-GAP
- **Category:** Integration / Operations
- **Description:** Facility repairs may need parts/procurement flows that are WO-linked today; ERP sync gaps could block cost tracking for building maintenance.
- **Impact:** Manual reconciliation, incomplete cost reports, procurement delays for facility WOs.
- **Likelihood:** Medium for Nelna if facility WOs scale before inventory maturity (INV-001+).
- **Current Mitigation:**
  - Plan routes facility repairs through existing WorkOrder → PartRequest/PartIssue → PO paths only.
  - ERP integration deferred; no new financial posting in MVP.
- **Residual Risk:** Facility cost reporting (FAC-010) depends on WO/inventory data quality.
- **Owner:** Operations + API
- **Review Cadence:** At BUILD-005 WO bridge and BUILD-007 reports.

### RISK-BUILD-001-FACILITY-ROLE-DRIFT
- **Category:** Security / RBAC
- **Description:** Frontend already references `FACILITY_MANAGER` and `BUILDING_SUPERVISOR` but Prisma `RoleName` and seed permissions do not include them; `/facility` routes are missing.
- **Impact:** Broken redirects, frontend-only access checks, authorization gaps when module ships.
- **Likelihood:** High until BUILD-002 aligns schema seed with web RBAC.
- **Current Mitigation:**
  - BUILD-001 documents required roles and permission keys; BUILD-002 scoped as next task.
  - Plan requires backend RolesGuard authority, not frontend-only gating.
- **Residual Risk:** Legacy role alias mapping (`COMPATIBLE_PERMISSION_ALIASES`) may need facility permission entries.
- **Owner:** Web Platform + API
- **Review Cadence:** At BUILD-002 role seed and BUILD-006 web route launch.

### RISK-BUILD-002-FACILITY-HIERARCHY-TENANT-ISOLATION
- **Category:** Security / Multi-tenancy
- **Description:** New Property/Building/Floor/Room models must remain tenant-scoped on every query path once APIs ship.
- **Impact:** Cross-tenant facility data exposure if `tenantId` filters are omitted in BUILD-003+ services.
- **Likelihood:** Low after direct `tenantId` fields and compound indexes; Medium during new module introduction.
- **Current Mitigation:**
  - All hierarchy models include required `tenantId` with cascade delete and tenant-scoped indexes.
  - BUILD-001/002 plan mandates tenant isolation tests per endpoint before UI rollout.
- **Residual Risk:** Parent/child FK validation across tenants must be enforced in service layer (BUILD-003).
- **Owner:** API Platform
- **Review Cadence:** At BUILD-003 hierarchy CRUD implementation.

### RISK-BUILD-002-FACILITY-MIGRATION-BACKFILL
- **Category:** Data / Migration
- **Description:** Existing `CleaningLocation.building`/`floor` strings and `FacilityIssue.locationId` must be migrated to Room FKs in later phases.
- **Impact:** Split location data, duplicate hierarchy entries, broken issue/location joins if migration is rushed.
- **Likelihood:** Medium when BUILD-004 links issues to rooms without backfill plan.
- **Current Mitigation:**
  - BUILD-002 adds parallel hierarchy only; no destructive migration in this pass.
  - Plan documents gradual `roomId` adoption on CleaningLocation and FacilityIssue.
- **Residual Risk:** Operators may create duplicate spatial records until migration tooling exists.
- **Owner:** Product + API
- **Review Cadence:** Before BUILD-004 issue extensions.

### RISK-BUILD-002-FACILITY-ROLE-PERMISSION-DRIFT
- **Category:** Security / RBAC
- **Description:** Frontend facility roles now align with Prisma enum, but permission guards and API endpoints do not consume new keys until BUILD-003+.
- **Impact:** Users with facility roles may appear authorized in UI before backend enforcement exists.
- **Likelihood:** Medium until facility module ships; Low after endpoint `@Permissions` wiring.
- **Current Mitigation:**
  - Conservative permission assignments in `facility-seed.constants.ts` with tests in `building-schema-seed.spec.ts`.
  - Seed verification requires FACILITY_MANAGER and BUILDING_SUPERVISOR roles.
- **Residual Risk:** `/facility` routes still missing; role redirects remain broken until BUILD-006.
- **Owner:** Web Platform + API
- **Review Cadence:** At BUILD-003 API RBAC and BUILD-006 route launch.

### RISK-SMART-OPS-001-SCOPE-CREEP
- **Category:** Delivery / Product
- **Description:** Smart operations features could expand into schema-heavy facility work or fake KPI dashboards, blocking BUILD-003+ and eroding trust.
- **Impact:** Delayed facility delivery, unstable releases, misleading operational signals.
- **Likelihood:** Medium without roadmap discipline; Low with SMART-OPS-001 boundaries.
- **Current Mitigation:**
  - Action Center uses existing APIs only; failed connections show “Not connected yet”.
  - Roadmap document defines deferred items and BUILD sequence ownership.
  - No schema changes in SMART-OPS-001 sprint.
- **Residual Risk:** Future Action Center widgets must follow same “real data or empty state” rule.
- **Owner:** Web Platform + Product
- **Review Cadence:** Each smart-ops enhancement.

### RISK-SMART-OPS-001-FAKE-METRICS
- **Category:** Product / Trust
- **Description:** Operational dashboards could display placeholder or invented counts when APIs are unavailable.
- **Impact:** Incorrect prioritization, audit failures, loss of user trust.
- **Likelihood:** Low (explicit empty states); Medium if future widgets bypass API validation.
- **Current Mitigation:**
  - Morning Briefing and Action Center derive counts from live fetches only.
  - QA checklist requires “no fake metrics” verification.
- **Residual Risk:** Scheduled digests (future) must reuse same data sources.
- **Owner:** Web Platform
- **Review Cadence:** Each dashboard/action-center change.

### RISK-SMART-OPS-001-QR-PAYLOAD-MISUSE
- **Category:** Security / Operations
- **Description:** QR payloads could be extended to carry auth tokens, invitation links, or PII if validation is bypassed.
- **Impact:** Credential leakage via printed labels; unauthorized access via scanned codes.
- **Likelihood:** Low with `qr-readiness.ts` forbidden-field checks; Medium if public routes encode secrets.
- **Current Mitigation:**
  - `createMaintainProQrPayload` / `parseMaintainProQrPayload` reject secret-like keys.
  - Automated tests in `qr-readiness.spec.ts`.
  - Public QR routes deferred to BUILD-005 with security review.
- **Residual Risk:** BUILD-005 must reuse helper and avoid embedding session tokens in URLs.
- **Owner:** Web Platform + Security
- **Review Cadence:** At BUILD-005 QR rollout.

### RISK-SMART-OPS-001-PUBLIC-REPAIR-INTAKE
- **Category:** Security / Abuse
- **Description:** Public repair request portals and unauthenticated QR intake can be spammed or used for tenant enumeration.
- **Impact:** Noise in issue queues, DoS, data quality degradation.
- **Likelihood:** N/A until portal ships; Medium when implemented without rate limits.
- **Current Mitigation:**
  - Public intake explicitly deferred; authenticated flows first per roadmap.
- **Residual Risk:** Requires CAPTCHA, rate limiting, and tenant routing review before launch.
- **Owner:** Product + Security
- **Review Cadence:** Before FAC-006 / BUILD-008 public portal.

### RISK-SMART-OPS-001-INVITATION-LINK-EXPOSURE
- **Category:** Security / Onboarding
- **Description:** Action Center admin invitation counts could tempt displaying raw invitation links/tokens in UI.
- **Impact:** Account takeover via leaked invitation links.
- **Likelihood:** Low (ADMIN-003B/D hardening); Medium if new admin widgets bypass DTO allowlists.
- **Current Mitigation:**
  - Action Center uses review list API with token-free DTO; counts only.
  - `ADMIN_INVITATION_SENSITIVE_FIELDS` documented in admin module.
- **Residual Risk:** Future “quick invite” widgets must not re-expose tokens in list views.
- **Owner:** Admin Platform
- **Review Cadence:** Each admin/onboarding UI change.

### RISK-SMART-OPS-001-FACILITY-SEQUENCE-OVERLAP
- **Category:** Delivery / Architecture
- **Description:** Smart ops work could duplicate BUILD-003+ facility hierarchy or issue bridge implementations.
- **Impact:** Merge conflicts, inconsistent data models, rework.
- **Likelihood:** Low with SMART-OPS-001 scope lock; Medium without roadmap adherence.
- **Current Mitigation:**
  - Facility module planned state in Action Center; no hierarchy CRUD added.
  - BUILD-002 schema foundation complete; BUILD-003 is next explicit task.
- **Residual Risk:** QR/issue features must integrate with BUILD-004/006 models, not parallel implementations.
- **Owner:** Product + API
- **Review Cadence:** At BUILD-003 kickoff.

### RISK-SMART-OPS-001-EXTERNAL-DEPENDENCY-GAPS
- **Category:** Operations / Integrations
- **Description:** Email/SMS/ERP dependencies remain unconfigured in production; Action Center cannot surface delivery guarantees.
- **Impact:** Operators assume notifications/ERP sync work when integrations are disabled.
- **Likelihood:** Medium in current deployment; Lower with system health visibility.
- **Current Mitigation:**
  - SEC-012/013 integration mode surfacing in system health (admin Action Center links there).
  - NOTIFY-001 and ERP-001 tracked explicitly in roadmap.
- **Residual Risk:** Production env setup still manual; Action Center does not replace integration configuration.
- **Owner:** DevOps + Platform
- **Review Cadence:** At NOTIFY-001 and ERP-001 implementation.
