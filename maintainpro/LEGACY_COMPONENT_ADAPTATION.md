# Legacy Component Adaptation (Nelna -> MaintainPro)

Source reviewed: https://github.com/jkchinthaka/Nelna_maintance_app.git

## Review Scope

- Legacy backend (Node/Express): reviewed module separation, validator strategy, service boundaries, and notification workflow patterns.
- Legacy backend-python (FastAPI): reviewed inventory and prediction route structure as candidate reference for future `predictive-ai` enhancements.
- Legacy frontend (Flutter): reviewed auth flow, network client, environment config, and reusable UI component patterns.
- Legacy infrastructure: reviewed compose and deployment scripts for operational parity checks.

## Reused and Adapted in This Update

### 1) Mobile auth state architecture (Riverpod)
- Adapted legacy provider-driven auth state lifecycle (`AuthInitial`, `AuthLoading`, `AuthAuthenticated`, `AuthUnauthenticated`, `AuthError`).
- Added session restore on app start, login, refresh fallback, and logout handling.
- Current file: `apps/mobile/lib/features/auth/presentation/providers/auth_provider.dart`

### 2) Mobile auth API datasource pattern
- Reused legacy remote datasource pattern for handling auth endpoints and response envelopes.
- Updated endpoints to current NestJS API contract (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`).
- Current file: `apps/mobile/lib/features/auth/data/datasources/auth_remote_datasource.dart`

### 3) Token refresh and retry interceptor
- Adapted legacy Dio refresh-token retry strategy into the current `dioProvider`.
- Prevents immediate session drop on 401 by attempting refresh and replaying the failed request.
- Current file: `apps/mobile/lib/core/network/dio_client.dart`

### 4) Environment-aware mobile API base URL
- Reused legacy environment pattern concept and simplified it for MaintainPro.
- Added Android emulator-safe host fallback (`10.0.2.2`) when `MAINTAINPRO_API_URL` is not provided.
- Current file: `apps/mobile/lib/core/config/app_config.dart`

### 5) API response-to-model mapping for user role compatibility
- Added role mapping from API values (`SUPER_ADMIN`, `ADMIN`, etc.) to mobile enum values.
- Added JSON parsing/serialization in user model.
- Current file: `apps/mobile/lib/shared/models/app_user.dart`

### 6) UI bootstrap and auth-gated navigation
- App now uses an auth gate that restores session and routes to dashboard/login accordingly.
- Login screen now calls real backend auth instead of demo role selection.
- Dashboard/Profile now consume authenticated user details and include logout.
- Current files:
  - `apps/mobile/lib/main.dart`
  - `apps/mobile/lib/features/auth/presentation/login_screen.dart`
  - `apps/mobile/lib/features/dashboard/presentation/dashboard_screen.dart`
  - `apps/mobile/lib/features/profile/presentation/profile_screen.dart`

## Recommended Next Reuse Candidates (Not Yet Implemented)

1. Legacy feature-level clean architecture split (`data/domain/presentation`) for dashboard and inventory modules.
2. Legacy reusable widgets (status badge, KPI card, loading/error wrappers) adapted to MaintainPro design tokens.
3. Legacy auth local cache strategy for storing serialized user profile for offline startup.
4. Legacy backend validator patterns converted to Nest DTO + class-validator conventions for stricter request shape enforcement.
5. Legacy inventory business-rule checks (e.g., stock movement constraints) consolidated into dedicated policy utilities shared by API + mobile offline queue sync.
6. Legacy notification-channel preference model persisted in database (instead of in-memory) to align with enterprise multi-device behavior.
7. Legacy reporting aggregation structure mapped into precomputed/materialized report jobs for better performance on large datasets.

## Validation

- Flutter static analysis completed successfully after adaptation.
- Command run: `flutter analyze` in `apps/mobile`
- Result: `No issues found!`
