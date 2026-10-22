IF OBJECT_ID(N'dbo.GateCheck', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[GateCheck] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [checkedById] NVARCHAR(36) NOT NULL,
    [result] NVARCHAR(16) NOT NULL,
    [reasons] NVARCHAR(Max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GateCheck_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [GateCheck_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GateCheck_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [GateCheck_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [GateCheck_checkedById_fkey] FOREIGN KEY ([checkedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
  CREATE INDEX [GateCheck_tenantId_createdAt_idx] ON [dbo].[GateCheck]([tenantId], [createdAt]);
  CREATE INDEX [GateCheck_tenantId_vehicleId_idx] ON [dbo].[GateCheck]([tenantId], [vehicleId]);
END;
