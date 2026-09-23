-- Link WorkOrder to tenant/domain MaintenanceJobCategory (nullable, non-destructive).

ALTER TABLE [dbo].[WorkOrder] ADD [jobCategoryId] NVARCHAR(36) NULL;

CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_jobCategoryId_idx]
  ON [dbo].[WorkOrder]([tenantId], [jobCategoryId]);

ALTER TABLE [dbo].[WorkOrder]
  ADD CONSTRAINT [WorkOrder_jobCategoryId_fkey]
  FOREIGN KEY ([jobCategoryId]) REFERENCES [dbo].[MaintenanceJobCategory]([id])
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;
