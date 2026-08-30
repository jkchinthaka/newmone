# MaintainPro Mobile V2 — FG Integration

**Form:** `NMS/PPU/CL/30` — Inspection Record for Freezer Truck  
**Authoritative systems:** Nest FG SSO + Nest `/api/mobile/fg/*` broker + Django FG JSON APIs

## Architecture (implemented)

```
Flutter (Bearer MaintainPro JWT only)
        │
        ▼
Nest /api/mobile/fg/*  (allowlisted)
  • FgSsoService.exchangeForUser()
  • Server-side GET Django /api/v1/session (Bearer assertion)
  • Holds fg_sessionid + csrftoken + csrfToken in Redis/memory
  • Session key: tenantId|userId|sha256(accessToken)[0:32]
        │
        ▼
Django /api/v1/*  (CSRF enforced; business rules authoritative)
```

## Security properties

| Property | Status |
|---|---|
| Generic proxy | **NO** |
| FG cookies exposed to Flutter | **NO** |
| Long-lived assertion to Flutter | **NO** |
| Django CSRF | **ENFORCED** (Nest sends cookie + X-CSRFToken) |
| Session isolation | tenant + user + access-token fingerprint |
| Upstream host from client | **NO** (`FG_API_INTERNAL_URL` only) |

## Allowlisted Nest routes

| Method | Path | Permission |
|---|---|---|
| POST | `/api/mobile/fg/session/bootstrap` | `fg.access` |
| GET | `/api/mobile/fg/session` | `fg.access` |
| DELETE | `/api/mobile/fg/session` | `fg.access` |
| GET | `/api/mobile/fg/cl30/vehicles` | `fg.recording.view` |
| POST | `/api/mobile/fg/cl30/records/open` | `fg.recording.create` |
| GET | `/api/mobile/fg/cl30/records/:id` | `fg.recording.view` |
| POST | `/api/mobile/fg/cl30/records/:id/save` | `fg.recording.edit` |
| POST | `/api/mobile/fg/cl30/records/:id/submit` | `fg.recording.submit` |
| GET | `/api/mobile/fg/history` | `fg.recording.view` |
| GET/POST | `/api/mobile/fg/reviews...` | `fg.review.*` |
| GET/POST | `/api/mobile/fg/qa...` | `fg.qa.*` |

## Flutter CL30

- Recorder: vehicle lookup (TRUCK via formCode), open+occurrenceToken, dynamic editor fields, local draft, online save/submit
- Supervisor / QA queues + decisions (online-authoritative)
- History via Nest → Django
- Offline: local drafts only; submit/review/QA blocked offline

## Config

- `FG_API_INTERNAL_URL` — Django origin (required for broker)
- `FG_MOBILE_SESSION_TTL_SECONDS` — default 1800
- Existing `FG_SSO_*` for assertion minting

## Remaining gaps

- Live E2E against real Django FG not run in this session (unit/mocks only)
- Device-clock businessDate: server authoritative; client stores displayDate only
- Parts of editor UI depend on Django `editor.sections` shape — fallback key-value if absent
