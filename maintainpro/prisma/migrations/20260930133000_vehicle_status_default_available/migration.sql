-- New vehicles default to AVAILABLE. Existing blank statuses stay blank and remain ineligible for gate-out.
DECLARE @constraint sysname;
SELECT @constraint = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
INNER JOIN sys.tables t ON t.object_id = c.object_id
WHERE t.name = N'Vehicle' AND c.name = N'status';

IF @constraint IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[Vehicle] DROP CONSTRAINT [' + @constraint + N']');

ALTER TABLE [dbo].[Vehicle] ADD CONSTRAINT [DF_Vehicle_status_AVAILABLE] DEFAULT N'AVAILABLE' FOR [status];
