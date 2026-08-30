# MaintainPro Mobile V2 — Progress

## Control block

| Field | Value |
|---|---|
| AUTHORITATIVE_MAIN_SHA | `2fd697e004da8524b6348c1ad2d33411a873a2a8` |
| BRANCH | `feature/mobile-v2` |
| DRAFT_PR | https://github.com/jkchinthaka/newmone/pull/28 |
| CURRENT_PHASE | FG CL30 secure integration — Nest broker + Flutter CL30 flows |
| LAST_VERIFIED_IMPLEMENTATION_SHA | `ffad659` (Nest broker) / `1495bd9` (API tests) — Flutter CL30 pending commit |
| PRODUCTION_MUTATION | NO |
| PRODUCTION_DEPLOYMENT | NO |

Do not create commits solely to refresh HEAD pointers.

## Completed

- [x] WO vertical slice quality gate
- [x] Nest `/api/mobile/fg/*` session broker (allowlisted, Redis/memory, token-fingerprint isolation)
- [x] Nest mobile-fg unit + contract tests (30 with fg-sso)
- [x] Flutter CL30 recorder / drafts / supervisor / QA / history via Nest only
- [x] Flutter tests 46/46; analyze clean

## Incomplete / next

- [ ] Live UAT against configured FG_API_INTERNAL_URL (non-prod)
- [ ] Gate In/Out vertical
- [ ] `/api/mobile/bootstrap` aggregation
- [ ] Optional CL18/CL24 after CL30 UAT

## API gaps

1. Live FG E2E not automated in CI without FG service
2. WO Idempotency-Key still not server-enforced for WO mutations
3. OpenAPI static export still runtime-only
4. Baseline Docker compose fixture DJANGO_ALLOWED_HOSTS still failing on main (unrelated)

## Next exact action

Push Flutter CL30 commits; UAT Nest↔Django FG on non-prod; then Gate vertical.
