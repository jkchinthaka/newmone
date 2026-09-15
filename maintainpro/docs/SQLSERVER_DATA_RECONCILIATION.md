# SQL Server Data Reconciliation

## Transform registry

| Mongo | SQL Server |
|-------|------------|
| `*.id` / `_id` ObjectId string | Same string PK `NVARCHAR(36)` |
| `Role.permissionIds[]` + `Permission.roleIds[]` | `RolePermission` rows |
| `User.skills[]` | `UserSkill` rows |
| `JobCode.requiredPartIds[]` | `JobCodeRequiredPart` |
| `PmPlan.requiredPartIds[]` | `PmPlanRequiredPart` |
| `VendorContract.assetIds[]` / `siteIds[]` | `VendorContractAsset` / `VendorContractSite` |
| `TraceabilityRecord.sprayLogIds[]` | `TraceabilitySprayLink` |
| Other `String[]` (photos, keywords, …) | `NVARCHAR(MAX)` JSON array text |
| Former `Json` fields | `NVARCHAR(MAX)` JSON text via `toJsonText` / `parseJsonText` |
| Prisma enums | `NVARCHAR(64)` strings; TS enums in `prisma-enums.ts` |
| Money Floats (selected) | `DECIMAL(18,2)` |

## Count template

Fill after dry-run / apply:

| Model | Mongo Count | SQL Count | Migrated | Failed | Skipped | Orphans |
| ----- | ----------: | --------: | -------: | -----: | ------: | ------: |
| Tenant | | | | | | |
| Permission | | | | | | |
| Role | | | | | | |
| RolePermission | | | | | | |
| User | | | | | | |
| UserSkill | | | | | | |
| Site | | | | | | |
| FunctionalLocation | | | | | | |
| Asset | | | | | | |
| Vehicle | | | | | | |
| MaintenanceRequest | | | | | | |
| WorkOrder | | | | | | |
| ApprovalRequest | | | | | | |
| PmPlan | | | | | | |
| AssetMeter | | | | | | |
| Inspection | | | | | | |
| ComplianceRequirement | | | | | | |
| SparePart | | | | | | |
| Supplier | | | | | | |
| WorkOrderCostSnapshot | | | | | | |
| AuditLog | | | | | | |

**Status as of Phase 15 engineering:** tables **empty / not executed** — no live Mongo→SQL apply on engineer host (SQL Server unavailable).

## Business invariants (post-apply checklist)

- [ ] Converted MaintenanceRequest → correct WorkOrder id
- [ ] WorkOrder asset/FL FKs valid
- [ ] Approval Request→Step→Decision chain
- [ ] PM Plan→Revision→Generated WO
- [ ] Vehicle.assetId unique preserved
- [ ] Parts issued − returned = consumption
- [ ] Cost snapshot decimals unchanged vs source
- [ ] Audit entityId still resolvable
- [ ] No cross-tenant FK leakage
