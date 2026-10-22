-- Additive. Does not alter or drop existing tables.
IF OBJECT_ID(N'[dbo].[UserPermissionOverride]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[UserPermissionOverride] (
        [id] NVARCHAR(36) NOT NULL,
        [tenantId] NVARCHAR(36) NOT NULL,
        [userId] NVARCHAR(36) NOT NULL,
        [permissionKey] NVARCHAR(191) NOT NULL,
        [effect] NVARCHAR(8) NOT NULL,
        [reason] NVARCHAR(MAX) NOT NULL,
        [createdById] NVARCHAR(36) NOT NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [UserPermissionOverride_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [UserPermissionOverride_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [UserPermissionOverride_tenantId_userId_permissionKey_key] UNIQUE NONCLUSTERED ([tenantId], [userId], [permissionKey])
    );

    ALTER TABLE [dbo].[UserPermissionOverride]
        ADD CONSTRAINT [UserPermissionOverride_tenantId_fkey]
        FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

    ALTER TABLE [dbo].[UserPermissionOverride]
        ADD CONSTRAINT [UserPermissionOverride_userId_fkey]
        FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

    ALTER TABLE [dbo].[UserPermissionOverride]
        ADD CONSTRAINT [UserPermissionOverride_createdById_fkey]
        FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

    CREATE NONCLUSTERED INDEX [UserPermissionOverride_tenantId_userId_idx]
        ON [dbo].[UserPermissionOverride]([tenantId], [userId]);
END
