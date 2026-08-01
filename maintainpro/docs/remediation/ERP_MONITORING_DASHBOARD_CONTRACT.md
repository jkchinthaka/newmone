# ERP Monitoring Dashboard Contract (Phase 5D)

**Status:** CONTRACT_DEFINED  
**Preserve:** Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / `30715842098`  
**E2E provider:** **MOCK only** — Phase 5D must not call real Bileeta / live ERP.

## Purpose

Expose safe procurement/ERP management information on role-appropriate dashboards without leaking integration secrets or payloads. Builds on Phase 5C `ERP_SYNC_SAFETY_CONTRACT.md`.

## Safe fields (allowlist)

| Field | Description |
| --- | --- |
| `providerCategory` | e.g. MOCK / CONFIGURED / DISABLED (never raw hostname) |
| `readinessStatus` | READY / DEGRADED / UNAVAILABLE |
| `approvedNotSynced` | Count of approved POs not successfully synced |
| `pendingAttempts` | Attempts in PENDING |
| `failedAttempts` | Latest-relevant FAILED (no duplicate inflation) |
| `retriesDue` | `nextRetryAt ≤ now` and under max attempts |
| `attemptsAtMaxLimit` | Exhausted retry budget |
| `lastSuccessfulSyncAt` | ISO timestamp UTC; display in Asia/Colombo |
| `receiptBacklog` | Ordered / partial awaiting GRN |
| `reconciliationFailures` | Count of reconcile mismatches when supported |
| `coverageStatus` | COMPLETE / DEGRADED / UNAVAILABLE |

## Forbidden fields

Never return to browser or logs in dashboard payloads:

- Provider URL / endpoint
- Request or response payloads
- API keys, secrets, Authorization headers
- Raw stack traces
- Database URLs
- CSRF / cookies / tokens

Error display uses sanitized `errorCode` / safe `errorMessage` only (Phase 5C sanitize rules).

## Role policy

| Audience | May view | May act |
| --- | --- | --- |
| Management | Safe summary counts | No apply/retry unless separately permitted |
| Procurement | PO sync operational details (safe) | Retry/submit per `erp.*` / procurement permissions |
| Finance (`FINANCE` / alias) | Approval / receipt state affecting spend | No raw ERP apply by default |
| Inventory Keeper | Receiving / GRN backlog state | **No** `erp_apply` |
| Admin / integration roles | Safe summary + admin ERP screens | Retry/apply when `erp.manage` / `inventory.erp_apply` as Phase 5C |
| Viewer / Technician / Driver / Cleaner | Hidden | None |

## UI placement

- Management / procurement / admin variants may show an ERP/procurement monitoring card.
- Links drill to procurement/ERP screens that already enforce RBAC.
- Morning briefing may include ERP failure signals only as safe counts with DEGRADED handling.

## E2E / CI

- Provider forced to MOCK.
- Tests assert absence of URL/payload/key patterns in dashboard JSON.
- Counts reconcile to PO + attempt fixtures (E2E-KPI-010, E2E-ERP-MON-*).

## Test IDs

- E2E-ERP-MON-001 safe summary visible to management/procurement
- E2E-ERP-MON-002 keeper cannot apply
- E2E-ERP-MON-003 no secret/URL/payload leakage
- E2E-ERP-MON-004 MOCK provider only in E2E
- E2E-DASH-006 procurement dashboard ERP/GRN backlog
