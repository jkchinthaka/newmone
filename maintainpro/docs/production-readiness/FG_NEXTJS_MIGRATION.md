# FG Digital Records — Next.js strangler UI

Presentation only. Django FG remains the business engine (validation, uniqueness, workflow, SoD, audit, immutability). Django templates stay until a later removal milestone.

Source branch for MaintainPro UI/SSO: current worktree. Django JSON API lives in the Combined-Release FG subtree (`systems/fg-digital-recording/`) because this branch does not contain the Django app.

## Architecture

```
MaintainPro session (httpOnly BFF cookies)
        → Nest POST /auth/fg-sso/exchange (live fg.access)
        → short-lived assertion (httpOnly Path=/fg)
        → Django GET /api/v1/session (or legacy /sso/consume/)
        → Django session cookie fg_sessionid Path=/fg
        → Next.js /fg/* calls BFF /fg/api/v1/* (forwards session + CSRF)
        → Django services (unchanged)
```

Feature flag: `FG_NEXTJS_UI_ENABLED` / `NEXT_PUBLIC_FG_NEXTJS_UI_ENABLED` (default **false**).

- Flag off: `/fg` redirects to `/api/fg-sso/handoff` → Django templates.
- Flag on: native Next.js module. Print still opens Django print views.

Rollback: disable the flag or restore the previous Web image. No database change.

## Route parity (summary)

| Legacy Django | Feature | Business action | Django view / API | Next.js | Auth | Permission | Status |
|---|---|---|---|---|---|---|---|
| `/daily-records/` | Dashboard | Today's controlled records + queue counts | `daily_records_home` / `GET /api/v1/dashboard` | `/fg`, `/fg/dashboard` | yes | `fg.recording.view` | Next.js (flag) |
| `/daily-records/<code>/open/` | Open/create today's record | Idempotent daily task + start recording | `daily_record_open` / `POST /api/v1/records/open` | `/fg/records/new` | yes | `fg.recording.view` (+ create via service) | Next.js (flag) |
| `/recording/<uuid>/` | Record editor | Draft answers | `record_detail` / `GET/POST /api/v1/records/<id>` | `/fg/records/[id]` | yes | recording view/edit | Next.js (flag) |
| `/recording/<uuid>/autosave/` | Draft save | Optimistic concurrency | existing autosave + `POST .../save` | same page | yes | `fg.recording.edit` | Next.js (flag) |
| `/recording/<uuid>/submit/` | Submit | Immutable submission #1 | `submit_checklist_record` / `POST .../submit` | same page | yes | `fg.recording.submit` | Next.js (flag) |
| `/reviews/` | Supervisor queue | List reviewable submissions | `review_queue` / `GET /api/v1/reviews` | `/fg/review` | yes | `fg.review.view` | Next.js (flag) |
| `/reviews/submissions/<id>/confirm/<decision>/` | Supervisor decision | APPROVED / RETURNED_FOR_CORRECTION | `create_supervisor_review` | `/fg/review/[id]` | yes | `fg.review.perform` | Next.js (flag) |
| `/quality/` | QA queue | List QA-eligible submissions | `qa_queue` / `GET /api/v1/qa` | `/fg/qa` | yes | `fg.qa.view` | Next.js (flag) |
| `/quality/submissions/<id>/confirm/<decision>/` | QA decision | RELEASE / HOLD / REJECT | `create_qa_review` | `/fg/qa/[id]` | yes | `fg.qa.disposition` | Next.js (flag) |
| `/daily-records/history/` | History | Filtered list (paginated) | `daily_record_history` / `GET /api/v1/history` | `/fg/history` | yes | `fg.recording.view` | Next.js (flag) |
| `/daily-records/print/<uuid>/` | Official print | Authoritative HTML print | Django template only | link from detail | yes | `fg.recording.view` | **legacy print kept** |
| `/integrations/maintainpro/vehicles/search/` | Vehicle lookup | Vehicle Master search | existing JSON `format=json` + `GET /api/v1/vehicles` | selector on CL18/CL30 | yes | authenticated FG session | Next.js (flag) |
| `/sso/consume/` | SSO consume | Assertion → Django session | existing + `GET /api/v1/session` | BFF | MP session | `fg.access` (Nest) | both |
| `/sso/denied/` | Access denied | Missing fg.access | Django + Next `/fg/sso/denied` | `/fg/sso/denied` | n/a | n/a | both |

CL39 (cold room) remains on the dashboard as a controlled form when the backend returns it. Reports page is a history shortcut, not a new reporting engine.

## Controlled-form multiplicity (authoritative intent)

Do **not** trust the earlier Next.js migration note that CL18/CL30 are one record per day. That matched a stale Combined-Release JSON API (`2291aa08`) wrapping `ensure_controlled_daily_task` (`batch_ref = {slug}-{YYYY-MM-DD}`).

Intended controlled-record semantics:

| Code | Title | Intended Daily Records behaviour |
|---|---|---|
| `NMS/PPU/CL/24` | Daily Cleaning Verification | **One** record per day |
| `NMS/PPU/CL/18` | Product Dispatch Record | **Multiple** independent records per day (occurrence token) |
| `NMS/PPU/CL/30` | Inspection Record for Freezer Truck | **Multiple** independent records per day (occurrence token) |
| `NMS/PPU/CL/39` | Product Temperature Record – Inside Cold Room | One record per day **per room** (CR1/CR2) |

Validated occurrence-token machinery (retry same token → same task; new token → new task) already exists for MANUAL schedules: `manual_occurrence_key` / `create_manual_schedule_occurrence` (FG subtree `b7887991` / inner `475a1020`, tests in `test_phase07e_recurring_schedules.py`). Daily Records open does **not** yet pass a client occurrence token into that path.

Next.js (flag still **off**):

- CL24: open today's idempotent record. No occurrence token.
- CL18/CL30: new logical record mints a stable in-flight occurrence token (sessionStorage). Retry / double-click / rerender / refresh / back-forward reuse it. After a successful open, the intent is consumed so the next create is a new token.
- Frontend must not invent a second uniqueness rule; Django remains the authority once it consumes `occurrenceToken`.

## Known blockers

1. Django Daily Records / JSON API still one-per-day for CL18/CL30. Next.js contract updated; **parity not proven**. Flag stays off.
2. Native UI requires Django JSON API from Combined-Release FG. That branch is diverged (`ahead 1 / behind 3`). Do not force-push.
3. Print stays on Django until pixel/data parity is proven.
4. Production controlled-record smoke: **MANUAL_VALIDATION_PENDING** (no fake production records).
5. QA Phase 10A comments: SoD is not fully server-enforced for QA. Frontend still hides unauthorized actions; server remains the authority.

## API envelope

Success:

```json
{ "data": {}, "meta": {}, "error": null }
```

Error:

```json
{ "data": null, "meta": null, "error": { "code": "VALIDATION", "message": "...", "fieldErrors": {} } }
```

Never return stack traces, database errors, or secrets.

Mutating calls use Django CSRF (`X-CSRFToken` + csrf cookie). No `csrf_exempt`.

## Auth / tenant / CSRF

- MaintainPro JWT/BFF session is required before FG SSO.
- Nest live-checks `fg.access` (SUPER_ADMIN bypass only). Tenant comes from the MaintainPro user, not the browser.
- Django organization scope uses existing `organizations_for_task_record`.
- Logout clears `fg_sessionid` and `fg_sso_assertion` (`Path=/fg`).
- Next.js FG routes use `Cache-Control: no-store`.

## Tests

- Nest: `apps/api/test/fg-sso.spec.ts`
- Mapper/contract: `apps/api/test/fg-nextjs-mappers.spec.ts`, `apps/api/test/fg-contract.spec.ts`
- Django: `apps/recording/tests/test_nextjs_json_api.py` (Combined-Release FG tree)
- Playwright: `apps/web/e2e/fg-dashboard.spec.ts` — full CL18/CL24/CL30 workflow requires a disposable FG backend. Without it: **MANUAL_VALIDATION_PENDING**.

## Deployment / rollback

- Prefer Web-only deploy when only Next.js/Nest SSO changes.
- If Django JSON API is added: deploy Web + FG. No schema change.
- Rollback: previous Web image and/or `FG_NEXTJS_UI_ENABLED=false`. Legacy templates remain.
- **LEGACY_REMOVED=NO**
