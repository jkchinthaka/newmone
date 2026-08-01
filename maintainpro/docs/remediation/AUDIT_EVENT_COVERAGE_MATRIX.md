# Audit Event Coverage Matrix (Phase 5D)

**Status:** CONTRACT_DEFINED  
**Preserve:** Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / `30715842098`

## Principles

1. Security and lifecycle events needed for operational review must be **queryable**.
2. Never store: passwords, tokens, cookies, CSRF values, Authorization headers, raw ERP payloads, secret env values.
3. Prefer safe reason codes over free-text credential material.
4. Cap metadata size; rate-limit failure-event writes under abuse.
5. Auth failure HTTP responses remain generic (no user enumeration).

## Coverage matrix

| Event key | Entity | Actor | Tenant | Outcome | Timestamp | Request ID | Reason | Safe metadata | Retention | Visibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auth.login.success` | User / Session | userId | when known | SUCCESS | yes | yes | — | role, tenant switch context | security | audit.view / admin |
| `auth.login.failure` | SecurityEvent | optional | when safely resolvable | FAILURE | yes | yes | reason code (BAD_CREDENTIALS, LOCKED, INACTIVE) | privacy-safe identifier fingerprint only — **no password, avoid full email when possible** | security | audit.view / admin |
| `auth.rate_limit_or_lock` | User | system/user | yes | LOCKED | yes | yes | LOCKOUT | attemptCount capped | security | audit.view |
| `auth.logout` | Session | userId | yes | SUCCESS | yes | yes | — | — | operational | audit.view |
| `rbac.role_change` | User | actorId | yes | SUCCESS/FAILURE | yes | yes | required | before/after role names | security | audit.view |
| `rbac.permission_change` | Role/User | actorId | yes | SUCCESS | yes | yes | required | permission keys added/removed | security | audit.view |
| `tenant.switch` | Session | userId | target | SUCCESS | yes | yes | — | from/to tenant ids | operational | audit.view |
| `user.invitation` | User | actorId | yes | SUCCESS | yes | yes | — | invitee role; no secrets | operational | audit.view |
| `wo.create` | WorkOrder | actorId | yes | SUCCESS | yes | yes | — | woNumber | operational | audit.view |
| `wo.approve` / `wo.reject` | WorkOrder | actorId | yes | SUCCESS | yes | yes | reason on reject/override | approvalStatus | operational | audit.view |
| `wo.assign` | WorkOrder | actorId | yes | SUCCESS | yes | yes | — | assignee ids | operational | audit.view |
| `wo.start` / `wo.complete` / `wo.verify` | WorkOrder | actorId | yes | SUCCESS | yes | yes | — | status transitions | operational | audit.view |
| `inv.stock_issue` | Movement | actorId | yes | SUCCESS/FAILURE | yes | yes | — | partId, qty, woId, idempotency key id | operational | audit.view |
| `inv.stock_receipt` | PurchaseReceipt | actorId | yes | SUCCESS | yes | yes | — | poId, receiptNumber, qty | operational | audit.view |
| `po.create` / `po.approve` / `po.reject` | PurchaseOrder | actorId | yes | SUCCESS | yes | yes | reason on reject | poNumber, amounts numeric | operational | audit.view |
| `erp.sync.success` / `erp.sync.failure` / `erp.sync.retry` | PurchaseOrder / ErpAttempt | actorId/system | yes | SUCCESS/FAILURE | yes | yes | safe errorCode | attempt#; **no URL/payload** | operational | audit.view + erp viewers |
| `report.export` | Report | actorId | yes | SUCCESS | yes | yes | — | module, format, rowCount, truncated? | compliance | audit.view |
| `audit.export` | AuditLog | actorId | yes | SUCCESS | yes | yes | — | rowCount | compliance | audit.view |
| `settings.change` | Settings | actorId | yes | SUCCESS | yes | yes | — | keys changed; no secret values | security | audit.view |
| `emergency.override` | WorkOrder/PO | actorId | yes | SUCCESS | yes | yes | **required** | override type | security | audit.view |

## Query contract

- Invalid `from`/`to` → **400** (no silent ignore).
- Start after end → **400**.
- Bounded page/pageSize; export row limit explicit; truncation metadata required.
- Tenant scope mandatory; cross-tenant escape forbidden.
- Audit export creates its own `audit.export` event.

## Reconciliation (Phase 5B/5C fixture)

For a full lifecycle fixture, coverage status reports:

- expected vs found event counts
- missing / duplicate event keys
- coverage status COMPLETE / DEGRADED

Do not expose internal metadata to users lacking `audit.view`.

## Test IDs

- E2E-AUDIT-001 role/permission change events
- E2E-AUDIT-002 login failure persisted safely (no password)
- E2E-AUDIT-003 WO/inventory/PO/ERP lifecycle coverage
- E2E-AUDIT-004 export audited
- E2E-AUDIT-005 invalid audit dates 400
