# Work Order Evidence Contract (Phase 5B)

## Option A — storage-disabled waiver

When `STORAGE_UPLOADS_ENABLED` is not true (typical E2E/CI):

- Before/after **photo** requirements are **waived** for technician completion and supervisor verification
- **Completion note** remains **mandatory** for `TECHNICIAN_COMPLETED`
- QR verification is **not required** when no `assetId`/`vehicleId`

Implementation reference: `work-order-evidence-governance.ts` — `evaluateEvidenceRequirements()` sets `complete: true` when `!storageEnabled`.

## Evidence types

| Type | Storage required | E2E usage |
| --- | --- | --- |
| `TECHNICIAN_NOTE` | No (note-only) | E2E-WO-LC-011 metadata POST → **201** |
| `BEFORE_PHOTO` / `AFTER_PHOTO` | Yes when uploads enabled | Waived in E2E gate |
| QR verification | When asset/vehicle linked | Avoided by no-asset create |

## Technician completion

```
PATCH /api/backend/work-orders/:id/status
{
  "status": "COMPLETED",
  "completionNote": "...",
  "actualCost": 175.5,
  "actualHours": 2.25
}
```

- HTTP **200**
- Final status `TECHNICIAN_COMPLETED` until supervisor verify

## Supervisor verification

```
POST /api/backend/work-orders/:id/verify-supervisor
{ "verificationNote": "..." }
```

- HTTP **200**
- Sets status **COMPLETED** and `verificationStatus=VERIFIED`
- Photo evidence still waived when storage disabled

## Hold / delay

- `ON_HOLD` status requires `delayReason` (hold reason)
- Overdue completion may require `delayReason` on close paths

## E2E assertions

- LC-011: note-only evidence succeeds without file upload
- LC-012: technician completion succeeds without photos (proves waiver)
- LC-014/015: supervisor verify completes lifecycle without uploaded photos
