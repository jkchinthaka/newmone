-- WorkOrder lookups by vehicle, department and creator had no index (vehicle job lists and history,
-- department filters, "created by me"). Additive only: no column or data change.
-- Run in a quiet window: on SQL Server editions without online index builds the table is briefly locked.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'WorkOrder_tenantId_vehicleId_idx' AND object_id = OBJECT_ID(N'dbo.WorkOrder'))
  CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_vehicleId_idx] ON [dbo].[WorkOrder]([tenantId], [vehicleId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'WorkOrder_tenantId_departmentId_idx' AND object_id = OBJECT_ID(N'dbo.WorkOrder'))
  CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_departmentId_idx] ON [dbo].[WorkOrder]([tenantId], [departmentId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'WorkOrder_tenantId_createdById_idx' AND object_id = OBJECT_ID(N'dbo.WorkOrder'))
  CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_createdById_idx] ON [dbo].[WorkOrder]([tenantId], [createdById]);
