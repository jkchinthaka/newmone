IF OBJECT_ID(N'dbo.StockCountSession', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[StockCountSession] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [warehouseId] NVARCHAR(36) NOT NULL,
    [countType] NVARCHAR(32) NOT NULL CONSTRAINT [StockCountSession_countType_df] DEFAULT 'CYCLE',
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [StockCountSession_status_df] DEFAULT 'DRAFT',
    [blindCount] BIT NOT NULL CONSTRAINT [StockCountSession_blindCount_df] DEFAULT 0,
    [notes] NVARCHAR(Max) NULL,
    [createdById] NVARCHAR(36) NULL,
    [approvedById] NVARCHAR(36) NULL,
    [postedById] NVARCHAR(36) NULL,
    [approvedAt] DATETIME2 NULL,
    [postedAt] DATETIME2 NULL,
    [cancelledAt] DATETIME2 NULL,
    [cancelReason] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StockCountSession_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [StockCountSession_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [StockCountSession_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [StockCountSession_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[Warehouse]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
  CREATE INDEX [StockCountSession_tenantId_status_createdAt_idx] ON [dbo].[StockCountSession]([tenantId], [status], [createdAt]);
  CREATE INDEX [StockCountSession_tenantId_warehouseId_status_idx] ON [dbo].[StockCountSession]([tenantId], [warehouseId], [status]);
END;

IF OBJECT_ID(N'dbo.StockCountLine', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[StockCountLine] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [sessionId] NVARCHAR(36) NOT NULL,
    [partId] NVARCHAR(36) NOT NULL,
    [expectedQuantity] INT NOT NULL CONSTRAINT [StockCountLine_expectedQuantity_df] DEFAULT 0,
    [countedQuantity] INT NULL,
    [variance] INT NULL,
    [notes] NVARCHAR(1000) NULL,
    [adjustmentMovementId] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StockCountLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [StockCountLine_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [StockCountLine_sessionId_partId_key] UNIQUE NONCLUSTERED ([sessionId], [partId]),
    CONSTRAINT [StockCountLine_sessionId_fkey] FOREIGN KEY ([sessionId]) REFERENCES [dbo].[StockCountSession]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [StockCountLine_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  );
  CREATE INDEX [StockCountLine_tenantId_sessionId_idx] ON [dbo].[StockCountLine]([tenantId], [sessionId]);
  CREATE INDEX [StockCountLine_tenantId_partId_idx] ON [dbo].[StockCountLine]([tenantId], [partId]);
END;