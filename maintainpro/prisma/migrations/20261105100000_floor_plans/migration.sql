-- Floor plans with asset pins (additive).
CREATE TABLE [dbo].[FloorPlan] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [siteId] NVARCHAR(36) NULL,
    [imageData] NVARCHAR(MAX) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [FloorPlan_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FloorPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [FloorPlan_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[FloorPlanPin] (
    [id] NVARCHAR(36) NOT NULL,
    [floorPlanId] NVARCHAR(36) NOT NULL,
    [assetId] NVARCHAR(36) NOT NULL,
    [x] FLOAT(53) NOT NULL,
    [y] FLOAT(53) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FloorPlanPin_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [FloorPlanPin_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FloorPlanPin_floorPlanId_assetId_key] UNIQUE NONCLUSTERED ([floorPlanId],[assetId])
);

CREATE NONCLUSTERED INDEX [FloorPlan_tenantId_isActive_idx] ON [dbo].[FloorPlan]([tenantId], [isActive]);
CREATE NONCLUSTERED INDEX [FloorPlanPin_assetId_idx] ON [dbo].[FloorPlanPin]([assetId]);

ALTER TABLE [dbo].[FloorPlan] ADD CONSTRAINT [FloorPlan_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[FloorPlanPin] ADD CONSTRAINT [FloorPlanPin_floorPlanId_fkey] FOREIGN KEY ([floorPlanId]) REFERENCES [dbo].[FloorPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
