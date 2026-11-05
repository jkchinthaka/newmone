-- Change request master data: requester groups (+ members) and spare part categories. Additive only.
CREATE TABLE [dbo].[RequesterGroup] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [departmentId] NVARCHAR(36),
    [isActive] BIT NOT NULL CONSTRAINT [RequesterGroup_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RequesterGroup_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RequesterGroup_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RequesterGroup_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

CREATE TABLE [dbo].[RequesterGroupMember] (
    [id] NVARCHAR(36) NOT NULL,
    [groupId] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RequesterGroupMember_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RequesterGroupMember_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RequesterGroupMember_groupId_userId_key] UNIQUE NONCLUSTERED ([groupId],[userId])
);

CREATE TABLE [dbo].[SparePartCategory] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(450) NOT NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [SparePartCategory_sortOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [SparePartCategory_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SparePartCategory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SparePartCategory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SparePartCategory_tenantId_name_key] UNIQUE NONCLUSTERED ([tenantId],[name])
);

CREATE NONCLUSTERED INDEX [RequesterGroup_tenantId_isActive_idx] ON [dbo].[RequesterGroup]([tenantId], [isActive]);
CREATE NONCLUSTERED INDEX [RequesterGroupMember_userId_idx] ON [dbo].[RequesterGroupMember]([userId]);
CREATE NONCLUSTERED INDEX [SparePartCategory_tenantId_isActive_idx] ON [dbo].[SparePartCategory]([tenantId], [isActive]);

ALTER TABLE [dbo].[RequesterGroup] ADD CONSTRAINT [RequesterGroup_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[RequesterGroupMember] ADD CONSTRAINT [RequesterGroupMember_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[RequesterGroup]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[RequesterGroupMember] ADD CONSTRAINT [RequesterGroupMember_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SparePartCategory] ADD CONSTRAINT [SparePartCategory_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
