-- Job sub-tasks with per-task assignees (additive).
CREATE TABLE [dbo].[WorkOrderTask] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [title] NVARCHAR(300) NOT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [WorkOrderTask_status_df] DEFAULT 'NOT_STARTED',
    [sortOrder] INT NOT NULL CONSTRAINT [WorkOrderTask_sortOrder_df] DEFAULT 0,
    [estimatedHours] FLOAT(53) NULL,
    [startedAt] DATETIME2 NULL,
    [completedAt] DATETIME2 NULL,
    [timeSpentMinutes] INT NULL,
    [completedById] NVARCHAR(36) NULL,
    [createdById] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderTask_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderTask_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[WorkOrderTaskAssignee] (
    [id] NVARCHAR(36) NOT NULL,
    [taskId] NVARCHAR(36) NOT NULL,
    [employeeId] NVARCHAR(36) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderTaskAssignee_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WorkOrderTaskAssignee_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrderTaskAssignee_taskId_employeeId_key] UNIQUE NONCLUSTERED ([taskId],[employeeId])
);

CREATE NONCLUSTERED INDEX [WorkOrderTask_workOrderId_sortOrder_idx] ON [dbo].[WorkOrderTask]([workOrderId], [sortOrder]);
CREATE NONCLUSTERED INDEX [WorkOrderTask_tenantId_idx] ON [dbo].[WorkOrderTask]([tenantId]);
CREATE NONCLUSTERED INDEX [WorkOrderTaskAssignee_employeeId_idx] ON [dbo].[WorkOrderTaskAssignee]([employeeId]);

ALTER TABLE [dbo].[WorkOrderTask] ADD CONSTRAINT [WorkOrderTask_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderTaskAssignee] ADD CONSTRAINT [WorkOrderTaskAssignee_taskId_fkey] FOREIGN KEY ([taskId]) REFERENCES [dbo].[WorkOrderTask]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderTaskAssignee] ADD CONSTRAINT [WorkOrderTaskAssignee_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
