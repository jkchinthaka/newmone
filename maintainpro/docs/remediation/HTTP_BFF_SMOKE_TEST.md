# HTTP BFF Smoke Test Specification

**Audience:** Operators validating an approved cleartext HTTP deployment  
**Transport warning:** HTTP does **not** encrypt credentials, does **not** protect sessions from network interception, and does **not** verify server identity. Prefer HTTPS. HTTP mode is an explicitly accepted operational risk.

**Placeholders only — never paste production secrets into this document.**

| Placeholder | Meaning |
| --- | --- |
| `<PUBLIC_HOST>` | Operator-approved public hostname or IP used in the browser |
| `<TEST_USER_EMAIL>` | Disposable test user email |
| `<TEST_USER_PASSWORD>` | Disposable test user password (not committed) |

**Prerequisites**

1. Dual cookie opt-in in server `.env` (HTTP compatibility only):
   - `ALLOW_INSECURE_HTTP=true`
   - `COOKIE_SECURE=false`
2. Public origins aligned:
   - `CORS_ORIGIN=http://<PUBLIC_HOST>`
   - `FRONTEND_URL=http://<PUBLIC_HOST>`
   - `NEXT_PUBLIC_API_ORIGIN=http://<PUBLIC_HOST>`
3. Web BFF upstream:
   - `API_INTERNAL_URL=http://api:3000/api`
   - `NEXT_PUBLIC_USE_BFF=true`
4. Disposable test user created offline (not a real admin password in tickets).

**Evidence rule:** Mark each test PASS/FAIL with date, operator initials, and redacted screenshot or curl output. Do not claim live validation in Git without attached evidence.

---

## HTTP-BFF-001 — Login page

```bash
curl -sS -o /dev/null -w "%{http_code}" "http://<PUBLIC_HOST>/login"
```

**Expected:** `200`

---

## HTTP-BFF-002 — Nest health via generic API route

```bash
curl -sS -o /dev/null -w "%{http_code}" "http://<PUBLIC_HOST>/api/health"
```

**Expected:** `200`

---

## HTTP-BFF-003 — Unauthenticated BFF me (must not 404)

```bash
curl -sS -o /dev/null -w "%{http_code}" "http://<PUBLIC_HOST>/api/backend/auth/me"
```

**Expected:** `401`  
**Must never return:** Nginx 404, Next route 404, or Nest `Cannot GET /api/backend/auth/me`

---

## HTTP-BFF-004 — Valid test-user login

Browser or curl with cookie jar against `POST http://<PUBLIC_HOST>/api/backend/auth/login` using `<TEST_USER_EMAIL>` / `<TEST_USER_PASSWORD>`.

**Expected:** HTTP 200 and three session cookies:

- `maintainpro_access`
- `maintainpro_refresh`
- `maintainpro_csrf`

Response JSON must **not** include `accessToken` or `refreshToken` fields.

---

## HTTP-BFF-005 — Cookie attributes (approved HTTP mode)

Inspect Set-Cookie / Application panel:

| Cookie | HttpOnly | Secure (HTTP mode) | SameSite |
| --- | --- | --- | --- |
| `maintainpro_access` | true | false | Lax |
| `maintainpro_refresh` | true | false | Lax |
| `maintainpro_csrf` | false | false | Lax |

Secure-mode (default production HTTPS) must show `Secure` present — verify on a separate HTTPS profile, not by disabling HTTP mode silently.

---

## HTTP-BFF-006 — localStorage must not hold tokens

In DevTools → Application → Local Storage:

- `maintainpro_access_token` = null / absent
- `maintainpro_refresh_token` = null / absent

User profile cache (`maintainpro_user`) may exist.

---

## HTTP-BFF-007 — Protected mutation without CSRF

Authenticated session; `POST` a business mutation via `/api/backend/...` **without** `X-CSRF-Token`.

**Expected:** `403` with `CSRF_INVALID` (or equivalent CSRF failure)

---

## HTTP-BFF-008 — Protected mutation with valid CSRF

Same mutation with `X-CSRF-Token` matching `maintainpro_csrf` cookie value.

**Expected:** Normal business success/error from Nest (not CSRF 403)

---

## HTTP-BFF-009 — Logout

Call logout via BFF; then open a protected page.

**Expected:** Session cookies cleared/expired; redirect to `/login`

---

## HTTP-BFF-010 — Browser refresh keeps session

While access/refresh tokens remain valid, reload a protected page.

**Expected:** Session remains active (no forced login)

---

## HTTP-BFF-011 — Old refresh token replay

Capture a refresh token value from a previous logout/rotation (if available in a controlled lab only). Replay against refresh endpoint.

**Expected:** Rejected (401/403) — not a new session

---

## HTTP-BFF-012 — Restricted ports unreachable externally

From an **external** network (not the host loopback), verify these are unreachable:

`27018`, `6379`, `9000`, `9001`, `3000`, `3001`

**Expected:** Connection timeout / filtered (not open services)

Port `80` may be reachable for the approved HTTP entry.

---

## Operator sign-off

| Test ID | Result | Date | Operator | Evidence link (redacted) |
| --- | --- | --- | --- | --- |
| HTTP-BFF-001 | | | | |
| HTTP-BFF-002 | | | | |
| HTTP-BFF-003 | | | | |
| HTTP-BFF-004 | | | | |
| HTTP-BFF-005 | | | | |
| HTTP-BFF-006 | | | | |
| HTTP-BFF-007 | | | | |
| HTTP-BFF-008 | | | | |
| HTTP-BFF-009 | | | | |
| HTTP-BFF-010 | | | | |
| HTTP-BFF-011 | | | | |
| HTTP-BFF-012 | | | | |

**Live HTTP login validated in production:** NO — until the table above is completed with evidence.
