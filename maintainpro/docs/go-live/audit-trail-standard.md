# Audit Trail Standard

MaintainPro audit standard for UAT-022. Goal: prove **who did what, when, why, before/after**.

## Storage

Audit records are stored in MongoDB `AuditLog` (Prisma model). Normal users cannot edit audit rows. Deletion is not exposed via API.

## Required fields

| Field | Source | Notes |
|-------|--------|-------|
| `id` | Prisma auto | Immutable |
| `tenantId` | Actor / request context | Tenant scope |
| `actorId` | JWT `sub` | Required for sensitive actions |
| `actorName` | `actorSnapshot` / user lookup | Best-effort |
| `actorRole` | JWT / `actorSnapshot` | Role at time of action |
| `action` | `CREATE` / `UPDATE` / `DELETE` | Prisma enum |
| `module` | Service layer | e.g. `work-orders`, `fraud-control` |
| `entityType` | `entity` column | e.g. `WorkOrder`, `report` |
| `entityId` | `entityId` column | Target record ID |
| `previousValue` | `beforeData` JSON | State before change |
| `newValue` | `afterData` JSON | State after change |
| `reason` | User-provided or system label | **Required for overrides** |
| `source` | `metadata.source` | `WEB` / `MOBILE` / `API` / `OFFLINE` |
| `ipAddress` | Request context | When available |
| `deviceInfo` | `userAgent` | When available |
| `timestamp` | `createdAt` | Server UTC |
| `overrideFlag` | `metadata.overrideFlag` | `true` for admin overrides |
| `riskSeverity` | `metadata.riskSeverity` | LOW / MEDIUM / HIGH / CRITICAL |
| `relatedWorkOrderId` | `metadata.workOrderId` | When applicable |

## Implementation

Use `writeAuditTrail()` in `apps/api/src/common/utils/audit-trail.util.ts` for new sensitive writes.

Legacy services may use `recordPhase4Audit()` — both write to the same `AuditLog` table.

## Rules

1. Sensitive updates must write audit **before** returning success to the client.
2. Failed sensitive attempts should be logged where useful (e.g. blocked gate-out, maker-checker violation).
3. Admin overrides require `reason` (min 3 chars) and `metadata.overrideFlag: true`.
4. Report exports write `report_exported` audit events.
5. Audit listing/export requires `audit.view` permission.
6. Never store passwords, tokens, or raw secrets in audit payloads.

## Override types (examples)

| overrideType | Module |
|--------------|--------|
| `completion_override_missing_evidence` | evidence |
| `gate_out_override` | fleet |
| `parts_issue_override` | inventory |
| `emergency_vendor_override` | vendor-repair |
| `invoice_exceeds_quotation` | finance |
| `work_order_reopen` | work-orders |
| `stock_adjustment` | inventory |
| `role_permission_change` | admin |

## Review surfaces

- **Reports → Fraud & Control → Admin Overrides** — override-focused view
- **Settings → Audit logs** (admin) — full audit listing
- **Entity history drawer** — per-record timeline via `GET /audit-logs/:entity/:entityId`

## Retention

Retention policy is tenant/operations defined. Production should configure MongoDB Atlas backup (see `backup-restore-plan.md`).
