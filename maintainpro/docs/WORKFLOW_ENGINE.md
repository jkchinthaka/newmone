# Workflow Engine

MaintainPro uses a hybrid workflow approach:

1. **Published `WorkflowVersion`** (when present on the entity) — Admin-configurable transitions JSON.
2. **Code state machines** (`apps/api/src/modules/policies/state-machines.ts`) — backward-compatible defaults for WORK_ORDER, PART_REQUEST, PURCHASE_ORDER, ASSET, etc.

## API

- `GET /workflows` — list definitions + recent versions
- `POST /workflows/ensure-default` — seed published WO baseline from `ALLOWED_STATUS_TRANSITIONS`
- `POST /workflows/:definitionId/publish` — maker-checker style publish (retires prior published)

## History

Work order transitions continue to append to `WorkOrderStatusHistory` (append-only).

## Invalid transitions

Rejected server-side with `INVALID_TRANSITION`.
