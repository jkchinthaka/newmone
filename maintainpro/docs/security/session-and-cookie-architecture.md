# Session and Cookie Architecture

## Target architecture

```text
Browser (frontend origin)
  → Next.js BFF `/api/backend/*` (same origin, credentials)
    → NestJS API (server-to-server)
```

## Cookies (frontend origin)

| Cookie | HttpOnly | Purpose |
|--------|----------|---------|
| `maintainpro_access` | yes | Short-lived access JWT |
| `maintainpro_refresh` | yes | Refresh JWT (rotated) |
| `maintainpro_csrf` | no | Double-submit CSRF token |

Cookies use `Secure` in production, `SameSite=Lax`, `Path=/`.

## Browser storage

- **Forbidden:** access JWT, refresh JWT in `localStorage` / `sessionStorage`.
- **Allowed:** non-secret user display profile, UI prefs, preferred tenant id (must be revalidated).

## Refresh

1. API returns 401 on protected route.
2. Client runs a **single** in-flight `POST /api/backend/auth/refresh` (shared promise).
3. BFF reads HttpOnly refresh cookie, validates CSRF, calls Nest, rotates cookies.
4. Original request retries once.
5. Refresh failure → clear client profile and redirect to login.

## Refresh-token family

`RefreshToken.familyId` groups rotations. Reuse of a revoked token revokes the entire family.