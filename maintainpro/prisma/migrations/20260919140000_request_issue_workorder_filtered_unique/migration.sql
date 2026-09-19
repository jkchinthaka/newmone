-- SQL Server: nullable UNIQUE on MaintenanceRequest.workOrderId / FacilityIssue.workOrderId
-- allows only ONE NULL row. Unconverted requests/issues all have workOrderId = NULL, so a
-- second create fails with P2002 ("record already exists") even when requestNumber is unique.
-- Same filtered-index pattern as Vehicle.assetId (20260916120000).

-- ===== MaintenanceRequest.workOrderId =====
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = N'MaintenanceRequest_workOrderId_key'
    AND parent_object_id = OBJECT_ID(N'dbo.MaintenanceRequest')
)
  ALTER TABLE [dbo].[MaintenanceRequest] DROP CONSTRAINT [MaintenanceRequest_workOrderId_key];
ELSE IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'MaintenanceRequest_workOrderId_key'
    AND object_id = OBJECT_ID(N'dbo.MaintenanceRequest')
)
  DROP INDEX [MaintenanceRequest_workOrderId_key] ON [dbo].[MaintenanceRequest];

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'MaintenanceRequest_workOrderId_key'
    AND object_id = OBJECT_ID(N'dbo.MaintenanceRequest')
)
  CREATE UNIQUE NONCLUSTERED INDEX [MaintenanceRequest_workOrderId_key]
    ON [dbo].[MaintenanceRequest]([workOrderId])
    WHERE [workOrderId] IS NOT NULL;

-- ===== FacilityIssue.workOrderId =====
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = N'FacilityIssue_workOrderId_key'
    AND parent_object_id = OBJECT_ID(N'dbo.FacilityIssue')
)
  ALTER TABLE [dbo].[FacilityIssue] DROP CONSTRAINT [FacilityIssue_workOrderId_key];
ELSE IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'FacilityIssue_workOrderId_key'
    AND object_id = OBJECT_ID(N'dbo.FacilityIssue')
)
  DROP INDEX [FacilityIssue_workOrderId_key] ON [dbo].[FacilityIssue];

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'FacilityIssue_workOrderId_key'
    AND object_id = OBJECT_ID(N'dbo.FacilityIssue')
)
  CREATE UNIQUE NONCLUSTERED INDEX [FacilityIssue_workOrderId_key]
    ON [dbo].[FacilityIssue]([workOrderId])
    WHERE [workOrderId] IS NOT NULL;
