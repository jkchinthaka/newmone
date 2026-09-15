# Phase 5 — FacilityIssue → MaintenanceRequest Migration

**Branch:** `maintainpro/phase-05-requests-triage`  
**Baseline Phase 4 SHA:** `a50b6b9624b1a0f281e20095badf453d7ab02fdb`

## Disposition summary

| System | Overlap | Disposition |
|--------|---------|-------------|
| **FacilityIssue** | Cleaning/facilities issue reporting with WO conversion bridge | **Retain** model + historical data. Bridge via `legacySourceType=FacilityIssue` / `legacySourceId`. Do **not** delete in Phase 5. New user reporting goes to Maintenance Request. |
| **SupportTicket** | IT/go-live helpdesk | **Out of scope** — do not migrate into MaintenanceRequest |
| **WorkOrder** | Executable maintenance | Reuse; MR links via `workOrderId`; WO gains optional site/FL for location-only |
| **EvidenceAttachment** | Photos/docs | Reuse; add `maintenanceRequestId` |
| Cleaning reports | Specialized cleaning ops | Remain cleaning domain; do not invent a second MR engine |

## FacilityIssue field overlap (conceptual)

| FacilityIssue | MaintenanceRequest |
|---------------|-------------------|
| title + description | description (combined on migrate) |
| severity | priority (`Priority` enum) |
| status | mapped subset; closed rows skipped |
| reportedById | reportedById |
| locationId (CleaningLocation) | unresolved → needs Phase 3 FunctionalLocation mapping |
| category | problemCategoryLabel / snapshot |
| linked WO (if any) | workOrderId when already converted (manual review) |

## Unresolved fields

- CleaningLocation → FunctionalLocation mapping is not automatic for every tenant
- Room/building QR payloads that only resolve facility hierarchy need explicit FL enrichment before create validation (asset **or** FL required)
- Historical closed FacilityIssues are intentionally **not** bulk-imported as active MRs

## Traceability

```text
MaintenanceRequest.legacySourceType = "FacilityIssue"
MaintenanceRequest.legacySourceId   = <FacilityIssue.id>
contextSnapshot.migratedFrom        = "FacilityIssue"
```

## Script

`apps/api/scripts/migrate-facility-issues-to-requests.ts`

- Tenant-aware (`--tenant=`)
- Dry-run by default
- Idempotent (skips existing legacySource pair)
- Non-destructive (never deletes FacilityIssue)
- Reports skipped / unresolved rows; apply mode refuses create until FL mapping exists

```bash
cd maintainpro
npx ts-node --transpile-only apps/api/scripts/migrate-facility-issues-to-requests.ts
npx ts-node --transpile-only apps/api/scripts/migrate-facility-issues-to-requests.ts --tenant=<id> --apply
```

## UX transition

- Primary Report Issue: `/requests/new`
- `/qr/report-issue` redirects to `/requests/new` (query string preserved)
- FacilityIssue admin/history routes may remain read-only for cleaning ops until a later retirement phase

## Retirement plan (later)

1. Complete FL mapping for open FacilityIssues  
2. Run apply migration with verification counts  
3. Prove dual-read period  
4. Redirect remaining deep links  
5. Destructive FacilityIssue cleanup only after proven migration (not Phase 5)
