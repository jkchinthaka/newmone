# CSRF Policy

MaintainPro uses a **same-origin synchronizer / double-submit** pattern after the BFF migration.

## Rules

- State-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`) through `/api/backend` require:
  - cookie `maintainpro_csrf`
  - header `X-CSRF-Token` with the same value
- Comparison uses length-checked `timingSafeEqual`.
- Auth bootstrap routes skip CSRF: login, register, forgot/reset password, invite accept.
- Stripe webhooks are not served through the browser BFF CSRF path.
- Failed CSRF returns `403` with `error.code = CSRF_INVALID` and a `requestId`.

## Why not API-origin cookies

Cross-origin SPA → API cookie CSRF cannot be read by frontend JS. The BFF keeps CSRF on the frontend origin so the browser can attach the header safely.