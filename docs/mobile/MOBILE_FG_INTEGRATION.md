# MaintainPro Mobile V2 — FG Integration Boundary

**Form:** `NMS/PPU/CL/30` — Inspection Record for Freezer Truck  
**Authoritative systems:** Nest FG SSO + Next handoff/BFF + Django FG recording (no Nest FG CRUD)

## Verified mobile capability today

| Step | Status |
|---|---|
| Nest `POST /api/auth/fg-sso/exchange` with MaintainPro Bearer JWT | Possible |
| Nest `POST /api/auth/fg-sso/verify` | Possible |
| Django `GET /api/v1/session` (assertion → `fg_sessionid`) | Needs assertion + cookie jar |
| Django CL30 open/save/submit/review/QA JSON APIs | Need Django session + CSRF |
| Flutter completing CL30 with Bearer-only client | **Blocked** |

## Exact blocker

MaintainPro access JWT is **not** a Django FG credential. Web binds FG to HttpOnly `Path=/fg` cookies via Next handoff (`/api/fg-sso/handoff`) and `/fg/api/*` BFF. Flutter has no cookie jar for that path and must not invent a parallel FG backend or weaken Django CSRF.

## Smallest additive secure proposal (not implemented yet)

Add Nest **`/api/mobile/fg/*`** that:

1. Requires `JwtAuthGuard` + live `fg.access`
2. Reuses `FgSsoService.exchangeForUser`
3. Server-side boots Django session (assertion → `/api/v1/session`) and holds session/CSRF in Nest (memory/redis keyed by user), never long-lived assertion to the client
4. Proxies existing Django JSON: records open/save/submit, vehicles `?formCode=NMS/PPU/CL/30`, reviews/QA decisions
5. Does **not** accept MP JWT inside Django; does **not** csrf_exempt Django

Flutter then calls Nest with Bearer only.

## CL30 product rules (source)

- Independent occurrence (`INDEPENDENT_OCCURRENCE_FORM_CODES`)
- Vehicle types: TRUCK only (`vehicle-eligibility.ts` + Django `api_vehicles`)
- Permissions: `fg.recording.*`, `fg.review.*`, `fg.qa.*`
- Supervisor/QA online-authoritative; SoD policy-gated in Django reviews governance

## Mobile UI stance until BFF exists

FG Module Hub may show CL30 entry points as **blocked** with this gap message. No draft/submit mutations against invented endpoints.
