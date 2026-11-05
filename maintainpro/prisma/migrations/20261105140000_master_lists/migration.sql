-- Master lists (units, skills, makes) and work calendar (additive).
CREATE TABLE [dbo].[MasterListItem] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [kind] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [code] NVARCHAR(40) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [MasterListItem_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MasterListItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MasterListItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MasterListItem_tenantId_kind_name_key] UNIQUE NONCLUSTERED ([tenantId],[kind],[name])
);
CREATE NONCLUSTERED INDEX [MasterListItem_tenantId_kind_isActive_idx] ON [dbo].[MasterListItem]([tenantId], [kind], [isActive]);
ALTER TABLE [dbo].[MasterListItem] ADD CONSTRAINT [MasterListItem_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [dbo].[WorkCalendarEntry] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [kind] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [date] DATETIME2 NULL,
    [startTime] NVARCHAR(5) NULL,
    [endTime] NVARCHAR(5) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [WorkCalendarEntry_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkCalendarEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkCalendarEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [WorkCalendarEntry_tenantId_kind_isActive_idx] ON [dbo].[WorkCalendarEntry]([tenantId], [kind], [isActive]);
ALTER TABLE [dbo].[WorkCalendarEntry] ADD CONSTRAINT [WorkCalendarEntry_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
