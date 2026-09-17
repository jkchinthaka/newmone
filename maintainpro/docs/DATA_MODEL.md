# Data Model (Enterprise additions)

Primary schema: `prisma/schema.prisma` (SQL Server).

## Recent enterprise models

| Model | Purpose |
|-------|---------|
| WorkflowDefinition / WorkflowVersion | Versioned WO workflow publish |
| NumberingSequence | Tenant document numbering |
| TemporaryRepairRecord | Temporary repair + follow-up WO |
| VendorPortalAccess | Vendor user isolation |
| MeterCorrection | Meter correction with SoD approval |
| ApprovalDelegation | Approver delegation windows |
| ServiceApiKey | Integration API keys (hashed) |
| CustomFieldDefinition | Controlled dynamic fields |
| SoDPolicy | Configurable segregation of duties |
| OutboundWebhook / Delivery | Outbound event delivery |
| ConfigChangeHistory | Config audit trail |
| DowntimeSegment / RcaCase / CapaAction | Reliability |
| WorkPermit / LotoRecord | Safety |
| ConditionMonitoringRule / Event | CBM |

## Reporting views

Migration `20260917230000_reporting_views` creates `vw_rpt_*` for Power BI (see `docs/POWER_BI.md`).
