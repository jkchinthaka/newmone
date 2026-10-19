# Schema usage audit

Report only. Scanned `prisma/schema.prisma` (218 models) against `apps/api/src` and `apps/web` TypeScript, excluding `node_modules`, `.next`, tests, and `e2e-real`. Nothing was renamed or dropped.

Date: 2026-10-19. Branch: `fix/enterprise-remediation-20261015`.

## Models with zero references in API and web source

These names and their Prisma accessors do not appear in application source. They are candidates for a later drop, after a live row-count check.

| Model | Note |
| --- | --- |
| CleaningChecklistTemplate | Cleaning module still has other models. |
| CleaningChecklist | Same. |
| PmPlanRequiredPart | No API or web use found. |
| TraceabilitySprayLink | Farm traceability. |
| VendorContractAsset | Contract header is used; this link is not. |
| VendorContractSite | Same. |
| OrganizationUnit | No app reference. Keep for now: `vw_rpt_dim_branch_site` joins it (`20260930090000_drop_unused_tables`). |

## Used only by retired or hidden modules

Navigation marks `/farm`, `/cleaning`, `/billing`, and `/predictive-ai` as retired paths. Models whose source hits are only inside `modules/farm`, `modules/billing`, or `modules/cleaning`:

- Billing: `StripeInvoice`
- Farm: `CropCycle`, `HarvestRecord`, `LivestockAnimal`, `AnimalHealthRecord`, `AnimalProductionLog`, `FeedingLog`, `IrrigationLog`, `WeatherLog`, `AttendanceLog`, `FarmIncome`, `TraceabilityRecord`
- Cleaning: `ChecklistTemplateItem`

There is no FG / food-safety model in this Prisma schema. `ErpImportBatch` is used by inventory ERP code and is not retired.

These related models are not drop candidates, because other modules still reference them:

- `Subscription` and `StripeCustomer` are used by entitlements.
- `CleaningLocation` and `CleaningVisit` are used by the facility backfill.
- `SprayLog`, `FarmWorker`, and `FarmExpense` are referenced from seed and farm modules that also sit next to shared seed code.

## Column naming

Prisma fields are camelCase. No snake_case fields and no typo fields (`adress`, `recieve`, `ammount`, and similar) were found.

The same idea uses different names:

| Idea | Fields | Where |
| --- | --- | --- |
| Display text | `name` on 42 models, `title` on 14, `label` on 3 | `title`: WorkOrder, Notification, CopilotConversation, FacilityIssue, QaIssue, DeliveryChecklist, DeliveryChecklistItem, SupportTicket, ChangeRequest, SoftwareRelease, CutoverChecklistItem, ErpAccessChecklistItem, ComplianceRequirement, VendorContract. `label`: AssetAttributeDefinition, ChecklistTemplateItem, CustomFieldDefinition. |
| Free text | `notes` 55, `description` 47, `remarks` 1 | `remarks` is only `WorkOrderAssignee`. |
| Phone | `phone` on User, Employee, Supplier, FarmWorker | No `mobile` field. |
| Status | `status` on 74 models | No `state` field. |
| Quantity | `quantity` on 8 models | No `qty` field. |

No model has both `name` and `title`.

## Safe later plan

Do not drop or rename in this release.

1. For each zero-reference model except `OrganizationUnit`, add a migration that throws if the table has rows, then drops it. Update the reporting view before any `OrganizationUnit` drop.
2. Retired farm, billing, and cleaning models stay until those modules are removed and the owner signs off. Drop them in their own migration, child tables first (`ON DELETE NO ACTION`).
3. Renames use a new migration plus `@map` / `@@map` so the database column can change while the Prisma field the API already calls stays the same. Do not rename `title` to `name` in the client in the same release as the SQL change.
4. Apply with `prisma migrate deploy`. Do not use `db push`.
