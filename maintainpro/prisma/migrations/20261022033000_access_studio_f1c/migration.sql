-- Additive. Nullable expiry on overrides and a tenant access-config version.
IF COL_LENGTH(N'dbo.UserPermissionOverride', N'expiresAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[UserPermissionOverride] ADD [expiresAt] DATETIME2 NULL;
END

IF COL_LENGTH(N'dbo.Tenant', N'accessConfigVersion') IS NULL
BEGIN
    ALTER TABLE [dbo].[Tenant] ADD [accessConfigVersion] INT NOT NULL
        CONSTRAINT [Tenant_accessConfigVersion_df] DEFAULT 0;
END
