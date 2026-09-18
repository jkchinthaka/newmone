-- Ensure WorkOrder lifecycle fields have real defaults and backfill blank rows.
DECLARE @constraintName NVARCHAR(256);

SELECT @constraintName = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
INNER JOIN sys.tables t ON t.object_id = c.object_id
WHERE t.name = N'WorkOrder' AND c.name = N'status';
IF @constraintName IS NOT NULL EXEC(N'ALTER TABLE [dbo].[WorkOrder] DROP CONSTRAINT [' + @constraintName + N']');

SET @constraintName = NULL;
SELECT @constraintName = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
INNER JOIN sys.tables t ON t.object_id = c.object_id
WHERE t.name = N'WorkOrder' AND c.name = N'priority';
IF @constraintName IS NOT NULL EXEC(N'ALTER TABLE [dbo].[WorkOrder] DROP CONSTRAINT [' + @constraintName + N']');

SET @constraintName = NULL;
SELECT @constraintName = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
INNER JOIN sys.tables t ON t.object_id = c.object_id
WHERE t.name = N'WorkOrder' AND c.name = N'approvalStatus';
IF @constraintName IS NOT NULL EXEC(N'ALTER TABLE [dbo].[WorkOrder] DROP CONSTRAINT [' + @constraintName + N']');

ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_status_df] DEFAULT N'OPEN' FOR [status];
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_priority_df] DEFAULT N'MEDIUM' FOR [priority];
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_approvalStatus_df] DEFAULT N'NOT_REQUIRED' FOR [approvalStatus];

UPDATE [dbo].[WorkOrder]
SET [status] = N'OPEN'
WHERE [status] IS NULL OR LTRIM(RTRIM([status])) = N'';

UPDATE [dbo].[WorkOrder]
SET [priority] = N'MEDIUM'
WHERE [priority] IS NULL OR LTRIM(RTRIM([priority])) = N'';

UPDATE [dbo].[WorkOrder]
SET [approvalStatus] = N'NOT_REQUIRED'
WHERE [approvalStatus] IS NULL OR LTRIM(RTRIM([approvalStatus])) = N'';
