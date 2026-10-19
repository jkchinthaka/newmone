# Access & Form Studio — design (step 1)

Status: design only. No schema or code until the product owner names the slice order.
Date: 2026-10-19. Audience: SUPER_ADMIN operators who must change access and forms without a developer.

## Current state (verified in this tree)

- `User.roleId` is one role. `RolePermission` links that role to global `Permission.key` rows. There is no per-user grant or deny.
- `PermissionsGuard` loads the DB role and **returns true for every `SUPER_ADMIN`** before keys are checked. JWT permission lists are ignored.
- Hard-coded `@Roles(...)`: **598 sites in 54 `*.controller.ts` files** (re-counted in this worktree on 2026-10-19; the earlier note said 597/52). Another **67 sites in 11 farm `*.module.ts` files**. `@Permissions(...)` already exists on many of the same controllers (both decorators often stack).
- `CustomFieldDefinition` (tenant, entityType, key, label, type, required, allowed values) exists. No form reads it, and there is no custom-value table.
- The role-permission editor (`RolePermissionEditor`) is the SUPER_ADMIN matrix. It edits the role, not a user.

## 1. Effective access

```
effective = (role permission keys ∪ user GRANT) − user DENY
```

`UserPermissionOverride`: `tenantId`, `userId`, `permissionKey`, `effect` GRANT|DENY, `reason`, `expiresAt?`, `createdBy`, timestamps. Unique `(tenantId, userId, permissionKey)`. Expired rows are ignored. **DENY wins** over role and GRANT.

Resolve once per request (request cache). Do not put the result in the JWT. `PermissionsGuard` keeps the DB lookup and applies overrides after the role set. The SUPER_ADMIN blanket `return true` becomes: SUPER_ADMIN has every key **except** an active DENY, and except the lock in §6.

## 2. `@Roles` → `@Permissions`

Target: route access is a permission key. `@Roles` stays only where the check is truly a role name (rare). RolesGuard can remain as a second check during migration; it is removed per controller only after that controller’s keys are seeded.

**Safe migration (behaviour unchanged on day one):**

1. Inventory each `@Roles` site → one key `module.resource.action` (reuse existing keys; do not invent a second vocabulary).
2. Seed `Permission` + `RolePermission` so each role that passes today’s `@Roles` receives exactly those keys. Snapshot tests: for every seeded role, old allow/deny equals new allow/deny, with zero overrides.
3. Add `@Permissions(key)` beside `@Roles`. Ship. Then delete `@Roles` on that controller in a follow-up commit of the same slice.
4. Farm module decorators are in the same inventory (67), migrated with their controllers.

Count to plan for: **598 controller sites / 54 files**, plus **67 farm module sites / 11 files**. Class-level `@Roles` covers every handler on that class, so the route count is at least the handler count on those 52 files (work-orders alone declares 81 handlers).

## 3. Field-level security

`FieldAccessPolicy`: `tenantId`, `entity`, `field`, `subjectType` role|user, `subjectId`, `mode` HIDDEN|READ_ONLY|EDITABLE. Most specific subject wins (user over role). No row → EDITABLE.

- Responses and exports omit HIDDEN fields (including nested export DTOs).
- Writes to READ_ONLY fields return **403** with the field name. Absent fields are not writes.
- `GET /api/access/field-policies?entity=` is what the UI uses to hide or disable inputs.

First entities: WorkOrder, MaintenanceRequest, Asset, Vehicle, VendorInvoice, InventoryItem. System fields required by workflow (§4) cannot be HIDDEN.

## 4. Form config

`FormLayout`: `tenantId`, `entity`, `form`, optional `roleId`, optional `userId`, `fieldsJson` entries `{ key, visible, required, label, order, section }`, `version`. User layout wins over role over tenant default.

Render = layout ∪ active `CustomFieldDefinition` for that entity. New `CustomFieldValue` (`tenantId`, entity, recordId, key, valueJson). Server validation uses the same layout: required means present; hidden custom fields are not required. **Required system fields cannot be hidden or made optional** (server rejects that layout save).

F5 scope is WorkOrder, MaintenanceRequest, and Asset only. Vehicle, VendorInvoice, and InventoryItem get field policy in F4 and forms later.

## 5. Admin UI

Admin → Access & Forms:

- User list → user page: module / page / action matrix, each cell Inherited, Granted, or Denied (effective value plus the source).
- Field-policy grid per entity (the six entities).
- Form designer: drag order, show/hide, required, label, add custom field (writes `CustomFieldDefinition` + layout).
- Preview as user: read-only session flag; API calls send the target user id; no writes; banner always visible. Preview cannot escalate the caller.

## 6. Guardrails (not configurable)

- SoD (`SoDPolicy`), tenant isolation, the evidence gate, and the stock check stay in code. A GRANT cannot turn them off.
- A SUPER_ADMIN cannot DENY their own admin keys (`admin.access.manage` and the keys that open this studio). The last active SUPER_ADMIN cannot be demoted, deactivated, or denied those keys.
- Every save writes an audit row: actor, target, old JSON, new JSON.
- `AccessConfigRevision` stores a snapshot (overrides, field policies, layouts). One-click rollback writes a new revision that restores the chosen snapshot (rollback is itself audited).
- No restart: mutation bumps a tenant config version; the request cache reads that version. Invalidate on save.

## 7. Slices

Each slice ships alone with tests. Order is the owner’s choice; dependencies are noted.

| Slice | Delivers | Depends | Effort | Main risk |
| --- | --- | --- | --- | --- |
| F1 | Override model, effective-access API, guard uses it, DENY wins, expiry | — | 4–6 d | SUPER_ADMIN bypass left in place would ignore DENY. Lock §6 in this slice. |
| F2 | Seeded keys; `@Permissions` on the 598+67 sites; parity tests; then drop `@Roles` | F1 | 8–12 d | A missed class-level `@Roles` or a too-wide seed changes who can call a route. Parity test is the gate. |
| F3 | User matrix UI + preview-as-user | F1 | 4–6 d | Preview must not mint a real session or allow writes. |
| F4 | Field policy API + strip/403 + grid for 6 entities | F1 | 6–8 d | Export paths and partial PATCH that omit a read-only field. |
| F5 | Layouts + custom values on WO, Request, Asset; server validation | F4 | 8–10 d | Hiding a required system field; custom values leaking across tenants. |
| F6 | Revisions, audit old→new, one-click rollback, cache bump | F1; covers F4/F5 when those exist | 4–5 d | Rollback of a layout while records still hold custom values. |
| F7 | UAT script per shipped slice | that slice | 1–2 d each | Scripts that assert old role behaviour after F2 without the seed snapshot. |

Rough total if sequential: **about 7–9 weeks**. F7 can be written with each slice. F6 can start after F1 and grow as F4/F5 land.

Stop here. Implementation waits for OK and slice order.
