# Work Order Assignment Contract (Phase 5B)

## Canonical model (Option A)

Assignment uses **dual sync**:

1. Legacy field: `WorkOrder.technicianId` (user id)
2. Canonical rows: `WorkOrderAssignee` (employee-linked, primary flag)

`POST /work-orders/:id/assign` is the E2E-preferred path for technician assignment.

## Request

```
POST /api/backend/work-orders/:id/assign
{ "technicianId": "<from /auth/me of tech-a>" }
```

| Field | Required | Source |
| --- | --- | --- |
| `technicianId` | Yes | Authenticated user id via BFF `/auth/me` — never hardcoded ObjectIds |

## Preconditions

- Work order must be **approval-approved** (`assertWorkOrderApprovedForExecution`)
- Technician must exist in tenant and not be `VIEWER`/`DRIVER`

## Success

- HTTP **200** (`@HttpCode(HttpStatus.OK)`)
- Response includes updated WO with assignee sync
- Notification emitted to technician

## Start dependency

`PATCH /work-orders/:id/status` with `IN_PROGRESS` returns **400** when:

- No `technicianId`, **and**
- No active `WorkOrderAssignee` rows

E2E-WO-LC-005 assigns before E2E-WO-LC-007; E2E-WO-NEG-003 proves unassigned approved WO cannot start.

## Planning fields (optional PATCH)

After assignment, managers may update:

```
PATCH /api/backend/work-orders/:id
{
  "plannedStartAt": "<ISO>",
  "plannedEndAt": "<ISO>",
  "estimatedHours": 3
}
```

HTTP **200** when WO is unlocked for sensitive-field edits.

## E2E strategy

- Resolve `technicianId` in isolated BrowserContext login as `tech-a`
- Assign from `manager-a` context after admin approval
- Do not use seeded fixture user ids in spec source
