BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Tenant] (
    [id] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [slug] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Tenant_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Tenant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Tenant_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Tenant_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [entity] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(64) NOT NULL,
    [module] NVARCHAR(1000),
    [reason] NVARCHAR(1000),
    [actorId] NVARCHAR(36),
    [ipAddress] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [requestPath] NVARCHAR(1000),
    [actorSnapshot] NVARCHAR(max),
    [metadata] NVARCHAR(max),
    [beforeData] NVARCHAR(max),
    [afterData] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SecurityEvent] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [actorId] NVARCHAR(36),
    [eventType] NVARCHAR(1000) NOT NULL,
    [outcome] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000),
    [reasonCode] NVARCHAR(1000),
    [sourceCategory] NVARCHAR(1000) NOT NULL CONSTRAINT [SecurityEvent_sourceCategory_df] DEFAULT 'AUTH',
    [identifierFingerprint] NVARCHAR(1000),
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SecurityEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SecurityEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OperationalAlert] (
    [id] NVARCHAR(36) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [fingerprint] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(64) NOT NULL,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [OperationalAlert_status_df] DEFAULT '',
    [source] NVARCHAR(1000) NOT NULL,
    [safeSummary] NVARCHAR(1000) NOT NULL,
    [firstObservedAt] DATETIME2 NOT NULL CONSTRAINT [OperationalAlert_firstObservedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [lastObservedAt] DATETIME2 NOT NULL CONSTRAINT [OperationalAlert_lastObservedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [occurrenceCount] INT NOT NULL CONSTRAINT [OperationalAlert_occurrenceCount_df] DEFAULT 1,
    [acknowledgedAt] DATETIME2,
    [acknowledgedById] NVARCHAR(36),
    [resolvedAt] DATETIME2,
    [resolutionReason] NVARCHAR(1000),
    [lastNotificationAt] DATETIME2,
    [cooldownUntil] DATETIME2,
    [tenantId] NVARCHAR(36),
    [metadataSafe] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OperationalAlert_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OperationalAlert_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AppSetting] (
    [id] NVARCHAR(36) NOT NULL,
    [scope] NVARCHAR(64) NOT NULL CONSTRAINT [AppSetting_scope_df] DEFAULT '',
    [scopeId] NVARCHAR(1000) NOT NULL CONSTRAINT [AppSetting_scopeId_df] DEFAULT 'GLOBAL',
    [key] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(max) NOT NULL,
    [isSecret] BIT NOT NULL CONSTRAINT [AppSetting_isSecret_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AppSetting_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AppSetting_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AppSetting_scope_scopeId_key_key] UNIQUE NONCLUSTERED ([scope],[scopeId],[key])
);

-- CreateTable
CREATE TABLE [dbo].[ReplicationOutbox] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [operation] NVARCHAR(64) NOT NULL,
    [payload] NVARCHAR(max),
    [modelName] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [ReplicationOutbox_status_df] DEFAULT '',
    [attemptCount] INT NOT NULL CONSTRAINT [ReplicationOutbox_attemptCount_df] DEFAULT 0,
    [lastError] NVARCHAR(1000),
    [nextRetryAt] DATETIME2 NOT NULL CONSTRAINT [ReplicationOutbox_nextRetryAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ReplicationOutbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [syncedAt] DATETIME2,
    [sourceDatabase] NVARCHAR(1000) NOT NULL CONSTRAINT [ReplicationOutbox_sourceDatabase_df] DEFAULT 'primary',
    [targetDatabase] NVARCHAR(1000) NOT NULL CONSTRAINT [ReplicationOutbox_targetDatabase_df] DEFAULT 'backup',
    [correlationId] NVARCHAR(1000) NOT NULL,
    [actorUserId] NVARCHAR(36),
    CONSTRAINT [ReplicationOutbox_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Permission] (
    [id] NVARCHAR(36) NOT NULL,
    [key] NVARCHAR(191) NOT NULL,
    [description] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Permission_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Permission_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Permission_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [email] NVARCHAR(1000) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [firstName] NVARCHAR(1000) NOT NULL,
    [lastName] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000),
    [avatar] NVARCHAR(1000),
    [roleId] NVARCHAR(36) NOT NULL,
    [departmentId] NVARCHAR(36),
    [designation] NVARCHAR(1000),
    [dailyCapacityHours] FLOAT(53) NOT NULL CONSTRAINT [User_dailyCapacityHours_df] DEFAULT 8,
    [mustChangePassword] BIT NOT NULL CONSTRAINT [User_mustChangePassword_df] DEFAULT 0,
    [branchScope] NVARCHAR(1000),
    [temporaryPasswordExpiresAt] DATETIME2,
    [lastPasswordChangedAt] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [lastLogin] DATETIME2,
    [failedLoginAttempts] INT NOT NULL CONSTRAINT [User_failedLoginAttempts_df] DEFAULT 0,
    [lockedUntil] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[RefreshToken] (
    [id] NVARCHAR(36) NOT NULL,
    [tokenHash] NVARCHAR(1000) NOT NULL,
    [familyId] NVARCHAR(1000) NOT NULL,
    [replacedByTokenHash] NVARCHAR(1000),
    [userId] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [deviceInfo] NVARCHAR(1000),
    [ipAddress] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [lastUsedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RefreshToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RefreshToken_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RefreshToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[PasswordResetToken] (
    [id] NVARCHAR(36) NOT NULL,
    [tokenHash] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [usedAt] DATETIME2,
    [ipAddress] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PasswordResetToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PasswordResetToken_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PasswordResetToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [name] NVARCHAR(64) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TenantMembership] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [membershipRole] NVARCHAR(64) NOT NULL CONSTRAINT [TenantMembership_membershipRole_df] DEFAULT '',
    [joinedAt] DATETIME2 NOT NULL CONSTRAINT [TenantMembership_joinedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TenantMembership_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TenantMembership_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TenantMembership_tenantId_userId_key] UNIQUE NONCLUSTERED ([tenantId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[TenantInvitation] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [firstName] NVARCHAR(1000),
    [lastName] NVARCHAR(1000),
    [membershipRole] NVARCHAR(64) NOT NULL CONSTRAINT [TenantInvitation_membershipRole_df] DEFAULT '',
    [invitedById] NVARCHAR(36) NOT NULL,
    [token] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [TenantInvitation_status_df] DEFAULT '',
    [expiresAt] DATETIME2 NOT NULL,
    [acceptedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TenantInvitation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TenantInvitation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TenantInvitation_token_key] UNIQUE NONCLUSTERED ([token])
);

-- CreateTable
CREATE TABLE [dbo].[UserInvitation] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [userId] NVARCHAR(36) NOT NULL,
    [tokenHash] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [acceptedAt] DATETIME2,
    [invitedById] NVARCHAR(36) NOT NULL,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [UserInvitation_status_df] DEFAULT '',
    [lastInvitationSentAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UserInvitation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [UserInvitation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserInvitation_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[Plan] (
    [id] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Plan_isActive_df] DEFAULT 1,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [Plan_currency_df] DEFAULT 'USD',
    [priceMonthly] FLOAT(53) NOT NULL CONSTRAINT [Plan_priceMonthly_df] DEFAULT 0,
    [priceYearly] FLOAT(53) NOT NULL CONSTRAINT [Plan_priceYearly_df] DEFAULT 0,
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Plan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Plan_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Plan_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Subscription] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [planId] NVARCHAR(36) NOT NULL,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [Subscription_status_df] DEFAULT '',
    [billingInterval] NVARCHAR(64) NOT NULL CONSTRAINT [Subscription_billingInterval_df] DEFAULT '',
    [seats] INT NOT NULL CONSTRAINT [Subscription_seats_df] DEFAULT 5,
    [isCurrent] BIT NOT NULL CONSTRAINT [Subscription_isCurrent_df] DEFAULT 1,
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [Subscription_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [currentPeriodStart] DATETIME2 NOT NULL CONSTRAINT [Subscription_currentPeriodStart_df] DEFAULT CURRENT_TIMESTAMP,
    [currentPeriodEnd] DATETIME2,
    [cancelAtPeriodEnd] BIT NOT NULL CONSTRAINT [Subscription_cancelAtPeriodEnd_df] DEFAULT 0,
    [canceledAt] DATETIME2,
    [stripeSubscriptionId] NVARCHAR(1000),
    [stripePriceId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Subscription_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Subscription_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Subscription_stripeSubscriptionId_key] UNIQUE NONCLUSTERED ([stripeSubscriptionId])
);

-- CreateTable
CREATE TABLE [dbo].[Entitlement] (
    [id] NVARCHAR(36) NOT NULL,
    [planId] NVARCHAR(36) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(64) NOT NULL CONSTRAINT [Entitlement_type_df] DEFAULT '',
    [enabled] BIT NOT NULL CONSTRAINT [Entitlement_enabled_df] DEFAULT 1,
    [limitValue] INT,
    [unit] NVARCHAR(1000),
    [overageRate] FLOAT(53),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Entitlement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Entitlement_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Entitlement_planId_key_key] UNIQUE NONCLUSTERED ([planId],[key])
);

-- CreateTable
CREATE TABLE [dbo].[UsageMetric] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [window] NVARCHAR(64) NOT NULL CONSTRAINT [UsageMetric_window_df] DEFAULT '',
    [periodStart] DATETIME2 NOT NULL,
    [periodEnd] DATETIME2 NOT NULL,
    [value] INT NOT NULL CONSTRAINT [UsageMetric_value_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UsageMetric_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [UsageMetric_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UsageMetric_tenantId_key_window_periodStart_key] UNIQUE NONCLUSTERED ([tenantId],[key],[window],[periodStart])
);

-- CreateTable
CREATE TABLE [dbo].[UsageEvent] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(64) NOT NULL CONSTRAINT [UsageEvent_eventType_df] DEFAULT '',
    [quantity] INT NOT NULL CONSTRAINT [UsageEvent_quantity_df] DEFAULT 1,
    [metadata] NVARCHAR(max),
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [UsageEvent_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [UsageEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[StripeCustomer] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [customerId] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000),
    [name] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StripeCustomer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [StripeCustomer_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [StripeCustomer_tenantId_key] UNIQUE NONCLUSTERED ([tenantId]),
    CONSTRAINT [StripeCustomer_customerId_key] UNIQUE NONCLUSTERED ([customerId])
);

-- CreateTable
CREATE TABLE [dbo].[StripeInvoice] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [subscriptionId] NVARCHAR(36),
    [stripeInvoiceId] NVARCHAR(1000) NOT NULL,
    [invoiceNumber] NVARCHAR(1000),
    [amountDue] FLOAT(53) NOT NULL CONSTRAINT [StripeInvoice_amountDue_df] DEFAULT 0,
    [amountPaid] FLOAT(53) NOT NULL CONSTRAINT [StripeInvoice_amountPaid_df] DEFAULT 0,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [StripeInvoice_currency_df] DEFAULT 'usd',
    [status] NVARCHAR(1000) NOT NULL,
    [hostedInvoiceUrl] NVARCHAR(1000),
    [invoicePdf] NVARCHAR(1000),
    [dueDate] DATETIME2,
    [paidAt] DATETIME2,
    [periodStart] DATETIME2,
    [periodEnd] DATETIME2,
    [raw] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StripeInvoice_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [StripeInvoice_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [StripeInvoice_stripeInvoiceId_key] UNIQUE NONCLUSTERED ([stripeInvoiceId])
);

-- CreateTable
CREATE TABLE [dbo].[Department] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [name] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Department_isActive_df] DEFAULT 1,
    [parentId] NVARCHAR(36),
    [managerId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Department_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Department_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Department_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[Asset] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [assetTag] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [category] NVARCHAR(64) NOT NULL,
    [condition] NVARCHAR(64) NOT NULL CONSTRAINT [Asset_condition_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [Asset_status_df] DEFAULT '',
    [purchaseDate] DATETIME2,
    [purchasePrice] FLOAT(53),
    [supplier] NVARCHAR(1000),
    [department] NVARCHAR(1000),
    [departmentId] NVARCHAR(36),
    [ownerName] NVARCHAR(1000),
    [currentValue] FLOAT(53),
    [location] NVARCHAR(1000),
    [manufacturer] NVARCHAR(1000),
    [model] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [meterReading] FLOAT(53),
    [lastServiceDate] DATETIME2,
    [nextServiceDate] DATETIME2,
    [warrantyExpiry] DATETIME2,
    [criticality] NVARCHAR(1000),
    [criticalityLevel] NVARCHAR(64),
    [disposalDate] DATETIME2,
    [disposalReason] NVARCHAR(1000),
    [retiredAt] DATETIME2,
    [retirementReason] NVARCHAR(1000),
    [commissionedAt] DATETIME2,
    [archivedAt] DATETIME2,
    [images] NVARCHAR(max) NOT NULL CONSTRAINT [Asset_images_df] DEFAULT '[]',
    [documents] NVARCHAR(max) NOT NULL CONSTRAINT [Asset_documents_df] DEFAULT '[]',
    [qrCodeUrl] NVARCHAR(1000),
    [domainId] NVARCHAR(36),
    [categoryMasterId] NVARCHAR(36),
    [typeMasterId] NVARCHAR(36),
    [siteId] NVARCHAR(36),
    [functionalLocationId] NVARCHAR(36),
    [parentAssetId] NVARCHAR(36),
    [responsiblePersonId] NVARCHAR(36),
    [customAttributes] NVARCHAR(max),
    [isActive] BIT NOT NULL CONSTRAINT [Asset_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Asset_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Asset_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Asset_assetTag_key] UNIQUE NONCLUSTERED ([assetTag])
);

-- CreateTable
CREATE TABLE [dbo].[AssetDomain] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [sortOrder] INT NOT NULL CONSTRAINT [AssetDomain_sortOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [AssetDomain_isActive_df] DEFAULT 1,
    [profile] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetDomain_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AssetDomain_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AssetDomain_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[AssetCategoryMaster] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [domainId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [legacyEnum] NVARCHAR(64),
    [isActive] BIT NOT NULL CONSTRAINT [AssetCategoryMaster_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetCategoryMaster_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AssetCategoryMaster_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AssetCategoryMaster_tenantId_domainId_code_key] UNIQUE NONCLUSTERED ([tenantId],[domainId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[AssetTypeMaster] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [categoryId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [AssetTypeMaster_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetTypeMaster_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AssetTypeMaster_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AssetTypeMaster_tenantId_categoryId_code_key] UNIQUE NONCLUSTERED ([tenantId],[categoryId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[AssetAttributeDefinition] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [typeMasterId] NVARCHAR(36) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [dataType] NVARCHAR(64) NOT NULL,
    [unit] NVARCHAR(1000),
    [required] BIT NOT NULL CONSTRAINT [AssetAttributeDefinition_required_df] DEFAULT 0,
    [options] NVARCHAR(max) NOT NULL CONSTRAINT [AssetAttributeDefinition_options_df] DEFAULT '[]',
    [minValue] FLOAT(53),
    [maxValue] FLOAT(53),
    [displayOrder] INT NOT NULL CONSTRAINT [AssetAttributeDefinition_displayOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [AssetAttributeDefinition_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetAttributeDefinition_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AssetAttributeDefinition_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AssetAttributeDefinition_tenantId_typeMasterId_key_key] UNIQUE NONCLUSTERED ([tenantId],[typeMasterId],[key])
);

-- CreateTable
CREATE TABLE [dbo].[AssetLocationHistory] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [assetId] NVARCHAR(36) NOT NULL,
    [fromSiteId] NVARCHAR(36),
    [fromFunctionalLocationId] NVARCHAR(36),
    [toSiteId] NVARCHAR(36) NOT NULL,
    [toFunctionalLocationId] NVARCHAR(36) NOT NULL,
    [effectiveAt] DATETIME2 NOT NULL CONSTRAINT [AssetLocationHistory_effectiveAt_df] DEFAULT CURRENT_TIMESTAMP,
    [reason] NVARCHAR(1000) NOT NULL,
    [movedById] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetLocationHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AssetLocationHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Vehicle] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [registrationNo] NVARCHAR(1000) NOT NULL,
    [assetTag] NVARCHAR(1000),
    [assetId] NVARCHAR(36),
    [make] NVARCHAR(1000) NOT NULL,
    [vehicleModel] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [location] NVARCHAR(1000),
    [year] INT NOT NULL,
    [type] NVARCHAR(64) NOT NULL,
    [ownershipType] NVARCHAR(64) NOT NULL CONSTRAINT [Vehicle_ownershipType_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [Vehicle_status_df] DEFAULT '',
    [serviceStatus] NVARCHAR(64) NOT NULL CONSTRAINT [Vehicle_serviceStatus_df] DEFAULT '',
    [color] NVARCHAR(1000),
    [vin] NVARCHAR(1000),
    [engineNo] NVARCHAR(1000),
    [vendorName] NVARCHAR(1000),
    [costCenter] NVARCHAR(1000),
    [acquisitionDate] DATETIME2,
    [purchasePrice] FLOAT(53),
    [currentValue] FLOAT(53),
    [warrantyExpiry] DATETIME2,
    [fuelType] NVARCHAR(64) NOT NULL,
    [fuelCapacity] FLOAT(53),
    [currentMileage] FLOAT(53) NOT NULL CONSTRAINT [Vehicle_currentMileage_df] DEFAULT 0,
    [serviceIntervalDays] INT,
    [serviceIntervalMileage] FLOAT(53),
    [insuranceExpiry] DATETIME2,
    [roadTaxExpiry] DATETIME2,
    [complianceStatus] NVARCHAR(64) NOT NULL CONSTRAINT [Vehicle_complianceStatus_df] DEFAULT '',
    [complianceLastEvaluatedAt] DATETIME2,
    [lastServiceDate] DATETIME2,
    [nextServiceDate] DATETIME2,
    [nextServiceMileage] FLOAT(53),
    [decommissionedAt] DATETIME2,
    [decommissionReason] NVARCHAR(1000),
    [customFields] NVARCHAR(max),
    [gpsDeviceId] NVARCHAR(1000),
    [images] NVARCHAR(max) NOT NULL CONSTRAINT [Vehicle_images_df] DEFAULT '[]',
    [driverId] NVARCHAR(36),
    [departmentId] NVARCHAR(36),
    [gateBlocked] BIT NOT NULL CONSTRAINT [Vehicle_gateBlocked_df] DEFAULT 0,
    [gateBlockReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Vehicle_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Vehicle_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Vehicle_registrationNo_key] UNIQUE NONCLUSTERED ([registrationNo]),
    CONSTRAINT [Vehicle_assetId_key] UNIQUE NONCLUSTERED ([assetId]),
    CONSTRAINT [Vehicle_vin_key] UNIQUE NONCLUSTERED ([vin])
);

-- CreateTable
CREATE TABLE [dbo].[VehicleTyre] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [serialNumber] NVARCHAR(1000),
    [brand] NVARCHAR(1000),
    [size] NVARCHAR(1000),
    [tyreType] NVARCHAR(1000),
    [wheelPosition] NVARCHAR(1000),
    [installedAt] DATETIME2,
    [installedMileage] FLOAT(53),
    [removedAt] DATETIME2,
    [removedMileage] FLOAT(53),
    [rotatedAt] DATETIME2,
    [retreadCount] INT NOT NULL CONSTRAINT [VehicleTyre_retreadCount_df] DEFAULT 0,
    [condition] NVARCHAR(64) NOT NULL CONSTRAINT [VehicleTyre_condition_df] DEFAULT '',
    [isActive] BIT NOT NULL CONSTRAINT [VehicleTyre_isActive_df] DEFAULT 1,
    [costSnapshot] FLOAT(53),
    [warrantyExpiresAt] DATETIME2,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VehicleTyre_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VehicleTyre_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[VehicleBattery] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [serialNumber] NVARCHAR(1000),
    [brand] NVARCHAR(1000),
    [model] NVARCHAR(1000),
    [capacityAh] FLOAT(53),
    [installedAt] DATETIME2,
    [removedAt] DATETIME2,
    [warrantyExpiresAt] DATETIME2,
    [condition] NVARCHAR(1000),
    [failureReason] NVARCHAR(1000),
    [costSnapshot] FLOAT(53),
    [isActive] BIT NOT NULL CONSTRAINT [VehicleBattery_isActive_df] DEFAULT 1,
    [replacementWorkOrderId] NVARCHAR(36),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VehicleBattery_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VehicleBattery_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[VehicleAssignment] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [driverId] NVARCHAR(36) NOT NULL,
    [assignedAt] DATETIME2 NOT NULL CONSTRAINT [VehicleAssignment_assignedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [returnedAt] DATETIME2,
    [openingMileage] FLOAT(53),
    [closingMileage] FLOAT(53),
    [fuelLevelStart] FLOAT(53),
    [fuelLevelEnd] FLOAT(53),
    [conditionNotes] NVARCHAR(1000),
    [handoverChecklist] NVARCHAR(max),
    [assignedById] NVARCHAR(36),
    [returnedById] NVARCHAR(36),
    [notes] NVARCHAR(1000),
    [isCurrent] BIT NOT NULL CONSTRAINT [VehicleAssignment_isCurrent_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VehicleAssignment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VehicleAssignment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Driver] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [userId] NVARCHAR(36) NOT NULL,
    [licenseNumber] NVARCHAR(1000) NOT NULL,
    [licenseClass] NVARCHAR(1000) NOT NULL,
    [licenseExpiry] DATETIME2 NOT NULL,
    [isAvailable] BIT NOT NULL CONSTRAINT [Driver_isAvailable_df] DEFAULT 1,
    [trainingStatus] NVARCHAR(64) NOT NULL CONSTRAINT [Driver_trainingStatus_df] DEFAULT '',
    [trainingCompletedAt] DATETIME2,
    [trainingExpiry] DATETIME2,
    [supervisorReviewScore] INT,
    [pendingDisciplinaryIssues] INT NOT NULL CONSTRAINT [Driver_pendingDisciplinaryIssues_df] DEFAULT 0,
    [departmentId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Driver_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Driver_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Driver_userId_key] UNIQUE NONCLUSTERED ([userId]),
    CONSTRAINT [Driver_licenseNumber_key] UNIQUE NONCLUSTERED ([licenseNumber])
);

-- CreateTable
CREATE TABLE [dbo].[FuelLog] (
    [id] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [driverId] NVARCHAR(36),
    [date] DATETIME2 NOT NULL,
    [liters] FLOAT(53) NOT NULL,
    [costPerLiter] DECIMAL(18,2) NOT NULL,
    [totalCost] DECIMAL(18,2) NOT NULL,
    [mileageAtFuel] FLOAT(53) NOT NULL,
    [fuelStation] NVARCHAR(1000),
    [receiptUrl] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [clientActionId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FuelLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [FuelLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TripLog] (
    [id] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [driverId] NVARCHAR(36) NOT NULL,
    [startLocation] NVARCHAR(1000) NOT NULL,
    [endLocation] NVARCHAR(1000) NOT NULL,
    [startMileage] FLOAT(53) NOT NULL,
    [endMileage] FLOAT(53) NOT NULL,
    [distance] FLOAT(53) NOT NULL,
    [startTime] DATETIME2 NOT NULL,
    [endTime] DATETIME2,
    [purpose] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [TripLog_status_df] DEFAULT '',
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TripLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [TripLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[VehicleMeterLog] (
    [id] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [recordedById] NVARCHAR(36),
    [reading] FLOAT(53) NOT NULL,
    [readingType] NVARCHAR(64) NOT NULL CONSTRAINT [VehicleMeterLog_readingType_df] DEFAULT '',
    [source] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VehicleMeterLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [VehicleMeterLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[VehicleGateMovement] (
    [id] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [driverId] NVARCHAR(36),
    [movementType] NVARCHAR(64) NOT NULL,
    [status] NVARCHAR(64) NOT NULL,
    [meterReading] FLOAT(53) NOT NULL,
    [previousMileage] FLOAT(53),
    [blockedReason] NVARCHAR(1000),
    [overrideReason] NVARCHAR(1000),
    [approvedById] NVARCHAR(36),
    [gatePassNo] NVARCHAR(1000),
    [checkpoint] NVARCHAR(1000),
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [VehicleGateMovement_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VehicleGateMovement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [metadata] NVARCHAR(max),
    CONSTRAINT [VehicleGateMovement_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[GpsLocation] (
    [id] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [latitude] FLOAT(53) NOT NULL,
    [longitude] FLOAT(53) NOT NULL,
    [speed] FLOAT(53),
    [heading] FLOAT(53),
    [timestamp] DATETIME2 NOT NULL CONSTRAINT [GpsLocation_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [GpsLocation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[MaintenanceSchedule] (
    [id] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [type] NVARCHAR(64) NOT NULL,
    [frequency] NVARCHAR(64) NOT NULL,
    [intervalDays] INT,
    [intervalMileage] FLOAT(53),
    [assetId] NVARCHAR(36),
    [vehicleId] NVARCHAR(36),
    [nextDueDate] DATETIME2,
    [nextDueMileage] FLOAT(53),
    [nextDueHours] FLOAT(53),
    [intervalHours] FLOAT(53),
    [lastCompletedAt] DATETIME2,
    [lastCompletedMileage] FLOAT(53),
    [lastCompletedHours] FLOAT(53),
    [advancePolicy] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [MaintenanceSchedule_isActive_df] DEFAULT 1,
    [estimatedCost] FLOAT(53),
    [estimatedHours] FLOAT(53),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceSchedule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MaintenanceSchedule_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[JobCode] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [category] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [JobCode_isActive_df] DEFAULT 1,
    [parentId] NVARCHAR(36),
    [estimatedHours] FLOAT(53),
    [requiredSkills] NVARCHAR(max) NOT NULL CONSTRAINT [JobCode_requiredSkills_df] DEFAULT '[]',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [JobCode_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [JobCode_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [JobCode_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[MaintenanceLog] (
    [id] NVARCHAR(36) NOT NULL,
    [scheduleId] NVARCHAR(36),
    [assetId] NVARCHAR(36),
    [vehicleId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36),
    [description] NVARCHAR(1000) NOT NULL,
    [performedBy] NVARCHAR(1000) NOT NULL,
    [performedAt] DATETIME2 NOT NULL,
    [cost] DECIMAL(18,2),
    [notes] NVARCHAR(1000),
    [attachments] NVARCHAR(max) NOT NULL CONSTRAINT [MaintenanceLog_attachments_df] DEFAULT '[]',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [MaintenanceLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrder] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [woNumber] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [priority] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrder_priority_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrder_status_df] DEFAULT '',
    [approvalStatus] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrder_approvalStatus_df] DEFAULT '',
    [approvedById] NVARCHAR(36),
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(1000),
    [type] NVARCHAR(64) NOT NULL,
    [assetId] NVARCHAR(36),
    [vehicleId] NVARCHAR(36),
    [scheduleId] NVARCHAR(36),
    [createdById] NVARCHAR(36) NOT NULL,
    [technicianId] NVARCHAR(36),
    [dueDate] DATETIME2,
    [expectedCompletionDate] DATETIME2,
    [plannedStartAt] DATETIME2,
    [plannedEndAt] DATETIME2,
    [delayReason] NVARCHAR(1000),
    [cancelledReason] NVARCHAR(1000),
    [technicianCompletionNote] NVARCHAR(1000),
    [verificationStatus] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrder_verificationStatus_df] DEFAULT '',
    [verifiedById] NVARCHAR(36),
    [verifiedAt] DATETIME2,
    [verificationNote] NVARCHAR(1000),
    [verificationRejectionReason] NVARCHAR(1000),
    [reopenReason] NVARCHAR(1000),
    [reopenedAt] DATETIME2,
    [reopenedById] NVARCHAR(36),
    [startDate] DATETIME2,
    [completedDate] DATETIME2,
    [estimatedCost] DECIMAL(18,2),
    [actualCost] DECIMAL(18,2),
    [executionMode] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrder_executionMode_df] DEFAULT '',
    [vendorSupplierId] NVARCHAR(36),
    [estimatedHours] FLOAT(53),
    [actualHours] FLOAT(53),
    [slaDeadline] DATETIME2,
    [slaBreached] BIT NOT NULL CONSTRAINT [WorkOrder_slaBreached_df] DEFAULT 0,
    [notes] NVARCHAR(1000),
    [attachments] NVARCHAR(max) NOT NULL CONSTRAINT [WorkOrder_attachments_df] DEFAULT '[]',
    [completionCondition] NVARCHAR(64),
    [followUpRequired] BIT NOT NULL CONSTRAINT [WorkOrder_followUpRequired_df] DEFAULT 0,
    [followUpNote] NVARCHAR(1000),
    [qrVerificationStatus] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrder_qrVerificationStatus_df] DEFAULT '',
    [qrVerifiedAt] DATETIME2,
    [qrVerifiedById] NVARCHAR(36),
    [qrVerifiedAssetId] NVARCHAR(36),
    [qrVerifiedVehicleId] NVARCHAR(36),
    [qrOverrideReason] NVARCHAR(1000),
    [accidentId] NVARCHAR(36),
    [trafficFineId] NVARCHAR(36),
    [siteId] NVARCHAR(36),
    [functionalLocationId] NVARCHAR(36),
    [departmentId] NVARCHAR(36),
    [domainId] NVARCHAR(36),
    [failedAt] DATETIME2,
    [reportedAt] DATETIME2,
    [acknowledgedAt] DATETIME2,
    [technicianArrivedAt] DATETIME2,
    [repairStartedAt] DATETIME2,
    [repairCompletedAt] DATETIME2,
    [productionResumedAt] DATETIME2,
    [closedAt] DATETIME2,
    [estimatedDurationMinutes] INT,
    [holdReasonCode] NVARCHAR(1000),
    [holdNotes] NVARCHAR(1000),
    [heldAt] DATETIME2,
    [expectedResumeAt] DATETIME2,
    [resumedAt] DATETIME2,
    [affectsOperation] BIT NOT NULL CONSTRAINT [WorkOrder_affectsOperation_df] DEFAULT 0,
    [downtimeApplicable] BIT NOT NULL CONSTRAINT [WorkOrder_downtimeApplicable_df] DEFAULT 0,
    [downtimeStartedAt] DATETIME2,
    [downtimeEndedAt] DATETIME2,
    [downtimeReason] NVARCHAR(1000),
    [failureCodeId] NVARCHAR(36),
    [causeCodeId] NVARCHAR(36),
    [remedyCodeId] NVARCHAR(36),
    [failureCodeSnapshot] NVARCHAR(1000),
    [causeCodeSnapshot] NVARCHAR(1000),
    [remedyCodeSnapshot] NVARCHAR(1000),
    [riskLevel] NVARCHAR(1000),
    [ppeRequired] NVARCHAR(max) NOT NULL CONSTRAINT [WorkOrder_ppeRequired_df] DEFAULT '[]',
    [lotoRequired] BIT NOT NULL CONSTRAINT [WorkOrder_lotoRequired_df] DEFAULT 0,
    [hotWorkRequired] BIT NOT NULL CONSTRAINT [WorkOrder_hotWorkRequired_df] DEFAULT 0,
    [workingAtHeight] BIT NOT NULL CONSTRAINT [WorkOrder_workingAtHeight_df] DEFAULT 0,
    [electricalIsolation] BIT NOT NULL CONSTRAINT [WorkOrder_electricalIsolation_df] DEFAULT 0,
    [confinedSpace] BIT NOT NULL CONSTRAINT [WorkOrder_confinedSpace_df] DEFAULT 0,
    [permitReference] NVARCHAR(1000),
    [correctionReason] NVARCHAR(1000),
    [lastIdempotencyKey] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrder_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [pmPlanId] NVARCHAR(36),
    [pmPlanRevision] INT,
    [pmTriggerSource] NVARCHAR(1000),
    [pmOccurrenceKey] NVARCHAR(1000),
    [taxonomyCategoryId] NVARCHAR(36),
    [taxonomyTypeId] NVARCHAR(36),
    [taxonomyIssueId] NVARCHAR(36),
    [categoryNameSnapshot] NVARCHAR(1000),
    [typeNameSnapshot] NVARCHAR(1000),
    [issueNameSnapshot] NVARCHAR(1000),
    [isTriage] BIT NOT NULL CONSTRAINT [WorkOrder_isTriage_df] DEFAULT 0,
    [triageReason] NVARCHAR(1000),
    [triageClassifiedAt] DATETIME2,
    [triageClassifiedById] NVARCHAR(36),
    CONSTRAINT [WorkOrder_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrder_woNumber_key] UNIQUE NONCLUSTERED ([woNumber])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderTaxonomy] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [parentId] NVARCHAR(36),
    [level] NVARCHAR(64) NOT NULL,
    [active] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_active_df] DEFAULT 1,
    [sortOrder] INT NOT NULL CONSTRAINT [WorkOrderTaxonomy_sortOrder_df] DEFAULT 0,
    [departmentScope] NVARCHAR(1000),
    [defaultPriority] NVARCHAR(64),
    [defaultSlaHours] INT,
    [requiresAsset] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_requiresAsset_df] DEFAULT 0,
    [requiresVehicle] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_requiresVehicle_df] DEFAULT 0,
    [requiresLocation] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_requiresLocation_df] DEFAULT 0,
    [requiresEvidence] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_requiresEvidence_df] DEFAULT 0,
    [requiresSupervisorVerification] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_requiresSupervisorVerification_df] DEFAULT 0,
    [requiresPartsReview] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_requiresPartsReview_df] DEFAULT 0,
    [requiresFinanceApproval] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_requiresFinanceApproval_df] DEFAULT 0,
    [gateOutBlockingRisk] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_gateOutBlockingRisk_df] DEFAULT 0,
    [downtimeTrackingRequired] BIT NOT NULL CONSTRAINT [WorkOrderTaxonomy_downtimeTrackingRequired_df] DEFAULT 0,
    [allowedRoles] NVARCHAR(max) NOT NULL CONSTRAINT [WorkOrderTaxonomy_allowedRoles_df] DEFAULT '[]',
    [aliases] NVARCHAR(max) NOT NULL CONSTRAINT [WorkOrderTaxonomy_aliases_df] DEFAULT '[]',
    [keywords] NVARCHAR(max) NOT NULL CONSTRAINT [WorkOrderTaxonomy_keywords_df] DEFAULT '[]',
    [commonMistakes] NVARCHAR(max) NOT NULL CONSTRAINT [WorkOrderTaxonomy_commonMistakes_df] DEFAULT '[]',
    [sinhalaKeywords] NVARCHAR(max) NOT NULL CONSTRAINT [WorkOrderTaxonomy_sinhalaKeywords_df] DEFAULT '[]',
    [departmentHints] NVARCHAR(max) NOT NULL CONSTRAINT [WorkOrderTaxonomy_departmentHints_df] DEFAULT '[]',
    [createdById] NVARCHAR(36),
    [updatedById] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderTaxonomy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderTaxonomy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrderTaxonomy_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[Employee] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [employeeNo] NVARCHAR(1000),
    [fullName] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [branchName] NVARCHAR(1000),
    [departmentId] NVARCHAR(36),
    [designation] NVARCHAR(1000) NOT NULL,
    [skills] NVARCHAR(max) NOT NULL CONSTRAINT [Employee_skills_df] DEFAULT '[]',
    [workCategories] NVARCHAR(max) NOT NULL CONSTRAINT [Employee_workCategories_df] DEFAULT '[]',
    [shift] NVARCHAR(1000),
    [availabilityStatus] NVARCHAR(64) NOT NULL CONSTRAINT [Employee_availabilityStatus_df] DEFAULT '',
    [canReceiveWorkOrders] BIT NOT NULL CONSTRAINT [Employee_canReceiveWorkOrders_df] DEFAULT 1,
    [dailyCapacityHours] FLOAT(53) NOT NULL CONSTRAINT [Employee_dailyCapacityHours_df] DEFAULT 8,
    [active] BIT NOT NULL CONSTRAINT [Employee_active_df] DEFAULT 1,
    [canLogin] BIT NOT NULL CONSTRAINT [Employee_canLogin_df] DEFAULT 0,
    [linkedUserId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Employee_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Employee_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Employee_tenantId_employeeNo_key] UNIQUE NONCLUSTERED ([tenantId],[employeeNo])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderAssignee] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36) NOT NULL,
    [employeeId] NVARCHAR(36) NOT NULL,
    [designation] NVARCHAR(1000),
    [roleInTask] NVARCHAR(1000),
    [isPrimary] BIT NOT NULL CONSTRAINT [WorkOrderAssignee_isPrimary_df] DEFAULT 0,
    [plannedStartAt] DATETIME2,
    [plannedEndAt] DATETIME2,
    [estimatedHours] FLOAT(53),
    [actualHours] FLOAT(53),
    [assignmentStatus] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrderAssignee_assignmentStatus_df] DEFAULT '',
    [assignedById] NVARCHAR(36),
    [assignedAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderAssignee_assignedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [remarks] NVARCHAR(1000),
    [leaveOverride] BIT NOT NULL CONSTRAINT [WorkOrderAssignee_leaveOverride_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderAssignee_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderAssignee_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrderAssignee_workOrderId_employeeId_key] UNIQUE NONCLUSTERED ([workOrderId],[employeeId])
);

-- CreateTable
CREATE TABLE [dbo].[MaintenanceAnalysisCode] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [kind] NVARCHAR(64) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [sortOrder] INT NOT NULL CONSTRAINT [MaintenanceAnalysisCode_sortOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [MaintenanceAnalysisCode_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceAnalysisCode_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MaintenanceAnalysisCode_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MaintenanceAnalysisCode_tenantId_kind_code_key] UNIQUE NONCLUSTERED ([tenantId],[kind],[code])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderHoldHistory] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36) NOT NULL,
    [holdReasonCode] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(1000),
    [heldAt] DATETIME2 NOT NULL,
    [expectedResumeAt] DATETIME2,
    [resumedAt] DATETIME2,
    [heldById] NVARCHAR(36),
    [resumedById] NVARCHAR(36),
    [durationMinutes] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderHoldHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WorkOrderHoldHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderLabourEntry] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36) NOT NULL,
    [technicianUserId] NVARCHAR(36),
    [employeeId] NVARCHAR(36),
    [startedAt] DATETIME2 NOT NULL,
    [endedAt] DATETIME2,
    [durationMinutes] INT,
    [notes] NVARCHAR(1000),
    [labourRateSnapshot] DECIMAL(18,2),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderLabourEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderLabourEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderStatusHistory] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36) NOT NULL,
    [fromStatus] NVARCHAR(64),
    [toStatus] NVARCHAR(64) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(1000),
    [actorId] NVARCHAR(36),
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderStatusHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WorkOrderStatusHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeRosterEntry] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [employeeId] NVARCHAR(36) NOT NULL,
    [rosterDate] DATETIME2 NOT NULL,
    [shiftCode] NVARCHAR(1000),
    [shiftStartAt] DATETIME2,
    [shiftEndAt] DATETIME2,
    [branchName] NVARCHAR(1000),
    [departmentId] NVARCHAR(36),
    [isWorkingDay] BIT NOT NULL CONSTRAINT [EmployeeRosterEntry_isWorkingDay_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeRosterEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeRosterEntry_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeRosterEntry_tenantId_employeeId_rosterDate_key] UNIQUE NONCLUSTERED ([tenantId],[employeeId],[rosterDate])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeLeaveRequest] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [employeeId] NVARCHAR(36) NOT NULL,
    [startDate] DATETIME2 NOT NULL,
    [endDate] DATETIME2 NOT NULL,
    [leaveType] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [EmployeeLeaveRequest_status_df] DEFAULT '',
    [approvedById] NVARCHAR(36),
    [approvedAt] DATETIME2,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeLeaveRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeLeaveRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SparePart] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [partNumber] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [category] NVARCHAR(1000) NOT NULL,
    [classification] NVARCHAR(64) NOT NULL CONSTRAINT [SparePart_classification_df] DEFAULT '',
    [erpCode] NVARCHAR(1000),
    [maintenanceAlias] NVARCHAR(1000),
    [maintenanceCategory] NVARCHAR(1000),
    [unit] NVARCHAR(1000) NOT NULL CONSTRAINT [SparePart_unit_df] DEFAULT 'pcs',
    [quantityInStock] INT NOT NULL CONSTRAINT [SparePart_quantityInStock_df] DEFAULT 0,
    [reservedQuantity] INT NOT NULL CONSTRAINT [SparePart_reservedQuantity_df] DEFAULT 0,
    [availableQuantity] INT NOT NULL CONSTRAINT [SparePart_availableQuantity_df] DEFAULT 0,
    [referenceStock] INT,
    [minimumStock] INT NOT NULL CONSTRAINT [SparePart_minimumStock_df] DEFAULT 0,
    [reorderPoint] INT NOT NULL CONSTRAINT [SparePart_reorderPoint_df] DEFAULT 0,
    [maximumStock] INT NOT NULL CONSTRAINT [SparePart_maximumStock_df] DEFAULT 0,
    [unitCost] DECIMAL(18,2) NOT NULL,
    [location] NVARCHAR(1000),
    [supplierId] NVARCHAR(36),
    [images] NVARCHAR(max) NOT NULL CONSTRAINT [SparePart_images_df] DEFAULT '[]',
    [isActive] BIT NOT NULL CONSTRAINT [SparePart_isActive_df] DEFAULT 1,
    [leadTimeDays] INT,
    [criticality] NVARCHAR(1000),
    [criticalSpare] BIT NOT NULL CONSTRAINT [SparePart_criticalSpare_df] DEFAULT 0,
    [warrantyDays] INT,
    [warrantyMileage] FLOAT(53),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SparePart_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SparePart_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SparePart_partNumber_key] UNIQUE NONCLUSTERED ([partNumber])
);

-- CreateTable
CREATE TABLE [dbo].[Warehouse] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [erpWarehouseCode] NVARCHAR(1000),
    [lastErpValidatedAt] DATETIME2,
    [isDefault] BIT NOT NULL CONSTRAINT [Warehouse_isDefault_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Warehouse_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Warehouse_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Warehouse_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Warehouse_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[WarehouseItemBalance] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [warehouseId] NVARCHAR(36) NOT NULL,
    [partId] NVARCHAR(36) NOT NULL,
    [onHand] INT NOT NULL CONSTRAINT [WarehouseItemBalance_onHand_df] DEFAULT 0,
    [reserved] INT NOT NULL CONSTRAINT [WarehouseItemBalance_reserved_df] DEFAULT 0,
    [available] INT NOT NULL CONSTRAINT [WarehouseItemBalance_available_df] DEFAULT 0,
    [lastMovementAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WarehouseItemBalance_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WarehouseItemBalance_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WarehouseItemBalance_tenantId_warehouseId_partId_key] UNIQUE NONCLUSTERED ([tenantId],[warehouseId],[partId])
);

-- CreateTable
CREATE TABLE [dbo].[StockMovement] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [partId] NVARCHAR(36) NOT NULL,
    [warehouseId] NVARCHAR(36),
    [type] NVARCHAR(64) NOT NULL,
    [quantity] INT NOT NULL,
    [reference] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [workOrderId] NVARCHAR(36),
    [vehicleId] NVARCHAR(36),
    [actorUserId] NVARCHAR(36),
    [sourceType] NVARCHAR(1000),
    [sourceDocument] NVARCHAR(1000),
    [sourceLineKey] NVARCHAR(1000),
    [importRunId] NVARCHAR(36),
    [transferGroupId] NVARCHAR(1000),
    [reversalOfMovementId] NVARCHAR(36),
    [quantityReversed] INT NOT NULL CONSTRAINT [StockMovement_quantityReversed_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StockMovement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [StockMovement_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[InventoryStockIssueIdempotency] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [partId] NVARCHAR(36) NOT NULL,
    [movementId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36),
    [quantity] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InventoryStockIssueIdempotency_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [InventoryStockIssueIdempotency_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [InventoryStockIssueIdempotency_tenantId_key_key] UNIQUE NONCLUSTERED ([tenantId],[key])
);

-- CreateTable
CREATE TABLE [dbo].[InventoryIdempotency] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [operation] NVARCHAR(1000) NOT NULL,
    [payloadHash] NVARCHAR(1000) NOT NULL,
    [partId] NVARCHAR(36),
    [warehouseId] NVARCHAR(36),
    [quantity] INT NOT NULL,
    [movementId] NVARCHAR(36),
    [transferGroupId] NVARCHAR(1000),
    [resultJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InventoryIdempotency_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [InventoryIdempotency_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [InventoryIdempotency_tenantId_key_key] UNIQUE NONCLUSTERED ([tenantId],[key])
);

-- CreateTable
CREATE TABLE [dbo].[InventoryImportRun] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [InventoryImportRun_source_df] DEFAULT 'ERP_EXCEL',
    [originalFilename] NVARCHAR(1000) NOT NULL,
    [fileSha256] NVARCHAR(1000) NOT NULL,
    [sheetName] NVARCHAR(1000),
    [businessDate] DATETIME2,
    [warehouseScope] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [InventoryImportRun_status_df] DEFAULT '',
    [uploadedById] NVARCHAR(36),
    [uploadedAt] DATETIME2 NOT NULL CONSTRAINT [InventoryImportRun_uploadedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [validatedAt] DATETIME2,
    [appliedAt] DATETIME2,
    [totalRows] INT NOT NULL CONSTRAINT [InventoryImportRun_totalRows_df] DEFAULT 0,
    [matchedRows] INT NOT NULL CONSTRAINT [InventoryImportRun_matchedRows_df] DEFAULT 0,
    [changedRows] INT NOT NULL CONSTRAINT [InventoryImportRun_changedRows_df] DEFAULT 0,
    [unchangedRows] INT NOT NULL CONSTRAINT [InventoryImportRun_unchangedRows_df] DEFAULT 0,
    [unmappedRows] INT NOT NULL CONSTRAINT [InventoryImportRun_unmappedRows_df] DEFAULT 0,
    [duplicateRows] INT NOT NULL CONSTRAINT [InventoryImportRun_duplicateRows_df] DEFAULT 0,
    [invalidRows] INT NOT NULL CONSTRAINT [InventoryImportRun_invalidRows_df] DEFAULT 0,
    [updatedRows] INT NOT NULL CONSTRAINT [InventoryImportRun_updatedRows_df] DEFAULT 0,
    [failedRows] INT NOT NULL CONSTRAINT [InventoryImportRun_failedRows_df] DEFAULT 0,
    [mappingSnapshot] NVARCHAR(max),
    [stagingRecords] NVARCHAR(max),
    [sheetsDetected] NVARCHAR(max),
    [warehousesDetected] NVARCHAR(max),
    [headerRowIndex] INT,
    [errorSummary] NVARCHAR(1000),
    [applyMessage] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InventoryImportRun_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InventoryImportRun_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [InventoryImportRun_tenantId_source_fileSha256_key] UNIQUE NONCLUSTERED ([tenantId],[source],[fileSha256])
);

-- CreateTable
CREATE TABLE [dbo].[InventoryImportRow] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [importRunId] NVARCHAR(36) NOT NULL,
    [rowNumber] INT NOT NULL,
    [erpItemCode] NVARCHAR(1000),
    [itemName] NVARCHAR(1000),
    [erpQuantity] INT,
    [warehouseCode] NVARCHAR(1000),
    [uom] NVARCHAR(1000),
    [partId] NVARCHAR(36),
    [partNumber] NVARCHAR(1000),
    [maintainProQuantity] INT,
    [difference] INT,
    [status] NVARCHAR(64) NOT NULL,
    [message] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InventoryImportRow_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [InventoryImportRow_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BulkImportRun] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [entityType] NVARCHAR(64) NOT NULL,
    [mode] NVARCHAR(64) NOT NULL CONSTRAINT [BulkImportRun_mode_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [BulkImportRun_status_df] DEFAULT '',
    [originalFilename] NVARCHAR(1000) NOT NULL,
    [fileFormat] NVARCHAR(1000) NOT NULL,
    [fileSha256] NVARCHAR(1000) NOT NULL,
    [fileSizeBytes] INT NOT NULL,
    [actorUserId] NVARCHAR(36) NOT NULL,
    [actorEmail] NVARCHAR(1000) NOT NULL,
    [totalRows] INT NOT NULL CONSTRAINT [BulkImportRun_totalRows_df] DEFAULT 0,
    [createCount] INT NOT NULL CONSTRAINT [BulkImportRun_createCount_df] DEFAULT 0,
    [updateCount] INT NOT NULL CONSTRAINT [BulkImportRun_updateCount_df] DEFAULT 0,
    [skipCount] INT NOT NULL CONSTRAINT [BulkImportRun_skipCount_df] DEFAULT 0,
    [errorCount] INT NOT NULL CONSTRAINT [BulkImportRun_errorCount_df] DEFAULT 0,
    [errorSummary] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BulkImportRun_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [validatedAt] DATETIME2,
    [committedAt] DATETIME2,
    [expiresAt] DATETIME2 NOT NULL,
    CONSTRAINT [BulkImportRun_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BulkImportRow] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [runId] NVARCHAR(36) NOT NULL,
    [rowNumber] INT NOT NULL,
    [naturalKey] NVARCHAR(1000),
    [normalizedData] NVARCHAR(max) NOT NULL,
    [rawData] NVARCHAR(max) NOT NULL,
    [action] NVARCHAR(64) NOT NULL,
    [errors] NVARCHAR(max),
    [warnings] NVARCHAR(max),
    [createdEntityId] NVARCHAR(36),
    CONSTRAINT [BulkImportRow_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderPart] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36) NOT NULL,
    [partId] NVARCHAR(36) NOT NULL,
    [partRequestId] NVARCHAR(36),
    [quantity] INT NOT NULL,
    [unitCost] DECIMAL(18,2) NOT NULL,
    [totalCost] DECIMAL(18,2) NOT NULL,
    [lineStatus] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrderPart_lineStatus_df] DEFAULT '',
    [approvalTier] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrderPart_approvalTier_df] DEFAULT '',
    [procurementRequired] BIT NOT NULL CONSTRAINT [WorkOrderPart_procurementRequired_df] DEFAULT 0,
    [requestedQuantity] INT NOT NULL CONSTRAINT [WorkOrderPart_requestedQuantity_df] DEFAULT 0,
    [approvedQuantity] INT,
    [reservedQuantity] INT NOT NULL CONSTRAINT [WorkOrderPart_reservedQuantity_df] DEFAULT 0,
    [issuedQuantity] INT NOT NULL CONSTRAINT [WorkOrderPart_issuedQuantity_df] DEFAULT 0,
    [usedQuantity] INT NOT NULL CONSTRAINT [WorkOrderPart_usedQuantity_df] DEFAULT 0,
    [returnedQuantity] INT NOT NULL CONSTRAINT [WorkOrderPart_returnedQuantity_df] DEFAULT 0,
    [damagedQuantity] INT NOT NULL CONSTRAINT [WorkOrderPart_damagedQuantity_df] DEFAULT 0,
    [pendingReturnQuantity] INT NOT NULL CONSTRAINT [WorkOrderPart_pendingReturnQuantity_df] DEFAULT 0,
    [requestedById] NVARCHAR(36),
    [approvedById] NVARCHAR(36),
    [issuedById] NVARCHAR(36),
    [issueReason] NVARCHAR(1000),
    [issuedAt] DATETIME2,
    [issueNote] NVARCHAR(1000),
    [issueSlipNo] NVARCHAR(1000),
    [storeLocation] NVARCHAR(1000),
    [receiverId] NVARCHAR(36),
    [receivedAt] DATETIME2,
    [returnedById] NVARCHAR(36),
    [returnedAt] DATETIME2,
    [returnCondition] NVARCHAR(64),
    [returnNote] NVARCHAR(1000),
    [confirmedByStorekeeperId] NVARCHAR(36),
    [returnConfirmedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderPart_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderPart_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Supplier] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [vendorCode] NVARCHAR(1000),
    [name] NVARCHAR(1000) NOT NULL,
    [contactName] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [website] NVARCHAR(1000),
    [taxNumber] NVARCHAR(1000),
    [serviceCategories] NVARCHAR(max) NOT NULL CONSTRAINT [Supplier_serviceCategories_df] DEFAULT '[]',
    [performanceScore] FLOAT(53),
    [blacklisted] BIT NOT NULL CONSTRAINT [Supplier_blacklisted_df] DEFAULT 0,
    [blacklistReason] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Supplier_isActive_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdById] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Supplier_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Supplier_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Supplier_tenantId_vendorCode_key] UNIQUE NONCLUSTERED ([tenantId],[vendorCode])
);

-- CreateTable
CREATE TABLE [dbo].[VendorRepairCase] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36) NOT NULL,
    [supplierId] NVARCHAR(36),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [VendorRepairCase_status_df] DEFAULT '',
    [externalRepairReason] NVARCHAR(1000),
    [emergencyOverride] BIT NOT NULL CONSTRAINT [VendorRepairCase_emergencyOverride_df] DEFAULT 0,
    [emergencyOverrideReason] NVARCHAR(1000),
    [emergencyOverrideById] NVARCHAR(36),
    [requestedById] NVARCHAR(36),
    [requestedAt] DATETIME2,
    [authorizedById] NVARCHAR(36),
    [authorizedAt] DATETIME2,
    [vendorCompletedAt] DATETIME2,
    [closedAt] DATETIME2,
    [approvedQuotationAmount] FLOAT(53),
    [approvedQuotationId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorRepairCase_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorRepairCase_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorRepairCase_workOrderId_key] UNIQUE NONCLUSTERED ([workOrderId])
);

-- CreateTable
CREATE TABLE [dbo].[VendorQuotation] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [vendorRepairCaseId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [supplierId] NVARCHAR(36) NOT NULL,
    [quotationNo] NVARCHAR(1000) NOT NULL,
    [quotationDate] DATETIME2 NOT NULL,
    [quotedAmount] FLOAT(53) NOT NULL,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [VendorQuotation_currency_df] DEFAULT 'LKR',
    [validityDate] DATETIME2,
    [evidenceAttachmentId] NVARCHAR(36),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [VendorQuotation_status_df] DEFAULT '',
    [submittedById] NVARCHAR(36),
    [submittedAt] DATETIME2,
    [approvedById] NVARCHAR(36),
    [approvedAt] DATETIME2,
    [approvalNote] NVARCHAR(1000),
    [rejectionReason] NVARCHAR(1000),
    [requiredApprovalLevel] NVARCHAR(64),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorQuotation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorQuotation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[VendorInvoice] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [vendorRepairCaseId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [supplierId] NVARCHAR(36) NOT NULL,
    [invoiceNo] NVARCHAR(1000) NOT NULL,
    [invoiceDate] DATETIME2 NOT NULL,
    [invoiceAmount] DECIMAL(18,2) NOT NULL,
    [taxAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [VendorInvoice_taxAmount_df] DEFAULT 0,
    [totalAmount] DECIMAL(18,2) NOT NULL,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [VendorInvoice_currency_df] DEFAULT 'LKR',
    [evidenceAttachmentId] NVARCHAR(36),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [VendorInvoice_status_df] DEFAULT '',
    [submittedById] NVARCHAR(36),
    [submittedAt] DATETIME2,
    [financeApprovedById] NVARCHAR(36),
    [financeApprovedAt] DATETIME2,
    [financeNote] NVARCHAR(1000),
    [rejectionReason] NVARCHAR(1000),
    [exceedsQuotationReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorInvoice_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorInvoice_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorInvoice_tenantId_supplierId_invoiceNo_key] UNIQUE NONCLUSTERED ([tenantId],[supplierId],[invoiceNo])
);

-- CreateTable
CREATE TABLE [dbo].[PurchaseOrder] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [poNumber] NVARCHAR(1000) NOT NULL,
    [supplierId] NVARCHAR(36) NOT NULL,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [PurchaseOrder_status_df] DEFAULT '',
    [workflowStatus] NVARCHAR(64) NOT NULL CONSTRAINT [PurchaseOrder_workflowStatus_df] DEFAULT '',
    [requiresFinanceApproval] BIT NOT NULL CONSTRAINT [PurchaseOrder_requiresFinanceApproval_df] DEFAULT 0,
    [orderDate] DATETIME2 NOT NULL,
    [expectedDate] DATETIME2,
    [receivedDate] DATETIME2,
    [totalAmount] DECIMAL(18,2) NOT NULL,
    [notes] NVARCHAR(1000),
    [createdById] NVARCHAR(36),
    [lastModifiedById] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PurchaseOrder_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PurchaseOrder_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PurchaseOrder_tenantId_poNumber_key] UNIQUE NONCLUSTERED ([tenantId],[poNumber])
);

-- CreateTable
CREATE TABLE [dbo].[PurchaseOrderLine] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [purchaseOrderId] NVARCHAR(36) NOT NULL,
    [partId] NVARCHAR(36),
    [partRequestId] NVARCHAR(36),
    [description] NVARCHAR(1000) NOT NULL,
    [quantity] INT NOT NULL,
    [unitCost] DECIMAL(18,2) NOT NULL,
    [totalCost] DECIMAL(18,2) NOT NULL,
    [receivedQuantity] INT NOT NULL CONSTRAINT [PurchaseOrderLine_receivedQuantity_df] DEFAULT 0,
    [rejectedQuantity] INT NOT NULL CONSTRAINT [PurchaseOrderLine_rejectedQuantity_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PurchaseOrderLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PurchaseOrderLine_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PurchaseOrderApproval] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [purchaseOrderId] NVARCHAR(36) NOT NULL,
    [stage] NVARCHAR(64) NOT NULL,
    [sequence] INT NOT NULL CONSTRAINT [PurchaseOrderApproval_sequence_df] DEFAULT 1,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [PurchaseOrderApproval_status_df] DEFAULT '',
    [actorId] NVARCHAR(36),
    [actedAt] DATETIME2,
    [reason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PurchaseOrderApproval_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PurchaseOrderApproval_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PurchaseOrderApproval_purchaseOrderId_stage_key] UNIQUE NONCLUSTERED ([purchaseOrderId],[stage])
);

-- CreateTable
CREATE TABLE [dbo].[PurchaseOrderErpSync] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [purchaseOrderId] NVARCHAR(36) NOT NULL,
    [provider] NVARCHAR(1000) NOT NULL CONSTRAINT [PurchaseOrderErpSync_provider_df] DEFAULT 'MOCK_ERP',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [PurchaseOrderErpSync_status_df] DEFAULT '',
    [attempt] INT NOT NULL CONSTRAINT [PurchaseOrderErpSync_attempt_df] DEFAULT 1,
    [triggeredById] NVARCHAR(36),
    [lastAttemptAt] DATETIME2,
    [nextRetryAt] DATETIME2,
    [errorMessage] NVARCHAR(1000),
    [errorCode] NVARCHAR(1000),
    [idempotencyKey] NVARCHAR(1000),
    [providerReference] NVARCHAR(1000),
    [requestPayload] NVARCHAR(max),
    [responsePayload] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PurchaseOrderErpSync_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PurchaseOrderErpSync_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PartRequest] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36) NOT NULL,
    [partId] NVARCHAR(36) NOT NULL,
    [requestedById] NVARCHAR(36) NOT NULL,
    [requestedQuantity] INT NOT NULL,
    [approvedQuantity] INT,
    [issuedQuantity] INT NOT NULL CONSTRAINT [PartRequest_issuedQuantity_df] DEFAULT 0,
    [unitCostSnapshot] FLOAT(53) NOT NULL,
    [requiresFinanceApproval] BIT NOT NULL CONSTRAINT [PartRequest_requiresFinanceApproval_df] DEFAULT 0,
    [reason] NVARCHAR(1000),
    [rejectionReason] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [PartRequest_status_df] DEFAULT '',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PartRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PartRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PartRequestApproval] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [partRequestId] NVARCHAR(36) NOT NULL,
    [stage] NVARCHAR(64) NOT NULL,
    [sequence] INT NOT NULL CONSTRAINT [PartRequestApproval_sequence_df] DEFAULT 1,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [PartRequestApproval_status_df] DEFAULT '',
    [actorId] NVARCHAR(36),
    [actedAt] DATETIME2,
    [reason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PartRequestApproval_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PartRequestApproval_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PartRequestApproval_partRequestId_stage_key] UNIQUE NONCLUSTERED ([partRequestId],[stage])
);

-- CreateTable
CREATE TABLE [dbo].[PartIssue] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [partRequestId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [partId] NVARCHAR(36) NOT NULL,
    [issuedById] NVARCHAR(36) NOT NULL,
    [quantity] INT NOT NULL,
    [unitCostSnapshot] FLOAT(53),
    [notes] NVARCHAR(1000),
    [expectsReturn] BIT NOT NULL CONSTRAINT [PartIssue_expectsReturn_df] DEFAULT 0,
    [quantityReturned] INT NOT NULL CONSTRAINT [PartIssue_quantityReturned_df] DEFAULT 0,
    [returnedAt] DATETIME2,
    [returnedById] NVARCHAR(36),
    [returnNotes] NVARCHAR(1000),
    [erpIssueReference] NVARCHAR(1000),
    [warehouseId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PartIssue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PartIssue_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PurchaseReceipt] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [purchaseOrderId] NVARCHAR(36) NOT NULL,
    [receiptNumber] NVARCHAR(1000) NOT NULL,
    [receivedById] NVARCHAR(36) NOT NULL,
    [receivedAt] DATETIME2 NOT NULL CONSTRAINT [PurchaseReceipt_receivedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [supplierDeliveryNote] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PurchaseReceipt_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PurchaseReceipt_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PurchaseReceipt_tenantId_receiptNumber_key] UNIQUE NONCLUSTERED ([tenantId],[receiptNumber])
);

-- CreateTable
CREATE TABLE [dbo].[PurchaseReceiptLine] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [receiptId] NVARCHAR(36) NOT NULL,
    [purchaseOrderLineId] NVARCHAR(36) NOT NULL,
    [acceptedQuantity] INT NOT NULL,
    [rejectedQuantity] INT NOT NULL CONSTRAINT [PurchaseReceiptLine_rejectedQuantity_df] DEFAULT 0,
    [rejectionReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PurchaseReceiptLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PurchaseReceiptLine_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PurchaseReceiptLine_receiptId_purchaseOrderLineId_key] UNIQUE NONCLUSTERED ([receiptId],[purchaseOrderLineId])
);

-- CreateTable
CREATE TABLE [dbo].[PurchaseReceiptIdempotency] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [purchaseOrderId] NVARCHAR(36) NOT NULL,
    [receiptId] NVARCHAR(36) NOT NULL,
    [requestHash] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PurchaseReceiptIdempotency_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PurchaseReceiptIdempotency_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PurchaseReceiptIdempotency_tenantId_key_key] UNIQUE NONCLUSTERED ([tenantId],[key])
);

-- CreateTable
CREATE TABLE [dbo].[UtilityMeter] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [meterNumber] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(64) NOT NULL,
    [location] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [unit] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [UtilityMeter_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UtilityMeter_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [UtilityMeter_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UtilityMeter_meterNumber_key] UNIQUE NONCLUSTERED ([meterNumber])
);

-- CreateTable
CREATE TABLE [dbo].[MeterReading] (
    [id] NVARCHAR(36) NOT NULL,
    [meterId] NVARCHAR(36) NOT NULL,
    [readingDate] DATETIME2 NOT NULL,
    [readingValue] FLOAT(53) NOT NULL,
    [consumption] FLOAT(53),
    [images] NVARCHAR(max) NOT NULL CONSTRAINT [MeterReading_images_df] DEFAULT '[]',
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MeterReading_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [MeterReading_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[UtilityBill] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [meterId] NVARCHAR(36) NOT NULL,
    [billingPeriodStart] DATETIME2 NOT NULL,
    [billingPeriodEnd] DATETIME2 NOT NULL,
    [totalConsumption] FLOAT(53) NOT NULL,
    [ratePerUnit] FLOAT(53) NOT NULL,
    [baseCharge] FLOAT(53),
    [taxAmount] FLOAT(53),
    [totalAmount] FLOAT(53) NOT NULL,
    [dueDate] DATETIME2,
    [paidDate] DATETIME2,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [UtilityBill_status_df] DEFAULT '',
    [invoiceUrl] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UtilityBill_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [UtilityBill_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [id] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(64) NOT NULL,
    [priority] NVARCHAR(64) NOT NULL CONSTRAINT [Notification_priority_df] DEFAULT '',
    [channel] NVARCHAR(64) NOT NULL CONSTRAINT [Notification_channel_df] DEFAULT '',
    [isRead] BIT NOT NULL CONSTRAINT [Notification_isRead_df] DEFAULT 0,
    [readAt] DATETIME2,
    [acknowledgedAt] DATETIME2,
    [dueAt] DATETIME2,
    [metadata] NVARCHAR(max),
    [referenceId] NVARCHAR(1000),
    [referenceType] NVARCHAR(1000),
    [sentAt] DATETIME2,
    [dedupeKey] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PredictiveLog] (
    [id] NVARCHAR(36) NOT NULL,
    [assetId] NVARCHAR(36),
    [prediction] NVARCHAR(1000) NOT NULL,
    [confidence] FLOAT(53) NOT NULL,
    [suggestedAction] NVARCHAR(1000) NOT NULL,
    [riskLevel] NVARCHAR(64) NOT NULL,
    [analyzedAt] DATETIME2 NOT NULL CONSTRAINT [PredictiveLog_analyzedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [acknowledged] BIT NOT NULL CONSTRAINT [PredictiveLog_acknowledged_df] DEFAULT 0,
    CONSTRAINT [PredictiveLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CopilotConversation] (
    [id] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [focusArea] NVARCHAR(1000) NOT NULL CONSTRAINT [CopilotConversation_focusArea_df] DEFAULT 'GENERAL',
    [mode] NVARCHAR(1000) NOT NULL CONSTRAINT [CopilotConversation_mode_df] DEFAULT 'CHAT',
    [providerConversationId] NVARCHAR(1000),
    [lastMessageAt] DATETIME2 NOT NULL CONSTRAINT [CopilotConversation_lastMessageAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CopilotConversation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CopilotConversation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CopilotMessage] (
    [id] NVARCHAR(36) NOT NULL,
    [conversationId] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [focusArea] NVARCHAR(1000) NOT NULL CONSTRAINT [CopilotMessage_focusArea_df] DEFAULT 'GENERAL',
    [mode] NVARCHAR(1000) NOT NULL CONSTRAINT [CopilotMessage_mode_df] DEFAULT 'CHAT',
    [content] NVARCHAR(1000) NOT NULL,
    [actions] NVARCHAR(max),
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CopilotMessage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CopilotMessage_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CopilotExchangeLog] (
    [id] NVARCHAR(36) NOT NULL,
    [conversationId] NVARCHAR(36),
    [userId] NVARCHAR(36) NOT NULL,
    [focusArea] NVARCHAR(1000) NOT NULL CONSTRAINT [CopilotExchangeLog_focusArea_df] DEFAULT 'GENERAL',
    [mode] NVARCHAR(1000) NOT NULL CONSTRAINT [CopilotExchangeLog_mode_df] DEFAULT 'CHAT',
    [query] NVARCHAR(1000) NOT NULL,
    [response] NVARCHAR(1000) NOT NULL,
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [CopilotExchangeLog_source_df] DEFAULT 'fallback',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CopilotExchangeLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CopilotExchangeLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Property] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Property_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Property_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Property_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Property_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[Building] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [propertyId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Building_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Building_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Building_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Building_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[Floor] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [buildingId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [levelNumber] INT,
    [isActive] BIT NOT NULL CONSTRAINT [Floor_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Floor_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Floor_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Room] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [floorId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000),
    [roomType] NVARCHAR(64),
    [isActive] BIT NOT NULL CONSTRAINT [Room_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Room_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Room_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Site] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(64) NOT NULL,
    [description] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [contactPhone] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Site_isActive_df] DEFAULT 1,
    [legacyPropertyId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Site_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Site_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Site_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[FunctionalLocation] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [siteId] NVARCHAR(36) NOT NULL,
    [parentId] NVARCHAR(36),
    [departmentId] NVARCHAR(36),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(64) NOT NULL,
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [FunctionalLocation_isActive_df] DEFAULT 1,
    [legacyBuildingId] NVARCHAR(36),
    [legacyFloorId] NVARCHAR(36),
    [legacyRoomId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FunctionalLocation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [FunctionalLocation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FunctionalLocation_tenantId_siteId_code_key] UNIQUE NONCLUSTERED ([tenantId],[siteId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[CleaningLocation] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [name] NVARCHAR(1000) NOT NULL,
    [area] NVARCHAR(1000) NOT NULL,
    [building] NVARCHAR(1000),
    [floor] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [qrCode] NVARCHAR(1000) NOT NULL,
    [qrCodeUrl] NVARCHAR(1000),
    [scheduleCron] NVARCHAR(1000),
    [shiftWindow] NVARCHAR(1000),
    [cleaningFrequency] INT NOT NULL CONSTRAINT [CleaningLocation_cleaningFrequency_df] DEFAULT 1,
    [cleaningFrequencyUnit] NVARCHAR(64) NOT NULL CONSTRAINT [CleaningLocation_cleaningFrequencyUnit_df] DEFAULT '',
    [shiftAssignment] NVARCHAR(64) NOT NULL CONSTRAINT [CleaningLocation_shiftAssignment_df] DEFAULT '',
    [assignedCleanerId] NVARCHAR(36),
    [geoLatitude] FLOAT(53),
    [geoLongitude] FLOAT(53),
    [geoRadiusMeters] INT NOT NULL CONSTRAINT [CleaningLocation_geoRadiusMeters_df] DEFAULT 150,
    [requireDeviceValidation] BIT NOT NULL CONSTRAINT [CleaningLocation_requireDeviceValidation_df] DEFAULT 0,
    [requirePhotoEvidence] BIT NOT NULL CONSTRAINT [CleaningLocation_requirePhotoEvidence_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [CleaningLocation_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CleaningLocation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CleaningLocation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CleaningLocation_qrCode_key] UNIQUE NONCLUSTERED ([qrCode])
);

-- CreateTable
CREATE TABLE [dbo].[CleaningChecklistTemplate] (
    [id] NVARCHAR(36) NOT NULL,
    [locationId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [items] NVARCHAR(max) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [CleaningChecklistTemplate_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CleaningChecklistTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CleaningChecklistTemplate_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CleaningVisit] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [locationId] NVARCHAR(36) NOT NULL,
    [cleanerId] NVARCHAR(36) NOT NULL,
    [scannedAt] DATETIME2 NOT NULL CONSTRAINT [CleaningVisit_scannedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [clientScannedAt] DATETIME2,
    [startedAt] DATETIME2,
    [method] NVARCHAR(64) NOT NULL CONSTRAINT [CleaningVisit_method_df] DEFAULT '',
    [deviceId] NVARCHAR(1000),
    [completedAt] DATETIME2,
    [durationSeconds] INT,
    [latitude] FLOAT(53),
    [longitude] FLOAT(53),
    [geofenceDistanceMeters] FLOAT(53),
    [geoValidated] BIT NOT NULL CONSTRAINT [CleaningVisit_geoValidated_df] DEFAULT 0,
    [beforePhotos] NVARCHAR(max) NOT NULL CONSTRAINT [CleaningVisit_beforePhotos_df] DEFAULT '[]',
    [afterPhotos] NVARCHAR(max) NOT NULL CONSTRAINT [CleaningVisit_afterPhotos_df] DEFAULT '[]',
    [checklistScore] INT,
    [photoScore] INT,
    [qualityScore] INT,
    [scheduleStatus] NVARCHAR(64) NOT NULL CONSTRAINT [CleaningVisit_scheduleStatus_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [CleaningVisit_status_df] DEFAULT '',
    [notes] NVARCHAR(1000),
    [signedOffById] NVARCHAR(36),
    [signedOffAt] DATETIME2,
    [signOffNotes] NVARCHAR(1000),
    [supervisorRating] INT,
    [supervisorComment] NVARCHAR(1000),
    [rejectionReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CleaningVisit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CleaningVisit_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CleaningChecklist] (
    [id] NVARCHAR(36) NOT NULL,
    [visitId] NVARCHAR(36) NOT NULL,
    [items] NVARCHAR(max) NOT NULL,
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CleaningChecklist_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CleaningChecklist_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CleaningChecklist_visitId_key] UNIQUE NONCLUSTERED ([visitId])
);

-- CreateTable
CREATE TABLE [dbo].[RequestProblemCategory] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [sortOrder] INT NOT NULL CONSTRAINT [RequestProblemCategory_sortOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [RequestProblemCategory_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RequestProblemCategory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RequestProblemCategory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RequestProblemCategory_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[MaintenanceRequest] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [requestNumber] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [MaintenanceRequest_status_df] DEFAULT '',
    [priority] NVARCHAR(64) NOT NULL CONSTRAINT [MaintenanceRequest_priority_df] DEFAULT '',
    [requestedPriority] NVARCHAR(64),
    [reportedById] NVARCHAR(36) NOT NULL,
    [reportedAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceRequest_reportedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [failureNoticedAt] DATETIME2,
    [assetId] NVARCHAR(36),
    [siteId] NVARCHAR(36),
    [functionalLocationId] NVARCHAR(36),
    [departmentId] NVARCHAR(36),
    [domainId] NVARCHAR(36),
    [problemCategoryId] NVARCHAR(36),
    [problemCategoryLabel] NVARCHAR(1000),
    [description] NVARCHAR(1000) NOT NULL,
    [affectsOperation] BIT NOT NULL CONSTRAINT [MaintenanceRequest_affectsOperation_df] DEFAULT 0,
    [businessImpact] NVARCHAR(1000),
    [isEmergency] BIT NOT NULL CONSTRAINT [MaintenanceRequest_isEmergency_df] DEFAULT 0,
    [contextSnapshot] NVARCHAR(max),
    [triageNotes] NVARCHAR(1000),
    [publicUpdateNote] NVARCHAR(1000),
    [triageOwnerId] NVARCHAR(36),
    [reviewedAt] DATETIME2,
    [approvedAt] DATETIME2,
    [rejectedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [convertedAt] DATETIME2,
    [rejectionReasonType] NVARCHAR(64),
    [rejectionReason] NVARCHAR(1000),
    [cancellationReason] NVARCHAR(1000),
    [duplicateOfId] NVARCHAR(36),
    [relatedRequestId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36),
    [idempotencyKey] NVARCHAR(1000),
    [legacySourceType] NVARCHAR(1000),
    [legacySourceId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MaintenanceRequest_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MaintenanceRequest_workOrderId_key] UNIQUE NONCLUSTERED ([workOrderId]),
    CONSTRAINT [MaintenanceRequest_tenantId_requestNumber_key] UNIQUE NONCLUSTERED ([tenantId],[requestNumber])
);

-- CreateTable
CREATE TABLE [dbo].[MaintenanceRequestHistory] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [requestId] NVARCHAR(36) NOT NULL,
    [fromStatus] NVARCHAR(64),
    [toStatus] NVARCHAR(64),
    [action] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(1000),
    [metadata] NVARCHAR(max),
    [actorId] NVARCHAR(36),
    [isInternal] BIT NOT NULL CONSTRAINT [MaintenanceRequestHistory_isInternal_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceRequestHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [MaintenanceRequestHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[FacilityIssue] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [locationId] NVARCHAR(36),
    [roomId] NVARCHAR(36),
    [reportedById] NVARCHAR(36) NOT NULL,
    [assignedToId] NVARCHAR(36),
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(64),
    [severity] NVARCHAR(64) NOT NULL CONSTRAINT [FacilityIssue_severity_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [FacilityIssue_status_df] DEFAULT '',
    [photos] NVARCHAR(max) NOT NULL CONSTRAINT [FacilityIssue_photos_df] DEFAULT '[]',
    [slaTargetAt] DATETIME2,
    [firstResponseAt] DATETIME2,
    [resolvedById] NVARCHAR(36),
    [resolvedAt] DATETIME2,
    [closedAt] DATETIME2,
    [resolutionMinutes] INT,
    [resolution] NVARCHAR(1000),
    [workOrderId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FacilityIssue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [FacilityIssue_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FacilityIssue_workOrderId_key] UNIQUE NONCLUSTERED ([workOrderId])
);

-- CreateTable
CREATE TABLE [dbo].[EvidenceAttachment] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36),
    [facilityIssueId] NVARCHAR(36),
    [maintenanceRequestId] NVARCHAR(36),
    [evidenceType] NVARCHAR(64) NOT NULL CONSTRAINT [EvidenceAttachment_evidenceType_df] DEFAULT '',
    [fileName] NVARCHAR(1000) NOT NULL,
    [mimeType] NVARCHAR(1000) NOT NULL,
    [sizeBytes] INT NOT NULL,
    [storageProvider] NVARCHAR(1000) NOT NULL,
    [storageKey] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [EvidenceAttachment_status_df] DEFAULT '',
    [verificationStatus] NVARCHAR(64) NOT NULL CONSTRAINT [EvidenceAttachment_verificationStatus_df] DEFAULT '',
    [rejectedReason] NVARCHAR(1000),
    [note] NVARCHAR(1000),
    [isRequired] BIT NOT NULL CONSTRAINT [EvidenceAttachment_isRequired_df] DEFAULT 0,
    [capturedAt] DATETIME2,
    [source] NVARCHAR(64) NOT NULL CONSTRAINT [EvidenceAttachment_source_df] DEFAULT '',
    [clientGeneratedId] NVARCHAR(1000),
    [offlineCreatedAt] DATETIME2,
    [syncedAt] DATETIME2,
    [syncStatus] NVARCHAR(64),
    [syncError] NVARCHAR(1000),
    [deletedAt] DATETIME2,
    [deletedById] NVARCHAR(36),
    [deleteReason] NVARCHAR(1000),
    [uploadedById] NVARCHAR(36) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EvidenceAttachment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EvidenceAttachment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Field] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [blockCode] NVARCHAR(1000),
    [areaHectares] FLOAT(53) NOT NULL,
    [soilType] NVARCHAR(64) NOT NULL CONSTRAINT [Field_soilType_df] DEFAULT '',
    [gpsPolygon] NVARCHAR(max),
    [irrigationZone] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [Field_status_df] DEFAULT '',
    [archivedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Field_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Field_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CropCycle] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [fieldId] NVARCHAR(36) NOT NULL,
    [cropType] NVARCHAR(1000) NOT NULL,
    [variety] NVARCHAR(1000),
    [plantingDate] DATETIME2 NOT NULL,
    [expectedHarvestDate] DATETIME2,
    [actualHarvestDate] DATETIME2,
    [expectedYieldKg] FLOAT(53),
    [actualYieldKg] FLOAT(53),
    [seedCostLkr] FLOAT(53) CONSTRAINT [CropCycle_seedCostLkr_df] DEFAULT 0,
    [fertilizerCostLkr] FLOAT(53) CONSTRAINT [CropCycle_fertilizerCostLkr_df] DEFAULT 0,
    [pesticideCostLkr] FLOAT(53) CONSTRAINT [CropCycle_pesticideCostLkr_df] DEFAULT 0,
    [laborCostLkr] FLOAT(53) CONSTRAINT [CropCycle_laborCostLkr_df] DEFAULT 0,
    [irrigationCostLkr] FLOAT(53) CONSTRAINT [CropCycle_irrigationCostLkr_df] DEFAULT 0,
    [otherCostLkr] FLOAT(53) CONSTRAINT [CropCycle_otherCostLkr_df] DEFAULT 0,
    [revenueLkr] FLOAT(53) CONSTRAINT [CropCycle_revenueLkr_df] DEFAULT 0,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [CropCycle_status_df] DEFAULT '',
    [notes] NVARCHAR(1000),
    [archivedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CropCycle_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CropCycle_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[HarvestRecord] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [cropCycleId] NVARCHAR(36) NOT NULL,
    [harvestDate] DATETIME2 NOT NULL,
    [quantityKg] FLOAT(53) NOT NULL,
    [qualityGrade] NVARCHAR(64) NOT NULL CONSTRAINT [HarvestRecord_qualityGrade_df] DEFAULT '',
    [moistureLevel] FLOAT(53),
    [storageLocation] NVARCHAR(1000),
    [batchCode] NVARCHAR(1000),
    [harvestedById] NVARCHAR(36),
    [pricePerKgLkr] FLOAT(53),
    [totalValueLkr] FLOAT(53),
    [buyerName] NVARCHAR(1000),
    [photos] NVARCHAR(max) NOT NULL CONSTRAINT [HarvestRecord_photos_df] DEFAULT '[]',
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [HarvestRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [HarvestRecord_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LivestockAnimal] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [tagNumber] NVARCHAR(1000) NOT NULL,
    [species] NVARCHAR(64) NOT NULL,
    [breed] NVARCHAR(1000),
    [gender] NVARCHAR(64) NOT NULL,
    [dateOfBirth] DATETIME2,
    [purchaseDate] DATETIME2,
    [purchasePriceLkr] FLOAT(53),
    [weightKg] FLOAT(53),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [LivestockAnimal_status_df] DEFAULT '',
    [qrCodeUrl] NVARCHAR(1000),
    [archivedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LivestockAnimal_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LivestockAnimal_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AnimalHealthRecord] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [animalId] NVARCHAR(36) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [type] NVARCHAR(64) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [vetName] NVARCHAR(1000),
    [medicineName] NVARCHAR(1000),
    [dosage] NVARCHAR(1000),
    [costLkr] FLOAT(53),
    [nextDueDate] DATETIME2,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AnimalHealthRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AnimalHealthRecord_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AnimalProductionLog] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [animalId] NVARCHAR(36) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [type] NVARCHAR(64) NOT NULL,
    [quantityLiters] FLOAT(53),
    [quantityCount] INT,
    [quantityKg] FLOAT(53),
    [qualityGrade] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AnimalProductionLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AnimalProductionLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[FeedingLog] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [animalId] NVARCHAR(36),
    [groupLabel] NVARCHAR(1000),
    [feedType] NVARCHAR(1000) NOT NULL,
    [quantityKg] FLOAT(53) NOT NULL,
    [costLkr] FLOAT(53),
    [fedById] NVARCHAR(36),
    [date] DATETIME2 NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FeedingLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [FeedingLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[IrrigationLog] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [fieldId] NVARCHAR(36) NOT NULL,
    [startTime] DATETIME2 NOT NULL,
    [endTime] DATETIME2,
    [durationMinutes] INT,
    [waterUsedLiters] FLOAT(53),
    [method] NVARCHAR(64) NOT NULL,
    [pumpAssetId] NVARCHAR(36),
    [operatorId] NVARCHAR(36),
    [costLkr] FLOAT(53),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [IrrigationLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [IrrigationLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SprayLog] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [fieldId] NVARCHAR(36) NOT NULL,
    [cropCycleId] NVARCHAR(36),
    [date] DATETIME2 NOT NULL,
    [chemicalName] NVARCHAR(1000) NOT NULL,
    [chemicalType] NVARCHAR(64) NOT NULL,
    [targetPestDisease] NVARCHAR(1000),
    [dosagePerHectare] FLOAT(53),
    [totalQuantityUsed] FLOAT(53),
    [unit] NVARCHAR(1000) NOT NULL,
    [costLkr] FLOAT(53),
    [operatorId] NVARCHAR(36),
    [equipmentAssetId] NVARCHAR(36),
    [weatherAtTime] NVARCHAR(1000),
    [reEntryIntervalHrs] INT,
    [priorHarvestDays] INT,
    [complianceFlag] BIT NOT NULL CONSTRAINT [SprayLog_complianceFlag_df] DEFAULT 0,
    [photos] NVARCHAR(max) NOT NULL CONSTRAINT [SprayLog_photos_df] DEFAULT '[]',
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SprayLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SprayLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SoilTest] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [fieldId] NVARCHAR(36) NOT NULL,
    [testDate] DATETIME2 NOT NULL,
    [ph] FLOAT(53),
    [nitrogenPpm] FLOAT(53),
    [phosphorusPpm] FLOAT(53),
    [potassiumPpm] FLOAT(53),
    [organicMatterPct] FLOAT(53),
    [recommendation] NVARCHAR(1000),
    [labName] NVARCHAR(1000),
    [reportUrl] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SoilTest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SoilTest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WeatherLog] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [recordedAt] DATETIME2 NOT NULL,
    [temperatureC] FLOAT(53),
    [rainfallMm] FLOAT(53),
    [humidityPct] FLOAT(53),
    [windSpeedKmh] FLOAT(53),
    [condition] NVARCHAR(1000),
    [source] NVARCHAR(64) NOT NULL CONSTRAINT [WeatherLog_source_df] DEFAULT '',
    [alertTriggered] BIT NOT NULL CONSTRAINT [WeatherLog_alertTriggered_df] DEFAULT 0,
    [alertType] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WeatherLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WeatherLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[FarmWorker] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36),
    [name] NVARCHAR(1000) NOT NULL,
    [nic] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [workerType] NVARCHAR(64) NOT NULL,
    [dailyWageLkr] FLOAT(53),
    [skillTags] NVARCHAR(max) NOT NULL CONSTRAINT [FarmWorker_skillTags_df] DEFAULT '[]',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [FarmWorker_status_df] DEFAULT '',
    [qrCodeUrl] NVARCHAR(1000),
    [archivedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FarmWorker_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [FarmWorker_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AttendanceLog] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workerId] NVARCHAR(36) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [status] NVARCHAR(64) NOT NULL,
    [checkInTime] DATETIME2,
    [checkOutTime] DATETIME2,
    [hoursWorked] FLOAT(53),
    [taskArea] NVARCHAR(1000),
    [wageLkr] FLOAT(53),
    [markedById] NVARCHAR(36),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AttendanceLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AttendanceLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[FarmExpense] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [category] NVARCHAR(64) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [amountLkr] FLOAT(53) NOT NULL,
    [cropCycleId] NVARCHAR(36),
    [fieldId] NVARCHAR(36),
    [referenceId] NVARCHAR(1000),
    [paymentMethod] NVARCHAR(64) NOT NULL CONSTRAINT [FarmExpense_paymentMethod_df] DEFAULT '',
    [receiptUrl] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FarmExpense_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [FarmExpense_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[FarmIncome] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [source] NVARCHAR(64) NOT NULL,
    [cropType] NVARCHAR(1000),
    [quantityKg] FLOAT(53),
    [pricePerKgLkr] FLOAT(53),
    [totalLkr] FLOAT(53) NOT NULL,
    [buyerName] NVARCHAR(1000),
    [invoiceUrl] NVARCHAR(1000),
    [cropCycleId] NVARCHAR(36),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FarmIncome_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [FarmIncome_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TraceabilityRecord] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [batchCode] NVARCHAR(1000) NOT NULL,
    [cropCycleId] NVARCHAR(36) NOT NULL,
    [harvestRecordId] NVARCHAR(36),
    [fieldId] NVARCHAR(36) NOT NULL,
    [soilTestId] NVARCHAR(36),
    [harvestDate] DATETIME2 NOT NULL,
    [buyerName] NVARCHAR(1000),
    [certifications] NVARCHAR(max) NOT NULL CONSTRAINT [TraceabilityRecord_certifications_df] DEFAULT '[]',
    [qrCodeUrl] NVARCHAR(1000),
    [publicUrl] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TraceabilityRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TraceabilityRecord_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[VehicleDocument] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [vehicleId] NVARCHAR(36) NOT NULL,
    [documentType] NVARCHAR(64) NOT NULL,
    [documentNumber] NVARCHAR(1000),
    [issuedDate] DATETIME2,
    [expiryDate] DATETIME2 NOT NULL,
    [issuingAuthority] NVARCHAR(1000),
    [fileUrl] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [VehicleDocument_status_df] DEFAULT '',
    [verifiedById] NVARCHAR(36),
    [verifiedAt] DATETIME2,
    [rejectionReason] NVARCHAR(1000),
    [uploadedById] NVARCHAR(36) NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VehicleDocument_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VehicleDocument_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AccidentReport] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [reportNumber] NVARCHAR(1000) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [driverId] NVARCHAR(36),
    [reportedById] NVARCHAR(36) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL,
    [location] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(64) NOT NULL CONSTRAINT [AccidentReport_severity_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [AccidentReport_status_df] DEFAULT '',
    [responsibility] NVARCHAR(64) NOT NULL CONSTRAINT [AccidentReport_responsibility_df] DEFAULT '',
    [thirdPartyInvolved] BIT NOT NULL CONSTRAINT [AccidentReport_thirdPartyInvolved_df] DEFAULT 0,
    [thirdPartyDetails] NVARCHAR(1000),
    [policeReportNo] NVARCHAR(1000),
    [estimatedDamageCost] FLOAT(53),
    [actualDamageCost] FLOAT(53),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AccidentReport_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AccidentReport_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AccidentReport_reportNumber_key] UNIQUE NONCLUSTERED ([reportNumber])
);

-- CreateTable
CREATE TABLE [dbo].[AccidentEvidence] (
    [id] NVARCHAR(36) NOT NULL,
    [accidentId] NVARCHAR(36) NOT NULL,
    [evidenceType] NVARCHAR(64) NOT NULL,
    [fileUrl] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [uploadedById] NVARCHAR(36) NOT NULL,
    [uploadedAt] DATETIME2 NOT NULL CONSTRAINT [AccidentEvidence_uploadedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AccidentEvidence_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[InsuranceClaim] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [claimNumber] NVARCHAR(1000) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [accidentId] NVARCHAR(36),
    [policyNumber] NVARCHAR(1000) NOT NULL,
    [insurerName] NVARCHAR(1000) NOT NULL,
    [claimAmount] FLOAT(53) NOT NULL,
    [approvedAmount] FLOAT(53),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [InsuranceClaim_status_df] DEFAULT '',
    [filedAt] DATETIME2,
    [settledAt] DATETIME2,
    [filedById] NVARCHAR(36) NOT NULL,
    [documents] NVARCHAR(max) NOT NULL CONSTRAINT [InsuranceClaim_documents_df] DEFAULT '[]',
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InsuranceClaim_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InsuranceClaim_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [InsuranceClaim_claimNumber_key] UNIQUE NONCLUSTERED ([claimNumber])
);

-- CreateTable
CREATE TABLE [dbo].[TrafficFine] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [fineNumber] NVARCHAR(1000) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [driverId] NVARCHAR(36),
    [reportedById] NVARCHAR(36) NOT NULL,
    [fineDate] DATETIME2 NOT NULL,
    [dueDate] DATETIME2,
    [location] NVARCHAR(1000),
    [violationCode] NVARCHAR(1000),
    [description] NVARCHAR(1000) NOT NULL,
    [fineAmount] FLOAT(53) NOT NULL,
    [issuingAuthority] NVARCHAR(1000),
    [responsibility] NVARCHAR(64) NOT NULL CONSTRAINT [TrafficFine_responsibility_df] DEFAULT '',
    [documentRelated] BIT NOT NULL CONSTRAINT [TrafficFine_documentRelated_df] DEFAULT 0,
    [paymentStatus] NVARCHAR(64) NOT NULL CONSTRAINT [TrafficFine_paymentStatus_df] DEFAULT '',
    [paidAt] DATETIME2,
    [paidAmount] FLOAT(53),
    [paymentReference] NVARCHAR(1000),
    [evidenceUrls] NVARCHAR(max) NOT NULL CONSTRAINT [TrafficFine_evidenceUrls_df] DEFAULT '[]',
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrafficFine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrafficFine_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TrafficFine_fineNumber_key] UNIQUE NONCLUSTERED ([fineNumber])
);

-- CreateTable
CREATE TABLE [dbo].[QaIssue] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [issueNo] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(64) NOT NULL,
    [subCategory] NVARCHAR(1000),
    [severity] NVARCHAR(64) NOT NULL CONSTRAINT [QaIssue_severity_df] DEFAULT '',
    [priority] NVARCHAR(64) NOT NULL CONSTRAINT [QaIssue_priority_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [QaIssue_status_df] DEFAULT '',
    [affectedModule] NVARCHAR(1000),
    [affectedPage] NVARCHAR(1000),
    [affectedApi] NVARCHAR(1000),
    [environment] NVARCHAR(64) NOT NULL CONSTRAINT [QaIssue_environment_df] DEFAULT '',
    [reportedByUserId] NVARCHAR(36) NOT NULL,
    [assignedToUserId] NVARCHAR(36),
    [ownerDepartment] NVARCHAR(1000),
    [businessImpact] NVARCHAR(1000),
    [userImpact] NVARCHAR(1000),
    [reproductionSteps] NVARCHAR(1000),
    [expectedResult] NVARCHAR(1000),
    [actualResult] NVARCHAR(1000),
    [rootCause] NVARCHAR(1000),
    [fixSummary] NVARCHAR(1000),
    [workaround] NVARCHAR(1000),
    [regressionRisk] NVARCHAR(1000),
    [linkedCommitHash] NVARCHAR(1000),
    [linkedDeployId] NVARCHAR(1000),
    [linkedUatPhase] NVARCHAR(1000),
    [linkedWorkOrderId] NVARCHAR(36),
    [linkedIncidentId] NVARCHAR(36),
    [attachmentMetadata] NVARCHAR(max),
    [isSensitive] BIT NOT NULL CONSTRAINT [QaIssue_isSensitive_df] DEFAULT 0,
    [resolutionNote] NVARCHAR(1000),
    [acceptedRiskByUserId] NVARCHAR(36),
    [acceptedRiskAt] DATETIME2,
    [riskReviewDate] DATETIME2,
    [futureFixPlan] NVARCHAR(1000),
    [knownLimitation] NVARCHAR(1000),
    [regressionRequired] BIT NOT NULL CONSTRAINT [QaIssue_regressionRequired_df] DEFAULT 0,
    [regressionResult] NVARCHAR(64),
    [firstDetectedAt] DATETIME2,
    [fixedAt] DATETIME2,
    [closedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [QaIssue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [QaIssue_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [QaIssue_tenantId_issueNo_key] UNIQUE NONCLUSTERED ([tenantId],[issueNo])
);

-- CreateTable
CREATE TABLE [dbo].[QaIssueRca] (
    [id] NVARCHAR(36) NOT NULL,
    [issueId] NVARCHAR(36) NOT NULL,
    [rootCauseType] NVARCHAR(64) NOT NULL,
    [explanation] NVARCHAR(1000) NOT NULL,
    [preventiveAction] NVARCHAR(1000),
    [ownerUserId] NVARCHAR(36),
    [dueDate] DATETIME2,
    [verificationStatus] NVARCHAR(1000),
    [createdByUserId] NVARCHAR(36) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [QaIssueRca_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [QaIssueRca_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[QaRegressionTest] (
    [id] NVARCHAR(36) NOT NULL,
    [issueId] NVARCHAR(36) NOT NULL,
    [testCase] NVARCHAR(1000) NOT NULL,
    [testedByUserId] NVARCHAR(36) NOT NULL,
    [testDate] DATETIME2 NOT NULL,
    [roleUsed] NVARCHAR(1000),
    [environment] NVARCHAR(64) NOT NULL,
    [result] NVARCHAR(64) NOT NULL,
    [notes] NVARCHAR(1000),
    [reference] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [QaRegressionTest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [QaRegressionTest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[DeliveryChecklist] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [checklistNo] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(64) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [DeliveryChecklist_status_df] DEFAULT '',
    [priority] NVARCHAR(64) NOT NULL CONSTRAINT [DeliveryChecklist_priority_df] DEFAULT '',
    [requiredForDelivery] BIT NOT NULL CONSTRAINT [DeliveryChecklist_requiredForDelivery_df] DEFAULT 1,
    [ownerUserId] NVARCHAR(36),
    [evidence] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [acceptedRiskReason] NVARCHAR(1000),
    [acceptedByUserId] NVARCHAR(36),
    [completedByUserId] NVARCHAR(36),
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DeliveryChecklist_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DeliveryChecklist_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DeliveryChecklist_tenantId_checklistNo_key] UNIQUE NONCLUSTERED ([tenantId],[checklistNo])
);

-- CreateTable
CREATE TABLE [dbo].[DeliveryChecklistItem] (
    [id] NVARCHAR(36) NOT NULL,
    [checklistId] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [category] NVARCHAR(64) NOT NULL,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [DeliveryChecklistItem_status_df] DEFAULT '',
    [evidence] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [testedByUserId] NVARCHAR(36),
    [testedRole] NVARCHAR(1000),
    [testedEnvironment] NVARCHAR(1000),
    [deviceSize] NVARCHAR(1000),
    [responseTimeMs] INT,
    [usabilityRating] INT,
    [blocker] BIT NOT NULL CONSTRAINT [DeliveryChecklistItem_blocker_df] DEFAULT 0,
    [requiredForDelivery] BIT NOT NULL CONSTRAINT [DeliveryChecklistItem_requiredForDelivery_df] DEFAULT 1,
    [signOffRequired] BIT NOT NULL CONSTRAINT [DeliveryChecklistItem_signOffRequired_df] DEFAULT 0,
    [acceptedRiskReason] NVARCHAR(1000),
    [acceptedByUserId] NVARCHAR(36),
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DeliveryChecklistItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DeliveryChecklistItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[DeliverySignOff] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [readinessVerdict] NVARCHAR(64) NOT NULL,
    [signedByUserId] NVARCHAR(36) NOT NULL,
    [role] NVARCHAR(1000),
    [department] NVARCHAR(1000),
    [signedAt] DATETIME2 NOT NULL CONSTRAINT [DeliverySignOff_signedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [notes] NVARCHAR(1000),
    [acceptedRisks] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DeliverySignOff_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [DeliverySignOff_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingSession] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [trainingSessionNo] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(64) NOT NULL,
    [traineeUserId] NVARCHAR(36) NOT NULL,
    [trainerUserId] NVARCHAR(36),
    [module] NVARCHAR(1000),
    [checklistItems] NVARCHAR(max),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [TrainingSession_status_df] DEFAULT '',
    [trainingDate] DATETIME2,
    [evidence] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [signOffByUserId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingSession_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingSession_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TrainingSession_tenantId_trainingSessionNo_key] UNIQUE NONCLUSTERED ([tenantId],[trainingSessionNo])
);

-- CreateTable
CREATE TABLE [dbo].[SupportTicket] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [ticketNo] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(64) NOT NULL,
    [priority] NVARCHAR(64) NOT NULL CONSTRAINT [SupportTicket_priority_df] DEFAULT '',
    [severity] NVARCHAR(64) NOT NULL CONSTRAINT [SupportTicket_severity_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [SupportTicket_status_df] DEFAULT '',
    [reportedByUserId] NVARCHAR(36) NOT NULL,
    [assignedToUserId] NVARCHAR(36),
    [affectedModule] NVARCHAR(1000),
    [affectedPage] NVARCHAR(1000),
    [affectedRole] NVARCHAR(1000),
    [environment] NVARCHAR(64) NOT NULL CONSTRAINT [SupportTicket_environment_df] DEFAULT '',
    [businessImpact] NVARCHAR(1000),
    [workaround] NVARCHAR(1000),
    [resolutionNote] NVARCHAR(1000),
    [rootCause] NVARCHAR(1000),
    [linkedQaIssueId] NVARCHAR(36),
    [linkedChangeRequestId] NVARCHAR(36),
    [isSensitive] BIT NOT NULL CONSTRAINT [SupportTicket_isSensitive_df] DEFAULT 0,
    [slaPriority] NVARCHAR(64) NOT NULL CONSTRAINT [SupportTicket_slaPriority_df] DEFAULT '',
    [firstResponseDueAt] DATETIME2,
    [resolutionDueAt] DATETIME2,
    [firstResponseAt] DATETIME2,
    [firstResponseBreached] BIT NOT NULL CONSTRAINT [SupportTicket_firstResponseBreached_df] DEFAULT 0,
    [resolutionBreached] BIT NOT NULL CONSTRAINT [SupportTicket_resolutionBreached_df] DEFAULT 0,
    [escalationLevel] INT NOT NULL CONSTRAINT [SupportTicket_escalationLevel_df] DEFAULT 1,
    [escalatedAt] DATETIME2,
    [resolvedAt] DATETIME2,
    [closedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SupportTicket_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SupportTicket_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SupportTicket_tenantId_ticketNo_key] UNIQUE NONCLUSTERED ([tenantId],[ticketNo])
);

-- CreateTable
CREATE TABLE [dbo].[EscalationRule] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [category] NVARCHAR(64),
    [severity] NVARCHAR(64),
    [escalationLevel] INT NOT NULL,
    [responsibleRole] NVARCHAR(1000) NOT NULL,
    [responsibleUserId] NVARCHAR(36),
    [responseTimeMinutes] INT,
    [escalationAfterMinutes] INT NOT NULL,
    [notificationMethod] NVARCHAR(64) NOT NULL CONSTRAINT [EscalationRule_notificationMethod_df] DEFAULT '',
    [active] BIT NOT NULL CONSTRAINT [EscalationRule_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EscalationRule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EscalationRule_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ChangeRequest] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [crNo] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [requestedByUserId] NVARCHAR(36) NOT NULL,
    [department] NVARCHAR(1000),
    [affectedModule] NVARCHAR(1000),
    [businessReason] NVARCHAR(1000),
    [priority] NVARCHAR(64) NOT NULL CONSTRAINT [ChangeRequest_priority_df] DEFAULT '',
    [impactLevel] NVARCHAR(64) NOT NULL CONSTRAINT [ChangeRequest_impactLevel_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [ChangeRequest_status_df] DEFAULT '',
    [estimatedEffort] NVARCHAR(1000),
    [estimatedCost] FLOAT(53),
    [approvedByUserId] NVARCHAR(36),
    [approvalNote] NVARCHAR(1000),
    [rejectionReason] NVARCHAR(1000),
    [linkedTicketId] NVARCHAR(36),
    [linkedQaIssueId] NVARCHAR(36),
    [linkedReleaseId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ChangeRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ChangeRequest_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ChangeRequest_tenantId_crNo_key] UNIQUE NONCLUSTERED ([tenantId],[crNo])
);

-- CreateTable
CREATE TABLE [dbo].[SoftwareRelease] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [releaseNo] NVARCHAR(1000) NOT NULL,
    [version] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [releaseType] NVARCHAR(64) NOT NULL CONSTRAINT [SoftwareRelease_releaseType_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [SoftwareRelease_status_df] DEFAULT '',
    [linkedChangeRequests] NVARCHAR(max) NOT NULL CONSTRAINT [SoftwareRelease_linkedChangeRequests_df] DEFAULT '[]',
    [linkedQaIssues] NVARCHAR(max) NOT NULL CONSTRAINT [SoftwareRelease_linkedQaIssues_df] DEFAULT '[]',
    [linkedTickets] NVARCHAR(max) NOT NULL CONSTRAINT [SoftwareRelease_linkedTickets_df] DEFAULT '[]',
    [commitHash] NVARCHAR(1000),
    [renderDeployId] NVARCHAR(1000),
    [cloudflareDeployId] NVARCHAR(1000),
    [releaseNotes] NVARCHAR(1000),
    [rollbackPlan] NVARCHAR(1000),
    [backupTaken] BIT NOT NULL CONSTRAINT [SoftwareRelease_backupTaken_df] DEFAULT 0,
    [backupReference] NVARCHAR(1000),
    [rollbackReason] NVARCHAR(1000),
    [deployedByUserId] NVARCHAR(36),
    [deployedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SoftwareRelease_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SoftwareRelease_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SoftwareRelease_tenantId_releaseNo_key] UNIQUE NONCLUSTERED ([tenantId],[releaseNo])
);

-- CreateTable
CREATE TABLE [dbo].[HypercarePlan] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [hypercarePeriodName] NVARCHAR(1000) NOT NULL,
    [startDate] DATETIME2 NOT NULL,
    [endDate] DATETIME2 NOT NULL,
    [supportOwner] NVARCHAR(1000),
    [dailyChecklist] NVARCHAR(max),
    [dailyIssueCount] INT NOT NULL CONSTRAINT [HypercarePlan_dailyIssueCount_df] DEFAULT 0,
    [openCriticalIssues] INT NOT NULL CONSTRAINT [HypercarePlan_openCriticalIssues_df] DEFAULT 0,
    [openHighIssues] INT NOT NULL CONSTRAINT [HypercarePlan_openHighIssues_df] DEFAULT 0,
    [userFeedback] NVARCHAR(1000),
    [trainingGaps] NVARCHAR(1000),
    [readinessStatus] NVARCHAR(64) NOT NULL CONSTRAINT [HypercarePlan_readinessStatus_df] DEFAULT '',
    [extensionReason] NVARCHAR(1000),
    [signOffByUserId] NVARCHAR(36),
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [HypercarePlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [HypercarePlan_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SupportHandover] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [systemUrls] NVARCHAR(1000),
    [rolesResponsibilities] NVARCHAR(1000),
    [supportContacts] NVARCHAR(1000),
    [escalationMatrix] NVARCHAR(1000),
    [backupProcess] NVARCHAR(1000),
    [restoreProcess] NVARCHAR(1000),
    [deploymentProcess] NVARCHAR(1000),
    [rollbackProcess] NVARCHAR(1000),
    [knownLimitations] NVARCHAR(1000),
    [commonIssuesFixes] NVARCHAR(1000),
    [trainingMaterials] NVARCHAR(1000),
    [changeRequestProcess] NVARCHAR(1000),
    [incidentProcess] NVARCHAR(1000),
    [updatedByUserId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SupportHandover_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SupportHandover_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SupportHandover_tenantId_key] UNIQUE NONCLUSTERED ([tenantId])
);

-- CreateTable
CREATE TABLE [dbo].[PilotRollout] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [pilotName] NVARCHAR(1000) NOT NULL,
    [department] NVARCHAR(1000),
    [branch] NVARCHAR(1000),
    [startDate] DATETIME2,
    [endDate] DATETIME2,
    [pilotOwnerUserId] NVARCHAR(36),
    [selectedUsers] NVARCHAR(max),
    [selectedRoles] NVARCHAR(max),
    [selectedModules] NVARCHAR(max),
    [successCriteria] NVARCHAR(1000),
    [riskLevel] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [PilotRollout_status_df] DEFAULT '',
    [notes] NVARCHAR(1000),
    [trainedUsersCount] INT NOT NULL CONSTRAINT [PilotRollout_trainedUsersCount_df] DEFAULT 0,
    [activeUsersCount] INT NOT NULL CONSTRAINT [PilotRollout_activeUsersCount_df] DEFAULT 0,
    [workOrdersCreated] INT NOT NULL CONSTRAINT [PilotRollout_workOrdersCreated_df] DEFAULT 0,
    [issuesReported] INT NOT NULL CONSTRAINT [PilotRollout_issuesReported_df] DEFAULT 0,
    [criticalBlockers] INT NOT NULL CONSTRAINT [PilotRollout_criticalBlockers_df] DEFAULT 0,
    [userFeedback] NVARCHAR(1000),
    [managerFeedback] NVARCHAR(1000),
    [pilotResult] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PilotRollout_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PilotRollout_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CutoverChecklistItem] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [itemKey] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [CutoverChecklistItem_status_df] DEFAULT '',
    [blocker] BIT NOT NULL CONSTRAINT [CutoverChecklistItem_blocker_df] DEFAULT 0,
    [owner] NVARCHAR(1000),
    [evidence] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [completedByUserId] NVARCHAR(36),
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CutoverChecklistItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CutoverChecklistItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CutoverChecklistItem_tenantId_itemKey_key] UNIQUE NONCLUSTERED ([tenantId],[itemKey])
);

-- CreateTable
CREATE TABLE [dbo].[RolloutWave] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [waveNo] INT NOT NULL,
    [waveName] NVARCHAR(1000) NOT NULL,
    [departments] NVARCHAR(max),
    [branches] NVARCHAR(max),
    [roles] NVARCHAR(max),
    [users] NVARCHAR(max),
    [plannedStartDate] DATETIME2,
    [plannedEndDate] DATETIME2,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [RolloutWave_status_df] DEFAULT '',
    [successCriteria] NVARCHAR(1000),
    [blockers] NVARCHAR(max),
    [notes] NVARCHAR(1000),
    [signOffByUserId] NVARCHAR(36),
    [signOffAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RolloutWave_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RolloutWave_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RolloutWave_tenantId_waveNo_key] UNIQUE NONCLUSTERED ([tenantId],[waveNo])
);

-- CreateTable
CREATE TABLE [dbo].[GoLiveDecision] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [decision] NVARCHAR(64) NOT NULL,
    [decisionStage] NVARCHAR(64) NOT NULL CONSTRAINT [GoLiveDecision_decisionStage_df] DEFAULT '',
    [applicationCommitSha] NVARCHAR(1000),
    [evidenceClass] NVARCHAR(64) NOT NULL CONSTRAINT [GoLiveDecision_evidenceClass_df] DEFAULT '',
    [reason] NVARCHAR(1000),
    [criteriaSnapshot] NVARCHAR(max),
    [recordedByUserId] NVARCHAR(36) NOT NULL,
    [openCriticalIssues] INT NOT NULL CONSTRAINT [GoLiveDecision_openCriticalIssues_df] DEFAULT 0,
    [backupCompleted] BIT NOT NULL CONSTRAINT [GoLiveDecision_backupCompleted_df] DEFAULT 0,
    [rollbackReady] BIT NOT NULL CONSTRAINT [GoLiveDecision_rollbackReady_df] DEFAULT 0,
    [pilotUsersTrained] BIT NOT NULL CONSTRAINT [GoLiveDecision_pilotUsersTrained_df] DEFAULT 0,
    [smokeTestPassed] BIT NOT NULL CONSTRAINT [GoLiveDecision_smokeTestPassed_df] DEFAULT 0,
    [coreWorkflowsWorking] BIT NOT NULL CONSTRAINT [GoLiveDecision_coreWorkflowsWorking_df] DEFAULT 0,
    [supportProcessReady] BIT NOT NULL CONSTRAINT [GoLiveDecision_supportProcessReady_df] DEFAULT 0,
    [managementSignOffDone] BIT NOT NULL CONSTRAINT [GoLiveDecision_managementSignOffDone_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GoLiveDecision_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [GoLiveDecision_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[RollbackPlan] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [rollbackPlanNo] NVARCHAR(1000) NOT NULL,
    [versionBeforeGoLive] NVARCHAR(1000),
    [currentVersion] NVARCHAR(1000),
    [rollbackTrigger] NVARCHAR(1000),
    [rollbackSteps] NVARCHAR(1000),
    [databaseRestoreReference] NVARCHAR(1000),
    [codeCommitReference] NVARCHAR(1000),
    [responsibleUserId] NVARCHAR(36),
    [estimatedRollbackMinutes] INT,
    [testedStatus] NVARCHAR(64) NOT NULL CONSTRAINT [RollbackPlan_testedStatus_df] DEFAULT '',
    [approvedByUserId] NVARCHAR(36),
    [notes] NVARCHAR(1000),
    [active] BIT NOT NULL CONSTRAINT [RollbackPlan_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RollbackPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RollbackPlan_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RollbackPlan_tenantId_rollbackPlanNo_key] UNIQUE NONCLUSTERED ([tenantId],[rollbackPlanNo])
);

-- CreateTable
CREATE TABLE [dbo].[GoLiveSignOff] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [signOffRole] NVARCHAR(1000) NOT NULL,
    [signedByUserId] NVARCHAR(36) NOT NULL,
    [decision] NVARCHAR(64) NOT NULL CONSTRAINT [GoLiveSignOff_decision_df] DEFAULT '',
    [comments] NVARCHAR(1000),
    [acceptedRisks] NVARCHAR(1000),
    [applicationCommitSha] NVARCHAR(1000),
    [evidenceClass] NVARCHAR(64) NOT NULL CONSTRAINT [GoLiveSignOff_evidenceClass_df] DEFAULT '',
    [signedAt] DATETIME2,
    [revokedAt] DATETIME2,
    [revokeReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GoLiveSignOff_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GoLiveSignOff_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[UatScenarioExecution] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [scenarioId] NVARCHAR(1000) NOT NULL,
    [executionId] NVARCHAR(1000) NOT NULL,
    [testerId] NVARCHAR(36),
    [roleTested] NVARCHAR(1000),
    [environment] NVARCHAR(1000),
    [applicationCommit] NVARCHAR(1000),
    [executedAt] DATETIME2 NOT NULL CONSTRAINT [UatScenarioExecution_executedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [outcome] NVARCHAR(64) NOT NULL CONSTRAINT [UatScenarioExecution_outcome_df] DEFAULT '',
    [actualResult] NVARCHAR(1000),
    [evidenceReference] NVARCHAR(1000),
    [defectId] NVARCHAR(1000),
    [retestOf] NVARCHAR(1000),
    [evidenceClass] NVARCHAR(64) NOT NULL CONSTRAINT [UatScenarioExecution_evidenceClass_df] DEFAULT '',
    [signedAt] DATETIME2,
    [comments] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UatScenarioExecution_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [UatScenarioExecution_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UatScenarioExecution_tenantId_executionId_key] UNIQUE NONCLUSTERED ([tenantId],[executionId])
);

-- CreateTable
CREATE TABLE [dbo].[ErpFieldMapping] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [sourceSystem] NVARCHAR(1000) NOT NULL CONSTRAINT [ErpFieldMapping_sourceSystem_df] DEFAULT 'BILEETA',
    [sourceField] NVARCHAR(1000) NOT NULL,
    [targetModel] NVARCHAR(1000) NOT NULL,
    [targetField] NVARCHAR(1000) NOT NULL,
    [transformRule] NVARCHAR(1000),
    [required] BIT NOT NULL CONSTRAINT [ErpFieldMapping_required_df] DEFAULT 0,
    [active] BIT NOT NULL CONSTRAINT [ErpFieldMapping_active_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ErpFieldMapping_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ErpFieldMapping_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ErpFieldMapping_tenantId_sourceSystem_sourceField_targetModel_targetField_key] UNIQUE NONCLUSTERED ([tenantId],[sourceSystem],[sourceField],[targetModel],[targetField])
);

-- CreateTable
CREATE TABLE [dbo].[ErpImportBatch] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [batchNo] NVARCHAR(1000) NOT NULL,
    [importType] NVARCHAR(64) NOT NULL,
    [fileName] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [ErpImportBatch_status_df] DEFAULT '',
    [totalRows] INT NOT NULL CONSTRAINT [ErpImportBatch_totalRows_df] DEFAULT 0,
    [selectedRows] INT NOT NULL CONSTRAINT [ErpImportBatch_selectedRows_df] DEFAULT 0,
    [validRows] INT NOT NULL CONSTRAINT [ErpImportBatch_validRows_df] DEFAULT 0,
    [invalidRows] INT NOT NULL CONSTRAINT [ErpImportBatch_invalidRows_df] DEFAULT 0,
    [duplicateRows] INT NOT NULL CONSTRAINT [ErpImportBatch_duplicateRows_df] DEFAULT 0,
    [appliedRows] INT NOT NULL CONSTRAINT [ErpImportBatch_appliedRows_df] DEFAULT 0,
    [failedRows] INT NOT NULL CONSTRAINT [ErpImportBatch_failedRows_df] DEFAULT 0,
    [ignoredRows] INT NOT NULL CONSTRAINT [ErpImportBatch_ignoredRows_df] DEFAULT 0,
    [dryRunSummary] NVARCHAR(max),
    [applySummary] NVARCHAR(max),
    [uploadedByUserId] NVARCHAR(36),
    [approvedByUserId] NVARCHAR(36),
    [errorMessage] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ErpImportBatch_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ErpImportBatch_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ErpImportBatch_tenantId_batchNo_key] UNIQUE NONCLUSTERED ([tenantId],[batchNo])
);

-- CreateTable
CREATE TABLE [dbo].[ErpImportRow] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [importRunId] NVARCHAR(36) NOT NULL,
    [rowNumber] INT NOT NULL,
    [selected] BIT NOT NULL CONSTRAINT [ErpImportRow_selected_df] DEFAULT 0,
    [sourceLineKey] NVARCHAR(1000) NOT NULL,
    [documentStatus] NVARCHAR(1000),
    [warehouseCode] NVARCHAR(1000),
    [warehouseName] NVARCHAR(1000),
    [productCode] NVARCHAR(1000),
    [productDescription] NVARCHAR(1000),
    [uom] NVARCHAR(1000),
    [quantity] INT,
    [requestedQuantity] INT,
    [requester] NVARCHAR(1000),
    [cost] FLOAT(53),
    [batch] NVARCHAR(1000),
    [lot] NVARCHAR(1000),
    [orderNo] NVARCHAR(1000),
    [orderDate] NVARCHAR(1000),
    [mappedPartId] NVARCHAR(36),
    [mappedWarehouseId] NVARCHAR(36),
    [appliedMovementId] NVARCHAR(36),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ErpImportRow_status_df] DEFAULT 'PENDING',
    [errorCode] NVARCHAR(1000),
    [errorMessage] NVARCHAR(1000),
    [sourceFingerprint] NVARCHAR(1000),
    [sourceMetadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ErpImportRow_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ErpImportRow_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ErpImportRow_importRunId_sourceLineKey_key] UNIQUE NONCLUSTERED ([importRunId],[sourceLineKey])
);

-- CreateTable
CREATE TABLE [dbo].[ErpReconciliationMismatch] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [reportType] NVARCHAR(1000) NOT NULL,
    [sourceSystem] NVARCHAR(1000) NOT NULL CONSTRAINT [ErpReconciliationMismatch_sourceSystem_df] DEFAULT 'BILEETA',
    [sourceRecordCode] NVARCHAR(1000) NOT NULL,
    [maintainProRecordId] NVARCHAR(1000),
    [fieldName] NVARCHAR(1000) NOT NULL,
    [erpValue] NVARCHAR(1000),
    [maintainProValue] NVARCHAR(1000),
    [mismatchType] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(1000) NOT NULL CONSTRAINT [ErpReconciliationMismatch_severity_df] DEFAULT 'MEDIUM',
    [suggestedAction] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [ErpReconciliationMismatch_status_df] DEFAULT '',
    [reviewedByUserId] NVARCHAR(36),
    [warehouseId] NVARCHAR(36),
    [partId] NVARCHAR(36),
    [erpQuantity] FLOAT(53),
    [maintainProQuantity] FLOAT(53),
    [variance] FLOAT(53),
    [resolution] NVARCHAR(1000),
    [resolvedAt] DATETIME2,
    [resolvedByUserId] NVARCHAR(36),
    [adjustmentMovementId] NVARCHAR(1000),
    [sourceSnapshot] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ErpReconciliationMismatch_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ErpReconciliationMismatch_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ErpAccessChecklistItem] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [itemKey] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [ErpAccessChecklistItem_status_df] DEFAULT '',
    [notes] NVARCHAR(1000),
    [updatedByUserId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ErpAccessChecklistItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ErpAccessChecklistItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ErpAccessChecklistItem_tenantId_itemKey_key] UNIQUE NONCLUSTERED ([tenantId],[itemKey])
);

-- CreateTable
CREATE TABLE [dbo].[ErpMockSyncRun] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36),
    [syncMode] NVARCHAR(64) NOT NULL CONSTRAINT [ErpMockSyncRun_syncMode_df] DEFAULT '',
    [entityTypes] NVARCHAR(max),
    [recordsFetched] INT NOT NULL CONSTRAINT [ErpMockSyncRun_recordsFetched_df] DEFAULT 0,
    [summary] NVARCHAR(max),
    [startedByUserId] NVARCHAR(36),
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ErpMockSyncRun_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ErpMockSyncRun_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BusinessException] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [ruleCode] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(1000) NOT NULL,
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [module] NVARCHAR(1000) NOT NULL,
    [fingerprint] NVARCHAR(1000) NOT NULL,
    [messageCode] NVARCHAR(1000) NOT NULL,
    [metadata] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [BusinessException_status_df] DEFAULT 'OPEN',
    [assignedToId] NVARCHAR(36),
    [resolution] NVARCHAR(1000),
    [resolvedById] NVARCHAR(36),
    [resolvedAt] DATETIME2,
    [detectedAt] DATETIME2 NOT NULL CONSTRAINT [BusinessException_detectedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BusinessException_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BusinessException_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BusinessException_tenantId_fingerprint_key] UNIQUE NONCLUSTERED ([tenantId],[fingerprint])
);

-- CreateTable
CREATE TABLE [dbo].[PartCompatibility] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [partId] NVARCHAR(36) NOT NULL,
    [vehicleType] NVARCHAR(1000),
    [make] NVARCHAR(1000),
    [vehicleModel] NVARCHAR(1000),
    [engineCode] NVARCHAR(1000),
    [assetId] NVARCHAR(36),
    [assetTypeMasterId] NVARCHAR(36),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PartCompatibility_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PartCompatibility_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[InstalledPart] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [partId] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36),
    [supplierId] NVARCHAR(36),
    [batch] NVARCHAR(1000),
    [lot] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [receivedAt] DATETIME2,
    [installedAt] DATETIME2 NOT NULL CONSTRAINT [InstalledPart_installedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [installedMileage] FLOAT(53),
    [warrantyExpiresAt] DATETIME2,
    [warrantyMileage] FLOAT(53),
    [removedAt] DATETIME2,
    [removedMileage] FLOAT(53),
    [failureReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InstalledPart_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InstalledPart_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[VehicleHealthSnapshot] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36) NOT NULL,
    [score] INT NOT NULL,
    [band] NVARCHAR(1000) NOT NULL,
    [reasons] NVARCHAR(max) NOT NULL,
    [factors] NVARCHAR(max),
    [coverage] NVARCHAR(1000) NOT NULL CONSTRAINT [VehicleHealthSnapshot_coverage_df] DEFAULT 'COMPLETE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VehicleHealthSnapshot_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [VehicleHealthSnapshot_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ProcurementRecommendation] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [partId] NVARCHAR(36) NOT NULL,
    [warehouseId] NVARCHAR(36),
    [fingerprint] NVARCHAR(1000) NOT NULL,
    [onHand] INT NOT NULL,
    [reserved] INT NOT NULL,
    [available] INT NOT NULL,
    [incoming] INT NOT NULL CONSTRAINT [ProcurementRecommendation_incoming_df] DEFAULT 0,
    [forecastNeed] INT NOT NULL CONSTRAINT [ProcurementRecommendation_forecastNeed_df] DEFAULT 0,
    [reorderPoint] INT NOT NULL CONSTRAINT [ProcurementRecommendation_reorderPoint_df] DEFAULT 0,
    [targetStock] INT NOT NULL CONSTRAINT [ProcurementRecommendation_targetStock_df] DEFAULT 0,
    [suggestedQuantity] INT NOT NULL,
    [priority] NVARCHAR(1000) NOT NULL,
    [reasonCodes] NVARCHAR(max) NOT NULL CONSTRAINT [ProcurementRecommendation_reasonCodes_df] DEFAULT '[]',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ProcurementRecommendation_status_df] DEFAULT 'OPEN',
    [purchaseOrderId] NVARCHAR(36),
    [reviewedById] NVARCHAR(36),
    [reviewedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProcurementRecommendation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProcurementRecommendation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProcurementRecommendation_tenantId_fingerprint_key] UNIQUE NONCLUSTERED ([tenantId],[fingerprint])
);

-- CreateTable
CREATE TABLE [dbo].[MaintenanceForecast] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [scheduleId] NVARCHAR(36) NOT NULL,
    [vehicleId] NVARCHAR(36),
    [estimatedDueDate] DATETIME2,
    [remainingKm] FLOAT(53),
    [remainingDays] FLOAT(53),
    [avgKmPerDay] FLOAT(53),
    [coverage] NVARCHAR(1000) NOT NULL,
    [confidence] NVARCHAR(1000),
    [shortageParts] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceForecast_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MaintenanceForecast_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MaintenanceForecast_tenantId_scheduleId_key] UNIQUE NONCLUSTERED ([tenantId],[scheduleId])
);

-- CreateTable
CREATE TABLE [dbo].[DomainEventOutbox] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [eventId] NVARCHAR(1000) NOT NULL,
    [eventType] NVARCHAR(1000) NOT NULL,
    [aggregateType] NVARCHAR(1000) NOT NULL,
    [aggregateId] NVARCHAR(1000) NOT NULL,
    [payloadVersion] INT NOT NULL CONSTRAINT [DomainEventOutbox_payloadVersion_df] DEFAULT 1,
    [payload] NVARCHAR(max) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [DomainEventOutbox_status_df] DEFAULT 'PENDING',
    [attempts] INT NOT NULL CONSTRAINT [DomainEventOutbox_attempts_df] DEFAULT 0,
    [processedAt] DATETIME2,
    [lastError] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DomainEventOutbox_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DomainEventOutbox_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DomainEventOutbox_tenantId_eventId_key] UNIQUE NONCLUSTERED ([tenantId],[eventId])
);

-- CreateTable
CREATE TABLE [dbo].[BudgetCommitment] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [period] NVARCHAR(1000) NOT NULL,
    [departmentId] NVARCHAR(36),
    [costCenter] NVARCHAR(1000),
    [category] NVARCHAR(1000) NOT NULL,
    [sourceType] NVARCHAR(1000) NOT NULL,
    [sourceId] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [BudgetCommitment_status_df] DEFAULT 'COMMITTED',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BudgetCommitment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BudgetCommitment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BudgetCommitment_tenantId_sourceType_sourceId_key] UNIQUE NONCLUSTERED ([tenantId],[sourceType],[sourceId])
);

-- CreateTable
CREATE TABLE [dbo].[ApprovalRule] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [processType] NVARCHAR(64) NOT NULL,
    [trigger] NVARCHAR(64) NOT NULL,
    [conditions] NVARCHAR(max) NOT NULL CONSTRAINT [ApprovalRule_conditions_df] DEFAULT '[]',
    [siteId] NVARCHAR(36),
    [departmentId] NVARCHAR(36),
    [domainId] NVARCHAR(36),
    [priorityScope] NVARCHAR(max) NOT NULL CONSTRAINT [ApprovalRule_priorityScope_df] DEFAULT '[]',
    [workTypeScope] NVARCHAR(max) NOT NULL CONSTRAINT [ApprovalRule_workTypeScope_df] DEFAULT '[]',
    [amountThreshold] DECIMAL(18,2),
    [amountField] NVARCHAR(1000),
    [slaHours] INT,
    [escalateToBackup] BIT NOT NULL CONSTRAINT [ApprovalRule_escalateToBackup_df] DEFAULT 1,
    [emergencyOverrideAllowed] BIT NOT NULL CONSTRAINT [ApprovalRule_emergencyOverrideAllowed_df] DEFAULT 0,
    [effectiveFrom] DATETIME2 NOT NULL CONSTRAINT [ApprovalRule_effectiveFrom_df] DEFAULT CURRENT_TIMESTAMP,
    [effectiveTo] DATETIME2,
    [version] INT NOT NULL CONSTRAINT [ApprovalRule_version_df] DEFAULT 1,
    [ruleFamilyKey] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [ApprovalRule_isActive_df] DEFAULT 1,
    [createdById] NVARCHAR(36) NOT NULL,
    [updatedById] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ApprovalRule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ApprovalRule_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ApprovalRuleLevel] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [ruleId] NVARCHAR(36) NOT NULL,
    [level] INT NOT NULL,
    [approverRole] NVARCHAR(64),
    [approverUserId] NVARCHAR(36),
    [backupUserId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ApprovalRuleLevel_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ApprovalRuleLevel_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ApprovalRuleLevel_ruleId_level_key] UNIQUE NONCLUSTERED ([ruleId],[level])
);

-- CreateTable
CREATE TABLE [dbo].[ApprovalRequest] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [processType] NVARCHAR(64) NOT NULL,
    [subjectEntityType] NVARCHAR(1000) NOT NULL,
    [subjectEntityId] NVARCHAR(1000) NOT NULL,
    [triggeredRuleId] NVARCHAR(36) NOT NULL,
    [triggeredRuleVersion] INT NOT NULL,
    [ruleSnapshot] NVARCHAR(max) NOT NULL,
    [sourceContext] NVARCHAR(max),
    [requesterId] NVARCHAR(36) NOT NULL,
    [requestedAt] DATETIME2 NOT NULL CONSTRAINT [ApprovalRequest_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [ApprovalRequest_status_df] DEFAULT '',
    [completedAt] DATETIME2,
    [cancellationReason] NVARCHAR(1000),
    [emergencyOverrideAt] DATETIME2,
    [emergencyOverrideById] NVARCHAR(36),
    [emergencyOverrideReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ApprovalRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ApprovalRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ApprovalStep] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [approvalRequestId] NVARCHAR(36) NOT NULL,
    [level] INT NOT NULL,
    [approverRole] NVARCHAR(64),
    [assignedApproverId] NVARCHAR(36),
    [backupApproverId] NVARCHAR(36),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [ApprovalStep_status_df] DEFAULT '',
    [dueAt] DATETIME2,
    [actedAt] DATETIME2,
    [escalatedAt] DATETIME2,
    [escalationState] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ApprovalStep_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ApprovalStep_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ApprovalStep_approvalRequestId_level_key] UNIQUE NONCLUSTERED ([approvalRequestId],[level])
);

-- CreateTable
CREATE TABLE [dbo].[ApprovalDecision] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [approvalRequestId] NVARCHAR(36) NOT NULL,
    [approvalStepId] NVARCHAR(36) NOT NULL,
    [actorId] NVARCHAR(36) NOT NULL,
    [decision] NVARCHAR(64) NOT NULL,
    [reason] NVARCHAR(1000),
    [decidedAt] DATETIME2 NOT NULL CONSTRAINT [ApprovalDecision_decidedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ApprovalDecision_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ApprovalDecision_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PmPlan] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [PmPlan_status_df] DEFAULT '',
    [assetId] NVARCHAR(36),
    [vehicleId] NVARCHAR(36),
    [location] NVARCHAR(1000),
    [teamId] NVARCHAR(36),
    [estimatedDurationMinutes] INT,
    [checklistTemplateId] NVARCHAR(36),
    [gracePeriodDays] INT NOT NULL CONSTRAINT [PmPlan_gracePeriodDays_df] DEFAULT 0,
    [siteId] NVARCHAR(36),
    [functionalLocationId] NVARCHAR(36),
    [domainId] NVARCHAR(36),
    [priority] NVARCHAR(64) NOT NULL CONSTRAINT [PmPlan_priority_df] DEFAULT '',
    [workType] NVARCHAR(64) NOT NULL CONSTRAINT [PmPlan_workType_df] DEFAULT '',
    [autoCreateWorkOrder] BIT NOT NULL CONSTRAINT [PmPlan_autoCreateWorkOrder_df] DEFAULT 1,
    [combineMode] NVARCHAR(64) NOT NULL CONSTRAINT [PmPlan_combineMode_df] DEFAULT '',
    [currentRevision] INT NOT NULL CONSTRAINT [PmPlan_currentRevision_df] DEFAULT 1,
    [effectiveFrom] DATETIME2,
    [effectiveTo] DATETIME2,
    [lastCompletionAt] DATETIME2,
    [lastCompletionMileage] FLOAT(53),
    [lastCompletionHours] FLOAT(53),
    [nextDueAt] DATETIME2,
    [nextDueMeterValue] FLOAT(53),
    [nextDueMeterId] NVARCHAR(36),
    [legacyScheduleId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PmPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PmPlan_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PmPlan_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[PmPlanRevision] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [planId] NVARCHAR(36) NOT NULL,
    [revision] INT NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [snapshot] NVARCHAR(max) NOT NULL,
    [changeReason] NVARCHAR(1000),
    [createdById] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PmPlanRevision_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PmPlanRevision_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PmPlanRevision_planId_revision_key] UNIQUE NONCLUSTERED ([planId],[revision])
);

-- CreateTable
CREATE TABLE [dbo].[PmTrigger] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [planId] NVARCHAR(36) NOT NULL,
    [kind] NVARCHAR(64) NOT NULL,
    [combineGroup] INT NOT NULL CONSTRAINT [PmTrigger_combineGroup_df] DEFAULT 0,
    [intervalDays] INT,
    [intervalValue] FLOAT(53),
    [meterType] NVARCHAR(64),
    [meterId] NVARCHAR(36),
    [unit] NVARCHAR(1000),
    [referenceKey] NVARCHAR(1000),
    [metadata] NVARCHAR(max),
    [isActive] BIT NOT NULL CONSTRAINT [PmTrigger_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PmTrigger_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PmTrigger_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PmAutoGeneration] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [planId] NVARCHAR(36) NOT NULL,
    [generationKey] NVARCHAR(1000) NOT NULL,
    [workOrderId] NVARCHAR(36),
    [triggerSummary] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PmAutoGeneration_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PmAutoGeneration_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PmAutoGeneration_tenantId_planId_generationKey_key] UNIQUE NONCLUSTERED ([tenantId],[planId],[generationKey])
);

-- CreateTable
CREATE TABLE [dbo].[AssetMeter] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [assetId] NVARCHAR(36),
    [vehicleId] NVARCHAR(36),
    [meterType] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [unit] NVARCHAR(1000) NOT NULL,
    [currentValue] FLOAT(53) NOT NULL CONSTRAINT [AssetMeter_currentValue_df] DEFAULT 0,
    [lastReadingAt] DATETIME2,
    [staleAfterDays] INT NOT NULL CONSTRAINT [AssetMeter_staleAfterDays_df] DEFAULT 30,
    [jumpWarningThreshold] FLOAT(53),
    [isActive] BIT NOT NULL CONSTRAINT [AssetMeter_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetMeter_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AssetMeter_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AssetMeterReading] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [meterId] NVARCHAR(36) NOT NULL,
    [value] FLOAT(53) NOT NULL,
    [previousValue] FLOAT(53),
    [source] NVARCHAR(64) NOT NULL CONSTRAINT [AssetMeterReading_source_df] DEFAULT '',
    [recordedById] NVARCHAR(36),
    [deviceId] NVARCHAR(1000),
    [recordedAt] DATETIME2 NOT NULL CONSTRAINT [AssetMeterReading_recordedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [isStale] BIT NOT NULL CONSTRAINT [AssetMeterReading_isStale_df] DEFAULT 0,
    [suspiciousJump] BIT NOT NULL CONSTRAINT [AssetMeterReading_suspiciousJump_df] DEFAULT 0,
    [rejected] BIT NOT NULL CONSTRAINT [AssetMeterReading_rejected_df] DEFAULT 0,
    [rejectReason] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetMeterReading_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AssetMeterReading_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ChecklistTemplate] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [version] INT NOT NULL CONSTRAINT [ChecklistTemplate_version_df] DEFAULT 1,
    [effectiveFrom] DATETIME2 NOT NULL CONSTRAINT [ChecklistTemplate_effectiveFrom_df] DEFAULT CURRENT_TIMESTAMP,
    [effectiveTo] DATETIME2,
    [domainKey] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [ChecklistTemplate_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ChecklistTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ChecklistTemplate_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ChecklistTemplate_tenantId_code_version_key] UNIQUE NONCLUSTERED ([tenantId],[code],[version])
);

-- CreateTable
CREATE TABLE [dbo].[ChecklistTemplateItem] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [templateId] NVARCHAR(36) NOT NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [ChecklistTemplateItem_sortOrder_df] DEFAULT 0,
    [key] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(64) NOT NULL,
    [required] BIT NOT NULL CONSTRAINT [ChecklistTemplateItem_required_df] DEFAULT 0,
    [unit] NVARCHAR(1000),
    [minValue] FLOAT(53),
    [maxValue] FLOAT(53),
    [options] NVARCHAR(max) NOT NULL CONSTRAINT [ChecklistTemplateItem_options_df] DEFAULT '[]',
    [signatureJustified] BIT NOT NULL CONSTRAINT [ChecklistTemplateItem_signatureJustified_df] DEFAULT 0,
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ChecklistTemplateItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ChecklistTemplateItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ChecklistTemplateItem_templateId_key_key] UNIQUE NONCLUSTERED ([templateId],[key])
);

-- CreateTable
CREATE TABLE [dbo].[InspectionTemplate] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [version] INT NOT NULL CONSTRAINT [InspectionTemplate_version_df] DEFAULT 1,
    [effectiveFrom] DATETIME2 NOT NULL CONSTRAINT [InspectionTemplate_effectiveFrom_df] DEFAULT CURRENT_TIMESTAMP,
    [effectiveTo] DATETIME2,
    [checklistTemplateId] NVARCHAR(36),
    [domainKey] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [InspectionTemplate_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InspectionTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InspectionTemplate_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [InspectionTemplate_tenantId_code_version_key] UNIQUE NONCLUSTERED ([tenantId],[code],[version])
);

-- CreateTable
CREATE TABLE [dbo].[Inspection] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [templateId] NVARCHAR(36),
    [assetId] NVARCHAR(36),
    [vehicleId] NVARCHAR(36),
    [inspectorId] NVARCHAR(36),
    [scheduledAt] DATETIME2,
    [performedAt] DATETIME2,
    [isAdHoc] BIT NOT NULL CONSTRAINT [Inspection_isAdHoc_df] DEFAULT 0,
    [result] NVARCHAR(64),
    [findings] NVARCHAR(1000),
    [evidenceUrls] NVARCHAR(max) NOT NULL CONSTRAINT [Inspection_evidenceUrls_df] DEFAULT '[]',
    [answers] NVARCHAR(max),
    [correctiveWorkOrderId] NVARCHAR(36),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Inspection_status_df] DEFAULT 'OPEN',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Inspection_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Inspection_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CalibrationRecord] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [equipmentAssetId] NVARCHAR(36),
    [calibrationType] NVARCHAR(1000) NOT NULL,
    [lastCalibratedAt] DATETIME2,
    [nextDueAt] DATETIME2,
    [vendorId] NVARCHAR(36),
    [vendorName] NVARCHAR(1000),
    [certificateUrl] NVARCHAR(1000),
    [result] NVARCHAR(64),
    [tolerance] NVARCHAR(1000),
    [measuredValue] FLOAT(53),
    [passFail] BIT,
    [correctiveAction] NVARCHAR(1000),
    [correctiveWorkOrderId] NVARCHAR(36),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CalibrationRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CalibrationRecord_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ComplianceRequirement] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [typeKey] NVARCHAR(1000) NOT NULL,
    [subjectType] NVARCHAR(1000) NOT NULL,
    [subjectId] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [issuedAt] DATETIME2,
    [expiresAt] DATETIME2,
    [gracePeriodDays] INT NOT NULL CONSTRAINT [ComplianceRequirement_gracePeriodDays_df] DEFAULT 0,
    [reminderDays] INT NOT NULL CONSTRAINT [ComplianceRequirement_reminderDays_df] DEFAULT 30,
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [ComplianceRequirement_status_df] DEFAULT '',
    [certificateUrl] NVARCHAR(1000),
    [providerName] NVARCHAR(1000),
    [metadata] NVARCHAR(max),
    [isActive] BIT NOT NULL CONSTRAINT [ComplianceRequirement_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ComplianceRequirement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ComplianceRequirement_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ChecklistExecution] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [templateId] NVARCHAR(36) NOT NULL,
    [templateRevision] INT NOT NULL,
    [templateSnapshot] NVARCHAR(max) NOT NULL,
    [workOrderId] NVARCHAR(36),
    [inspectionId] NVARCHAR(36),
    [executedById] NVARCHAR(36),
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [ChecklistExecution_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [completedAt] DATETIME2,
    [answers] NVARCHAR(max),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ChecklistExecution_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ChecklistExecution_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[InspectionFinding] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [inspectionId] NVARCHAR(36) NOT NULL,
    [itemKey] NVARCHAR(1000),
    [severity] NVARCHAR(1000) NOT NULL CONSTRAINT [InspectionFinding_severity_df] DEFAULT 'MEDIUM',
    [description] NVARCHAR(1000) NOT NULL,
    [evidenceUrls] NVARCHAR(max) NOT NULL CONSTRAINT [InspectionFinding_evidenceUrls_df] DEFAULT '[]',
    [correctiveActionRequired] BIT NOT NULL CONSTRAINT [InspectionFinding_correctiveActionRequired_df] DEFAULT 1,
    [maintenanceRequestId] NVARCHAR(36),
    [workOrderId] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InspectionFinding_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InspectionFinding_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderCostSnapshot] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [partsCost] DECIMAL(18,2) NOT NULL CONSTRAINT [WorkOrderCostSnapshot_partsCost_df] DEFAULT 0,
    [internalLabourCost] DECIMAL(18,2) NOT NULL CONSTRAINT [WorkOrderCostSnapshot_internalLabourCost_df] DEFAULT 0,
    [externalServiceCost] DECIMAL(18,2) NOT NULL CONSTRAINT [WorkOrderCostSnapshot_externalServiceCost_df] DEFAULT 0,
    [transportCost] DECIMAL(18,2) NOT NULL CONSTRAINT [WorkOrderCostSnapshot_transportCost_df] DEFAULT 0,
    [otherCost] DECIMAL(18,2) NOT NULL CONSTRAINT [WorkOrderCostSnapshot_otherCost_df] DEFAULT 0,
    [totalCost] DECIMAL(18,2) NOT NULL CONSTRAINT [WorkOrderCostSnapshot_totalCost_df] DEFAULT 0,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [WorkOrderCostSnapshot_currency_df] DEFAULT 'LKR',
    [snappedAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderCostSnapshot_snappedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [snappedById] NVARCHAR(36),
    [notes] NVARCHAR(1000),
    [lineItems] NVARCHAR(max),
    CONSTRAINT [WorkOrderCostSnapshot_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrderCostSnapshot_workOrderId_key] UNIQUE NONCLUSTERED ([workOrderId])
);

-- CreateTable
CREATE TABLE [dbo].[VendorContact] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [supplierId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [isPrimary] BIT NOT NULL CONSTRAINT [VendorContact_isPrimary_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [VendorContact_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorContact_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorContact_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[VendorContract] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [supplierId] NVARCHAR(36) NOT NULL,
    [contractNo] NVARCHAR(1000) NOT NULL,
    [contractType] NVARCHAR(64) NOT NULL CONSTRAINT [VendorContract_contractType_df] DEFAULT '',
    [status] NVARCHAR(64) NOT NULL CONSTRAINT [VendorContract_status_df] DEFAULT '',
    [title] NVARCHAR(1000) NOT NULL,
    [coverage] NVARCHAR(1000),
    [slaSummary] NVARCHAR(1000),
    [visitCount] INT,
    [startDate] DATETIME2 NOT NULL,
    [endDate] DATETIME2 NOT NULL,
    [valueReference] FLOAT(53),
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [VendorContract_currency_df] DEFAULT 'LKR',
    [documentUrls] NVARCHAR(max) NOT NULL CONSTRAINT [VendorContract_documentUrls_df] DEFAULT '[]',
    [reminderDays] INT NOT NULL CONSTRAINT [VendorContract_reminderDays_df] DEFAULT 30,
    [complianceRequirementId] NVARCHAR(36),
    [notes] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [VendorContract_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorContract_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorContract_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorContract_tenantId_contractNo_key] UNIQUE NONCLUSTERED ([tenantId],[contractNo])
);

-- CreateTable
CREATE TABLE [dbo].[RepairWarranty] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [supplierId] NVARCHAR(36),
    [startDate] DATETIME2 NOT NULL,
    [endDate] DATETIME2 NOT NULL,
    [coverage] NVARCHAR(1000),
    [reference] NVARCHAR(1000),
    [documentUrls] NVARCHAR(max) NOT NULL CONSTRAINT [RepairWarranty_documentUrls_df] DEFAULT '[]',
    [isActive] BIT NOT NULL CONSTRAINT [RepairWarranty_isActive_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RepairWarranty_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RepairWarranty_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[RolePermission] (
    [id] NVARCHAR(36) NOT NULL,
    [roleId] NVARCHAR(36) NOT NULL,
    [permissionId] NVARCHAR(36) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RolePermission_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RolePermission_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RolePermission_roleId_permissionId_key] UNIQUE NONCLUSTERED ([roleId],[permissionId])
);

-- CreateTable
CREATE TABLE [dbo].[UserSkill] (
    [id] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [skill] NVARCHAR(128) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UserSkill_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [UserSkill_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserSkill_userId_skill_key] UNIQUE NONCLUSTERED ([userId],[skill])
);

-- CreateTable
CREATE TABLE [dbo].[JobCodeRequiredPart] (
    [id] NVARCHAR(36) NOT NULL,
    [jobCodeId] NVARCHAR(36) NOT NULL,
    [sparePartId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [JobCodeRequiredPart_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [JobCodeRequiredPart_jobCodeId_sparePartId_key] UNIQUE NONCLUSTERED ([jobCodeId],[sparePartId])
);

-- CreateTable
CREATE TABLE [dbo].[PmPlanRequiredPart] (
    [id] NVARCHAR(36) NOT NULL,
    [pmPlanId] NVARCHAR(36) NOT NULL,
    [sparePartId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [PmPlanRequiredPart_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PmPlanRequiredPart_pmPlanId_sparePartId_key] UNIQUE NONCLUSTERED ([pmPlanId],[sparePartId])
);

-- CreateTable
CREATE TABLE [dbo].[TraceabilitySprayLink] (
    [id] NVARCHAR(36) NOT NULL,
    [traceabilityRecordId] NVARCHAR(36) NOT NULL,
    [sprayLogId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [TraceabilitySprayLink_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TraceabilitySprayLink_traceabilityRecordId_sprayLogId_key] UNIQUE NONCLUSTERED ([traceabilityRecordId],[sprayLogId])
);

-- CreateTable
CREATE TABLE [dbo].[VendorContractAsset] (
    [id] NVARCHAR(36) NOT NULL,
    [vendorContractId] NVARCHAR(36) NOT NULL,
    [assetId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [VendorContractAsset_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorContractAsset_vendorContractId_assetId_key] UNIQUE NONCLUSTERED ([vendorContractId],[assetId])
);

-- CreateTable
CREATE TABLE [dbo].[VendorContractSite] (
    [id] NVARCHAR(36) NOT NULL,
    [vendorContractId] NVARCHAR(36) NOT NULL,
    [siteId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [VendorContractSite_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorContractSite_vendorContractId_siteId_key] UNIQUE NONCLUSTERED ([vendorContractId],[siteId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_entity_entityId_idx] ON [dbo].[AuditLog]([entity], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_tenantId_idx] ON [dbo].[AuditLog]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_tenantId_createdAt_idx] ON [dbo].[AuditLog]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_tenantId_module_createdAt_idx] ON [dbo].[AuditLog]([tenantId], [module], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_actorId_createdAt_idx] ON [dbo].[AuditLog]([actorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SecurityEvent_tenantId_createdAt_idx] ON [dbo].[SecurityEvent]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SecurityEvent_tenantId_eventType_createdAt_idx] ON [dbo].[SecurityEvent]([tenantId], [eventType], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SecurityEvent_eventType_createdAt_idx] ON [dbo].[SecurityEvent]([eventType], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SecurityEvent_requestId_idx] ON [dbo].[SecurityEvent]([requestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OperationalAlert_fingerprint_status_idx] ON [dbo].[OperationalAlert]([fingerprint], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OperationalAlert_key_status_idx] ON [dbo].[OperationalAlert]([key], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OperationalAlert_tenantId_status_lastObservedAt_idx] ON [dbo].[OperationalAlert]([tenantId], [status], [lastObservedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OperationalAlert_status_lastObservedAt_idx] ON [dbo].[OperationalAlert]([status], [lastObservedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AppSetting_key_idx] ON [dbo].[AppSetting]([key]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AppSetting_scope_scopeId_idx] ON [dbo].[AppSetting]([scope], [scopeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ReplicationOutbox_status_nextRetryAt_idx] ON [dbo].[ReplicationOutbox]([status], [nextRetryAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ReplicationOutbox_entityType_entityId_idx] ON [dbo].[ReplicationOutbox]([entityType], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ReplicationOutbox_tenantId_status_idx] ON [dbo].[ReplicationOutbox]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ReplicationOutbox_createdAt_idx] ON [dbo].[ReplicationOutbox]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ReplicationOutbox_correlationId_idx] ON [dbo].[ReplicationOutbox]([correlationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_tenantId_idx] ON [dbo].[User]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_roleId_idx] ON [dbo].[User]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_departmentId_idx] ON [dbo].[User]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_designation_idx] ON [dbo].[User]([designation]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_userId_createdAt_idx] ON [dbo].[RefreshToken]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_tenantId_createdAt_idx] ON [dbo].[RefreshToken]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_familyId_createdAt_idx] ON [dbo].[RefreshToken]([familyId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_expiresAt_idx] ON [dbo].[RefreshToken]([expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_revokedAt_idx] ON [dbo].[RefreshToken]([revokedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PasswordResetToken_userId_createdAt_idx] ON [dbo].[PasswordResetToken]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PasswordResetToken_expiresAt_idx] ON [dbo].[PasswordResetToken]([expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PasswordResetToken_usedAt_idx] ON [dbo].[PasswordResetToken]([usedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Role_tenantId_name_idx] ON [dbo].[Role]([tenantId], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Role_tenantId_idx] ON [dbo].[Role]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TenantMembership_userId_idx] ON [dbo].[TenantMembership]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TenantMembership_tenantId_membershipRole_idx] ON [dbo].[TenantMembership]([tenantId], [membershipRole]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TenantInvitation_tenantId_email_idx] ON [dbo].[TenantInvitation]([tenantId], [email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TenantInvitation_invitedById_idx] ON [dbo].[TenantInvitation]([invitedById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TenantInvitation_status_expiresAt_idx] ON [dbo].[TenantInvitation]([status], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserInvitation_userId_idx] ON [dbo].[UserInvitation]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserInvitation_tenantId_status_idx] ON [dbo].[UserInvitation]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserInvitation_status_expiresAt_idx] ON [dbo].[UserInvitation]([status], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Subscription_tenantId_isCurrent_idx] ON [dbo].[Subscription]([tenantId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Subscription_status_idx] ON [dbo].[Subscription]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Subscription_planId_idx] ON [dbo].[Subscription]([planId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Entitlement_key_idx] ON [dbo].[Entitlement]([key]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UsageMetric_tenantId_periodEnd_idx] ON [dbo].[UsageMetric]([tenantId], [periodEnd]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UsageEvent_tenantId_key_occurredAt_idx] ON [dbo].[UsageEvent]([tenantId], [key], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StripeInvoice_tenantId_createdAt_idx] ON [dbo].[StripeInvoice]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StripeInvoice_subscriptionId_idx] ON [dbo].[StripeInvoice]([subscriptionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Department_tenantId_isActive_idx] ON [dbo].[Department]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Department_tenantId_parentId_idx] ON [dbo].[Department]([tenantId], [parentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Department_managerId_idx] ON [dbo].[Department]([managerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_idx] ON [dbo].[Asset]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_status_idx] ON [dbo].[Asset]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_category_idx] ON [dbo].[Asset]([category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_condition_idx] ON [dbo].[Asset]([condition]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_archivedAt_idx] ON [dbo].[Asset]([archivedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_nextServiceDate_idx] ON [dbo].[Asset]([nextServiceDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_departmentId_idx] ON [dbo].[Asset]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_siteId_idx] ON [dbo].[Asset]([tenantId], [siteId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_functionalLocationId_idx] ON [dbo].[Asset]([tenantId], [functionalLocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_domainId_idx] ON [dbo].[Asset]([tenantId], [domainId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_categoryMasterId_idx] ON [dbo].[Asset]([tenantId], [categoryMasterId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_typeMasterId_idx] ON [dbo].[Asset]([tenantId], [typeMasterId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_parentAssetId_idx] ON [dbo].[Asset]([tenantId], [parentAssetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_criticalityLevel_idx] ON [dbo].[Asset]([tenantId], [criticalityLevel]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_serialNumber_idx] ON [dbo].[Asset]([tenantId], [serialNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_tenantId_isActive_idx] ON [dbo].[Asset]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetDomain_tenantId_isActive_idx] ON [dbo].[AssetDomain]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetCategoryMaster_tenantId_domainId_idx] ON [dbo].[AssetCategoryMaster]([tenantId], [domainId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetCategoryMaster_tenantId_isActive_idx] ON [dbo].[AssetCategoryMaster]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetTypeMaster_tenantId_categoryId_idx] ON [dbo].[AssetTypeMaster]([tenantId], [categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetTypeMaster_tenantId_isActive_idx] ON [dbo].[AssetTypeMaster]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetAttributeDefinition_tenantId_typeMasterId_isActive_idx] ON [dbo].[AssetAttributeDefinition]([tenantId], [typeMasterId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetLocationHistory_tenantId_assetId_effectiveAt_idx] ON [dbo].[AssetLocationHistory]([tenantId], [assetId], [effectiveAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetLocationHistory_tenantId_toSiteId_idx] ON [dbo].[AssetLocationHistory]([tenantId], [toSiteId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_tenantId_idx] ON [dbo].[Vehicle]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_status_idx] ON [dbo].[Vehicle]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_driverId_idx] ON [dbo].[Vehicle]([driverId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_location_idx] ON [dbo].[Vehicle]([location]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_type_idx] ON [dbo].[Vehicle]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_departmentId_idx] ON [dbo].[Vehicle]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_serviceStatus_idx] ON [dbo].[Vehicle]([serviceStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_assetTag_idx] ON [dbo].[Vehicle]([assetTag]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_costCenter_idx] ON [dbo].[Vehicle]([costCenter]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_tenantId_status_nextServiceDate_idx] ON [dbo].[Vehicle]([tenantId], [status], [nextServiceDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleTyre_tenantId_vehicleId_idx] ON [dbo].[VehicleTyre]([tenantId], [vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleTyre_tenantId_serialNumber_idx] ON [dbo].[VehicleTyre]([tenantId], [serialNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleTyre_tenantId_vehicleId_wheelPosition_isActive_idx] ON [dbo].[VehicleTyre]([tenantId], [vehicleId], [wheelPosition], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleBattery_tenantId_vehicleId_idx] ON [dbo].[VehicleBattery]([tenantId], [vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleBattery_tenantId_serialNumber_idx] ON [dbo].[VehicleBattery]([tenantId], [serialNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleBattery_tenantId_isActive_idx] ON [dbo].[VehicleBattery]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleAssignment_tenantId_vehicleId_idx] ON [dbo].[VehicleAssignment]([tenantId], [vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleAssignment_tenantId_driverId_idx] ON [dbo].[VehicleAssignment]([tenantId], [driverId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleAssignment_tenantId_isCurrent_idx] ON [dbo].[VehicleAssignment]([tenantId], [isCurrent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Driver_tenantId_idx] ON [dbo].[Driver]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Driver_departmentId_idx] ON [dbo].[Driver]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FuelLog_vehicleId_date_idx] ON [dbo].[FuelLog]([vehicleId], [date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FuelLog_driverId_date_idx] ON [dbo].[FuelLog]([driverId], [date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FuelLog_vehicleId_clientActionId_idx] ON [dbo].[FuelLog]([vehicleId], [clientActionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TripLog_vehicleId_startTime_idx] ON [dbo].[TripLog]([vehicleId], [startTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TripLog_driverId_startTime_idx] ON [dbo].[TripLog]([driverId], [startTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleMeterLog_vehicleId_createdAt_idx] ON [dbo].[VehicleMeterLog]([vehicleId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleMeterLog_recordedById_createdAt_idx] ON [dbo].[VehicleMeterLog]([recordedById], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleGateMovement_vehicleId_occurredAt_idx] ON [dbo].[VehicleGateMovement]([vehicleId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleGateMovement_status_movementType_occurredAt_idx] ON [dbo].[VehicleGateMovement]([status], [movementType], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleGateMovement_driverId_occurredAt_idx] ON [dbo].[VehicleGateMovement]([driverId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GpsLocation_vehicleId_timestamp_idx] ON [dbo].[GpsLocation]([vehicleId], [timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceSchedule_assetId_idx] ON [dbo].[MaintenanceSchedule]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceSchedule_vehicleId_idx] ON [dbo].[MaintenanceSchedule]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceSchedule_nextDueDate_idx] ON [dbo].[MaintenanceSchedule]([nextDueDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobCode_tenantId_isActive_idx] ON [dbo].[JobCode]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobCode_tenantId_parentId_idx] ON [dbo].[JobCode]([tenantId], [parentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobCode_category_idx] ON [dbo].[JobCode]([category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceLog_scheduleId_idx] ON [dbo].[MaintenanceLog]([scheduleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceLog_assetId_idx] ON [dbo].[MaintenanceLog]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceLog_vehicleId_idx] ON [dbo].[MaintenanceLog]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceLog_performedAt_idx] ON [dbo].[MaintenanceLog]([performedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_idx] ON [dbo].[WorkOrder]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_status_idx] ON [dbo].[WorkOrder]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_createdAt_idx] ON [dbo].[WorkOrder]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_updatedAt_idx] ON [dbo].[WorkOrder]([tenantId], [updatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_isTriage_idx] ON [dbo].[WorkOrder]([tenantId], [isTriage]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_dueDate_idx] ON [dbo].[WorkOrder]([tenantId], [dueDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_siteId_idx] ON [dbo].[WorkOrder]([tenantId], [siteId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_functionalLocationId_idx] ON [dbo].[WorkOrder]([tenantId], [functionalLocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_assetId_status_idx] ON [dbo].[WorkOrder]([tenantId], [assetId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_completedDate_idx] ON [dbo].[WorkOrder]([tenantId], [completedDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_closedAt_idx] ON [dbo].[WorkOrder]([tenantId], [closedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_pmPlanId_idx] ON [dbo].[WorkOrder]([tenantId], [pmPlanId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_pmOccurrenceKey_idx] ON [dbo].[WorkOrder]([tenantId], [pmOccurrenceKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_vendorSupplierId_idx] ON [dbo].[WorkOrder]([tenantId], [vendorSupplierId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_executionMode_idx] ON [dbo].[WorkOrder]([tenantId], [executionMode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_status_idx] ON [dbo].[WorkOrder]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_priority_idx] ON [dbo].[WorkOrder]([priority]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_technicianId_idx] ON [dbo].[WorkOrder]([technicianId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_createdAt_idx] ON [dbo].[WorkOrder]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_updatedAt_idx] ON [dbo].[WorkOrder]([updatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_dueDate_idx] ON [dbo].[WorkOrder]([dueDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_expectedCompletionDate_idx] ON [dbo].[WorkOrder]([expectedCompletionDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_plannedEndAt_idx] ON [dbo].[WorkOrder]([plannedEndAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_accidentId_idx] ON [dbo].[WorkOrder]([accidentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_trafficFineId_idx] ON [dbo].[WorkOrder]([trafficFineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_taxonomyCategoryId_idx] ON [dbo].[WorkOrder]([taxonomyCategoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_taxonomyTypeId_idx] ON [dbo].[WorkOrder]([taxonomyTypeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_taxonomyIssueId_idx] ON [dbo].[WorkOrder]([taxonomyIssueId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_isTriage_idx] ON [dbo].[WorkOrder]([isTriage]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_lastIdempotencyKey_idx] ON [dbo].[WorkOrder]([tenantId], [lastIdempotencyKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderTaxonomy_tenantId_level_active_idx] ON [dbo].[WorkOrderTaxonomy]([tenantId], [level], [active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderTaxonomy_parentId_idx] ON [dbo].[WorkOrderTaxonomy]([parentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderTaxonomy_tenantId_sortOrder_idx] ON [dbo].[WorkOrderTaxonomy]([tenantId], [sortOrder]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employee_linkedUserId_idx] ON [dbo].[Employee]([linkedUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employee_tenantId_active_idx] ON [dbo].[Employee]([tenantId], [active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employee_tenantId_designation_idx] ON [dbo].[Employee]([tenantId], [designation]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employee_email_idx] ON [dbo].[Employee]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderAssignee_tenantId_idx] ON [dbo].[WorkOrderAssignee]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderAssignee_employeeId_idx] ON [dbo].[WorkOrderAssignee]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderAssignee_workOrderId_idx] ON [dbo].[WorkOrderAssignee]([workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderAssignee_assignmentStatus_idx] ON [dbo].[WorkOrderAssignee]([assignmentStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceAnalysisCode_tenantId_kind_isActive_idx] ON [dbo].[MaintenanceAnalysisCode]([tenantId], [kind], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderHoldHistory_tenantId_workOrderId_idx] ON [dbo].[WorkOrderHoldHistory]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderHoldHistory_workOrderId_heldAt_idx] ON [dbo].[WorkOrderHoldHistory]([workOrderId], [heldAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderLabourEntry_tenantId_workOrderId_idx] ON [dbo].[WorkOrderLabourEntry]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderLabourEntry_workOrderId_startedAt_idx] ON [dbo].[WorkOrderLabourEntry]([workOrderId], [startedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderStatusHistory_tenantId_workOrderId_idx] ON [dbo].[WorkOrderStatusHistory]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderStatusHistory_workOrderId_createdAt_idx] ON [dbo].[WorkOrderStatusHistory]([workOrderId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeRosterEntry_tenantId_rosterDate_idx] ON [dbo].[EmployeeRosterEntry]([tenantId], [rosterDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeRosterEntry_employeeId_rosterDate_idx] ON [dbo].[EmployeeRosterEntry]([employeeId], [rosterDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeLeaveRequest_tenantId_employeeId_idx] ON [dbo].[EmployeeLeaveRequest]([tenantId], [employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeLeaveRequest_tenantId_status_startDate_idx] ON [dbo].[EmployeeLeaveRequest]([tenantId], [status], [startDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeLeaveRequest_employeeId_startDate_endDate_idx] ON [dbo].[EmployeeLeaveRequest]([employeeId], [startDate], [endDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SparePart_tenantId_idx] ON [dbo].[SparePart]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SparePart_supplierId_idx] ON [dbo].[SparePart]([supplierId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SparePart_tenantId_isActive_idx] ON [dbo].[SparePart]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SparePart_tenantId_classification_idx] ON [dbo].[SparePart]([tenantId], [classification]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SparePart_tenantId_erpCode_idx] ON [dbo].[SparePart]([tenantId], [erpCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SparePart_tenantId_criticalSpare_idx] ON [dbo].[SparePart]([tenantId], [criticalSpare]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Warehouse_tenantId_isDefault_idx] ON [dbo].[Warehouse]([tenantId], [isDefault]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Warehouse_tenantId_isActive_idx] ON [dbo].[Warehouse]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Warehouse_tenantId_erpWarehouseCode_idx] ON [dbo].[Warehouse]([tenantId], [erpWarehouseCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WarehouseItemBalance_tenantId_partId_idx] ON [dbo].[WarehouseItemBalance]([tenantId], [partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WarehouseItemBalance_tenantId_warehouseId_idx] ON [dbo].[WarehouseItemBalance]([tenantId], [warehouseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_partId_createdAt_idx] ON [dbo].[StockMovement]([partId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_tenantId_workOrderId_idx] ON [dbo].[StockMovement]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_tenantId_warehouseId_partId_idx] ON [dbo].[StockMovement]([tenantId], [warehouseId], [partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_tenantId_createdAt_idx] ON [dbo].[StockMovement]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_tenantId_type_createdAt_idx] ON [dbo].[StockMovement]([tenantId], [type], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_tenantId_sourceLineKey_idx] ON [dbo].[StockMovement]([tenantId], [sourceLineKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_tenantId_importRunId_idx] ON [dbo].[StockMovement]([tenantId], [importRunId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_tenantId_transferGroupId_idx] ON [dbo].[StockMovement]([tenantId], [transferGroupId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_reversalOfMovementId_idx] ON [dbo].[StockMovement]([reversalOfMovementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryStockIssueIdempotency_tenantId_partId_idx] ON [dbo].[InventoryStockIssueIdempotency]([tenantId], [partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryIdempotency_tenantId_partId_idx] ON [dbo].[InventoryIdempotency]([tenantId], [partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryIdempotency_tenantId_operation_createdAt_idx] ON [dbo].[InventoryIdempotency]([tenantId], [operation], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryImportRun_tenantId_uploadedAt_idx] ON [dbo].[InventoryImportRun]([tenantId], [uploadedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryImportRun_tenantId_status_uploadedAt_idx] ON [dbo].[InventoryImportRun]([tenantId], [status], [uploadedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryImportRow_importRunId_status_idx] ON [dbo].[InventoryImportRow]([importRunId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryImportRow_tenantId_importRunId_idx] ON [dbo].[InventoryImportRow]([tenantId], [importRunId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryImportRow_tenantId_erpItemCode_idx] ON [dbo].[InventoryImportRow]([tenantId], [erpItemCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BulkImportRun_tenantId_entityType_createdAt_idx] ON [dbo].[BulkImportRun]([tenantId], [entityType], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BulkImportRun_tenantId_status_createdAt_idx] ON [dbo].[BulkImportRun]([tenantId], [status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BulkImportRun_expiresAt_idx] ON [dbo].[BulkImportRun]([expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BulkImportRow_runId_rowNumber_idx] ON [dbo].[BulkImportRow]([runId], [rowNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BulkImportRow_tenantId_runId_idx] ON [dbo].[BulkImportRow]([tenantId], [runId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BulkImportRow_runId_naturalKey_idx] ON [dbo].[BulkImportRow]([runId], [naturalKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderPart_workOrderId_idx] ON [dbo].[WorkOrderPart]([workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderPart_partId_idx] ON [dbo].[WorkOrderPart]([partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderPart_partRequestId_idx] ON [dbo].[WorkOrderPart]([partRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderPart_tenantId_workOrderId_idx] ON [dbo].[WorkOrderPart]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Supplier_tenantId_idx] ON [dbo].[Supplier]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Supplier_tenantId_blacklisted_idx] ON [dbo].[Supplier]([tenantId], [blacklisted]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorRepairCase_tenantId_idx] ON [dbo].[VendorRepairCase]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorRepairCase_tenantId_status_idx] ON [dbo].[VendorRepairCase]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorRepairCase_supplierId_idx] ON [dbo].[VendorRepairCase]([supplierId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorQuotation_tenantId_workOrderId_idx] ON [dbo].[VendorQuotation]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorQuotation_vendorRepairCaseId_idx] ON [dbo].[VendorQuotation]([vendorRepairCaseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorQuotation_supplierId_quotationNo_idx] ON [dbo].[VendorQuotation]([supplierId], [quotationNo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorInvoice_tenantId_workOrderId_idx] ON [dbo].[VendorInvoice]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorInvoice_vendorRepairCaseId_idx] ON [dbo].[VendorInvoice]([vendorRepairCaseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrder_tenantId_idx] ON [dbo].[PurchaseOrder]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrder_tenantId_workflowStatus_idx] ON [dbo].[PurchaseOrder]([tenantId], [workflowStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrder_supplierId_idx] ON [dbo].[PurchaseOrder]([supplierId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrder_createdById_idx] ON [dbo].[PurchaseOrder]([createdById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderLine_tenantId_idx] ON [dbo].[PurchaseOrderLine]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderLine_purchaseOrderId_idx] ON [dbo].[PurchaseOrderLine]([purchaseOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderLine_partId_idx] ON [dbo].[PurchaseOrderLine]([partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderLine_partRequestId_idx] ON [dbo].[PurchaseOrderLine]([partRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderApproval_tenantId_idx] ON [dbo].[PurchaseOrderApproval]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderApproval_tenantId_stage_status_idx] ON [dbo].[PurchaseOrderApproval]([tenantId], [stage], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderErpSync_tenantId_idx] ON [dbo].[PurchaseOrderErpSync]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderErpSync_tenantId_status_idx] ON [dbo].[PurchaseOrderErpSync]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderErpSync_tenantId_idempotencyKey_idx] ON [dbo].[PurchaseOrderErpSync]([tenantId], [idempotencyKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderErpSync_purchaseOrderId_createdAt_idx] ON [dbo].[PurchaseOrderErpSync]([purchaseOrderId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartRequest_tenantId_idx] ON [dbo].[PartRequest]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartRequest_tenantId_status_idx] ON [dbo].[PartRequest]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartRequest_workOrderId_idx] ON [dbo].[PartRequest]([workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartRequest_partId_idx] ON [dbo].[PartRequest]([partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartRequestApproval_tenantId_idx] ON [dbo].[PartRequestApproval]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartRequestApproval_tenantId_stage_status_idx] ON [dbo].[PartRequestApproval]([tenantId], [stage], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartIssue_tenantId_idx] ON [dbo].[PartIssue]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartIssue_partRequestId_idx] ON [dbo].[PartIssue]([partRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartIssue_workOrderId_idx] ON [dbo].[PartIssue]([workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartIssue_partId_idx] ON [dbo].[PartIssue]([partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartIssue_tenantId_expectsReturn_returnedAt_idx] ON [dbo].[PartIssue]([tenantId], [expectsReturn], [returnedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseReceipt_tenantId_idx] ON [dbo].[PurchaseReceipt]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseReceipt_purchaseOrderId_idx] ON [dbo].[PurchaseReceipt]([purchaseOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseReceipt_receivedById_idx] ON [dbo].[PurchaseReceipt]([receivedById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseReceiptLine_tenantId_idx] ON [dbo].[PurchaseReceiptLine]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseReceiptLine_purchaseOrderLineId_idx] ON [dbo].[PurchaseReceiptLine]([purchaseOrderLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseReceiptIdempotency_tenantId_purchaseOrderId_idx] ON [dbo].[PurchaseReceiptIdempotency]([tenantId], [purchaseOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UtilityMeter_tenantId_idx] ON [dbo].[UtilityMeter]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MeterReading_meterId_readingDate_idx] ON [dbo].[MeterReading]([meterId], [readingDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UtilityBill_tenantId_idx] ON [dbo].[UtilityBill]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UtilityBill_meterId_idx] ON [dbo].[UtilityBill]([meterId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UtilityBill_status_idx] ON [dbo].[UtilityBill]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UtilityBill_dueDate_idx] ON [dbo].[UtilityBill]([dueDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_userId_createdAt_idx] ON [dbo].[Notification]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_type_idx] ON [dbo].[Notification]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_dedupeKey_idx] ON [dbo].[Notification]([dedupeKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PredictiveLog_assetId_analyzedAt_idx] ON [dbo].[PredictiveLog]([assetId], [analyzedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CopilotConversation_userId_lastMessageAt_idx] ON [dbo].[CopilotConversation]([userId], [lastMessageAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CopilotMessage_conversationId_createdAt_idx] ON [dbo].[CopilotMessage]([conversationId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CopilotMessage_userId_createdAt_idx] ON [dbo].[CopilotMessage]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CopilotExchangeLog_userId_createdAt_idx] ON [dbo].[CopilotExchangeLog]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CopilotExchangeLog_focusArea_createdAt_idx] ON [dbo].[CopilotExchangeLog]([focusArea], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CopilotExchangeLog_createdAt_idx] ON [dbo].[CopilotExchangeLog]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Property_tenantId_idx] ON [dbo].[Property]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Property_tenantId_isActive_idx] ON [dbo].[Property]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Property_tenantId_name_idx] ON [dbo].[Property]([tenantId], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Building_tenantId_idx] ON [dbo].[Building]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Building_tenantId_propertyId_idx] ON [dbo].[Building]([tenantId], [propertyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Building_tenantId_isActive_idx] ON [dbo].[Building]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Building_tenantId_name_idx] ON [dbo].[Building]([tenantId], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Floor_tenantId_idx] ON [dbo].[Floor]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Floor_tenantId_buildingId_idx] ON [dbo].[Floor]([tenantId], [buildingId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Floor_tenantId_isActive_idx] ON [dbo].[Floor]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Floor_tenantId_name_idx] ON [dbo].[Floor]([tenantId], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Room_tenantId_idx] ON [dbo].[Room]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Room_tenantId_floorId_idx] ON [dbo].[Room]([tenantId], [floorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Room_tenantId_isActive_idx] ON [dbo].[Room]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Room_tenantId_name_idx] ON [dbo].[Room]([tenantId], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Site_tenantId_isActive_idx] ON [dbo].[Site]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Site_tenantId_type_idx] ON [dbo].[Site]([tenantId], [type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Site_tenantId_legacyPropertyId_idx] ON [dbo].[Site]([tenantId], [legacyPropertyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FunctionalLocation_tenantId_siteId_idx] ON [dbo].[FunctionalLocation]([tenantId], [siteId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FunctionalLocation_tenantId_parentId_idx] ON [dbo].[FunctionalLocation]([tenantId], [parentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FunctionalLocation_tenantId_isActive_idx] ON [dbo].[FunctionalLocation]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FunctionalLocation_tenantId_type_idx] ON [dbo].[FunctionalLocation]([tenantId], [type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FunctionalLocation_departmentId_idx] ON [dbo].[FunctionalLocation]([departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FunctionalLocation_tenantId_legacyBuildingId_idx] ON [dbo].[FunctionalLocation]([tenantId], [legacyBuildingId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FunctionalLocation_tenantId_legacyFloorId_idx] ON [dbo].[FunctionalLocation]([tenantId], [legacyFloorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FunctionalLocation_tenantId_legacyRoomId_idx] ON [dbo].[FunctionalLocation]([tenantId], [legacyRoomId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CleaningLocation_tenantId_idx] ON [dbo].[CleaningLocation]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CleaningLocation_isActive_idx] ON [dbo].[CleaningLocation]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CleaningLocation_assignedCleanerId_idx] ON [dbo].[CleaningLocation]([assignedCleanerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CleaningChecklistTemplate_locationId_idx] ON [dbo].[CleaningChecklistTemplate]([locationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CleaningVisit_tenantId_idx] ON [dbo].[CleaningVisit]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CleaningVisit_locationId_scannedAt_idx] ON [dbo].[CleaningVisit]([locationId], [scannedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CleaningVisit_cleanerId_scannedAt_idx] ON [dbo].[CleaningVisit]([cleanerId], [scannedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CleaningVisit_status_idx] ON [dbo].[CleaningVisit]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CleaningVisit_scheduleStatus_idx] ON [dbo].[CleaningVisit]([scheduleStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RequestProblemCategory_tenantId_isActive_idx] ON [dbo].[RequestProblemCategory]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_idempotencyKey_idx] ON [dbo].[MaintenanceRequest]([tenantId], [idempotencyKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_status_createdAt_idx] ON [dbo].[MaintenanceRequest]([tenantId], [status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_siteId_status_idx] ON [dbo].[MaintenanceRequest]([tenantId], [siteId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_assetId_status_idx] ON [dbo].[MaintenanceRequest]([tenantId], [assetId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_functionalLocationId_status_idx] ON [dbo].[MaintenanceRequest]([tenantId], [functionalLocationId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_priority_status_idx] ON [dbo].[MaintenanceRequest]([tenantId], [priority], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_reportedById_createdAt_idx] ON [dbo].[MaintenanceRequest]([tenantId], [reportedById], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_domainId_idx] ON [dbo].[MaintenanceRequest]([tenantId], [domainId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_duplicateOfId_idx] ON [dbo].[MaintenanceRequest]([tenantId], [duplicateOfId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_legacySourceType_legacySourceId_idx] ON [dbo].[MaintenanceRequest]([tenantId], [legacySourceType], [legacySourceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceRequestHistory_tenantId_requestId_createdAt_idx] ON [dbo].[MaintenanceRequestHistory]([tenantId], [requestId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_tenantId_idx] ON [dbo].[FacilityIssue]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_tenantId_workOrderId_idx] ON [dbo].[FacilityIssue]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_tenantId_roomId_idx] ON [dbo].[FacilityIssue]([tenantId], [roomId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_tenantId_category_idx] ON [dbo].[FacilityIssue]([tenantId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_tenantId_status_idx] ON [dbo].[FacilityIssue]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_locationId_idx] ON [dbo].[FacilityIssue]([locationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_roomId_idx] ON [dbo].[FacilityIssue]([roomId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_reportedById_idx] ON [dbo].[FacilityIssue]([reportedById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_assignedToId_idx] ON [dbo].[FacilityIssue]([assignedToId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_status_idx] ON [dbo].[FacilityIssue]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_severity_idx] ON [dbo].[FacilityIssue]([severity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FacilityIssue_slaTargetAt_idx] ON [dbo].[FacilityIssue]([slaTargetAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EvidenceAttachment_tenantId_workOrderId_idx] ON [dbo].[EvidenceAttachment]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EvidenceAttachment_tenantId_facilityIssueId_idx] ON [dbo].[EvidenceAttachment]([tenantId], [facilityIssueId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EvidenceAttachment_tenantId_maintenanceRequestId_idx] ON [dbo].[EvidenceAttachment]([tenantId], [maintenanceRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EvidenceAttachment_tenantId_status_idx] ON [dbo].[EvidenceAttachment]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EvidenceAttachment_tenantId_clientGeneratedId_idx] ON [dbo].[EvidenceAttachment]([tenantId], [clientGeneratedId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Field_tenantId_idx] ON [dbo].[Field]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Field_status_idx] ON [dbo].[Field]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CropCycle_tenantId_idx] ON [dbo].[CropCycle]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CropCycle_fieldId_idx] ON [dbo].[CropCycle]([fieldId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CropCycle_status_idx] ON [dbo].[CropCycle]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [HarvestRecord_tenantId_idx] ON [dbo].[HarvestRecord]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [HarvestRecord_cropCycleId_idx] ON [dbo].[HarvestRecord]([cropCycleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [HarvestRecord_harvestDate_idx] ON [dbo].[HarvestRecord]([harvestDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LivestockAnimal_tenantId_idx] ON [dbo].[LivestockAnimal]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LivestockAnimal_tagNumber_idx] ON [dbo].[LivestockAnimal]([tagNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LivestockAnimal_status_idx] ON [dbo].[LivestockAnimal]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AnimalHealthRecord_tenantId_animalId_idx] ON [dbo].[AnimalHealthRecord]([tenantId], [animalId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AnimalHealthRecord_nextDueDate_idx] ON [dbo].[AnimalHealthRecord]([nextDueDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AnimalProductionLog_tenantId_animalId_idx] ON [dbo].[AnimalProductionLog]([tenantId], [animalId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AnimalProductionLog_date_idx] ON [dbo].[AnimalProductionLog]([date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FeedingLog_tenantId_idx] ON [dbo].[FeedingLog]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FeedingLog_date_idx] ON [dbo].[FeedingLog]([date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IrrigationLog_tenantId_fieldId_idx] ON [dbo].[IrrigationLog]([tenantId], [fieldId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IrrigationLog_startTime_idx] ON [dbo].[IrrigationLog]([startTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SprayLog_tenantId_fieldId_idx] ON [dbo].[SprayLog]([tenantId], [fieldId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SprayLog_date_idx] ON [dbo].[SprayLog]([date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SprayLog_chemicalType_idx] ON [dbo].[SprayLog]([chemicalType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SoilTest_tenantId_fieldId_idx] ON [dbo].[SoilTest]([tenantId], [fieldId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SoilTest_testDate_idx] ON [dbo].[SoilTest]([testDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WeatherLog_tenantId_recordedAt_idx] ON [dbo].[WeatherLog]([tenantId], [recordedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FarmWorker_tenantId_idx] ON [dbo].[FarmWorker]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FarmWorker_status_idx] ON [dbo].[FarmWorker]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AttendanceLog_tenantId_workerId_idx] ON [dbo].[AttendanceLog]([tenantId], [workerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AttendanceLog_date_idx] ON [dbo].[AttendanceLog]([date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FarmExpense_tenantId_idx] ON [dbo].[FarmExpense]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FarmExpense_date_idx] ON [dbo].[FarmExpense]([date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FarmExpense_category_idx] ON [dbo].[FarmExpense]([category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FarmIncome_tenantId_idx] ON [dbo].[FarmIncome]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FarmIncome_date_idx] ON [dbo].[FarmIncome]([date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FarmIncome_source_idx] ON [dbo].[FarmIncome]([source]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TraceabilityRecord_batchCode_idx] ON [dbo].[TraceabilityRecord]([batchCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TraceabilityRecord_tenantId_idx] ON [dbo].[TraceabilityRecord]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleDocument_tenantId_idx] ON [dbo].[VehicleDocument]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleDocument_vehicleId_idx] ON [dbo].[VehicleDocument]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleDocument_expiryDate_idx] ON [dbo].[VehicleDocument]([expiryDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleDocument_documentType_idx] ON [dbo].[VehicleDocument]([documentType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleDocument_status_idx] ON [dbo].[VehicleDocument]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AccidentReport_tenantId_idx] ON [dbo].[AccidentReport]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AccidentReport_vehicleId_idx] ON [dbo].[AccidentReport]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AccidentReport_driverId_idx] ON [dbo].[AccidentReport]([driverId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AccidentReport_occurredAt_idx] ON [dbo].[AccidentReport]([occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AccidentReport_status_idx] ON [dbo].[AccidentReport]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AccidentReport_responsibility_idx] ON [dbo].[AccidentReport]([responsibility]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AccidentEvidence_accidentId_idx] ON [dbo].[AccidentEvidence]([accidentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InsuranceClaim_tenantId_idx] ON [dbo].[InsuranceClaim]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InsuranceClaim_vehicleId_idx] ON [dbo].[InsuranceClaim]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InsuranceClaim_accidentId_idx] ON [dbo].[InsuranceClaim]([accidentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InsuranceClaim_status_idx] ON [dbo].[InsuranceClaim]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrafficFine_tenantId_idx] ON [dbo].[TrafficFine]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrafficFine_vehicleId_idx] ON [dbo].[TrafficFine]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrafficFine_driverId_idx] ON [dbo].[TrafficFine]([driverId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrafficFine_fineDate_idx] ON [dbo].[TrafficFine]([fineDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrafficFine_paymentStatus_idx] ON [dbo].[TrafficFine]([paymentStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrafficFine_responsibility_idx] ON [dbo].[TrafficFine]([responsibility]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaIssue_tenantId_status_idx] ON [dbo].[QaIssue]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaIssue_tenantId_category_idx] ON [dbo].[QaIssue]([tenantId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaIssue_tenantId_severity_idx] ON [dbo].[QaIssue]([tenantId], [severity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaIssue_tenantId_environment_idx] ON [dbo].[QaIssue]([tenantId], [environment]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaIssue_reportedByUserId_idx] ON [dbo].[QaIssue]([reportedByUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaIssue_assignedToUserId_idx] ON [dbo].[QaIssue]([assignedToUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaIssue_linkedUatPhase_idx] ON [dbo].[QaIssue]([linkedUatPhase]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaIssue_createdAt_idx] ON [dbo].[QaIssue]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaIssueRca_issueId_idx] ON [dbo].[QaIssueRca]([issueId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaRegressionTest_issueId_idx] ON [dbo].[QaRegressionTest]([issueId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaRegressionTest_testDate_idx] ON [dbo].[QaRegressionTest]([testDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeliveryChecklist_tenantId_category_idx] ON [dbo].[DeliveryChecklist]([tenantId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeliveryChecklist_tenantId_status_idx] ON [dbo].[DeliveryChecklist]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeliveryChecklistItem_checklistId_idx] ON [dbo].[DeliveryChecklistItem]([checklistId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeliveryChecklistItem_tenantId_category_idx] ON [dbo].[DeliveryChecklistItem]([tenantId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeliveryChecklistItem_tenantId_status_idx] ON [dbo].[DeliveryChecklistItem]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeliveryChecklistItem_blocker_idx] ON [dbo].[DeliveryChecklistItem]([blocker]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeliverySignOff_tenantId_idx] ON [dbo].[DeliverySignOff]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeliverySignOff_signedAt_idx] ON [dbo].[DeliverySignOff]([signedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingSession_tenantId_status_idx] ON [dbo].[TrainingSession]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingSession_tenantId_category_idx] ON [dbo].[TrainingSession]([tenantId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingSession_traineeUserId_idx] ON [dbo].[TrainingSession]([traineeUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportTicket_tenantId_status_idx] ON [dbo].[SupportTicket]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportTicket_tenantId_priority_idx] ON [dbo].[SupportTicket]([tenantId], [priority]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportTicket_tenantId_severity_idx] ON [dbo].[SupportTicket]([tenantId], [severity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportTicket_reportedByUserId_idx] ON [dbo].[SupportTicket]([reportedByUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportTicket_assignedToUserId_idx] ON [dbo].[SupportTicket]([assignedToUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportTicket_firstResponseBreached_idx] ON [dbo].[SupportTicket]([firstResponseBreached]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportTicket_resolutionBreached_idx] ON [dbo].[SupportTicket]([resolutionBreached]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EscalationRule_tenantId_active_idx] ON [dbo].[EscalationRule]([tenantId], [active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EscalationRule_tenantId_escalationLevel_idx] ON [dbo].[EscalationRule]([tenantId], [escalationLevel]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ChangeRequest_tenantId_status_idx] ON [dbo].[ChangeRequest]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ChangeRequest_requestedByUserId_idx] ON [dbo].[ChangeRequest]([requestedByUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SoftwareRelease_tenantId_status_idx] ON [dbo].[SoftwareRelease]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SoftwareRelease_version_idx] ON [dbo].[SoftwareRelease]([version]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [HypercarePlan_tenantId_readinessStatus_idx] ON [dbo].[HypercarePlan]([tenantId], [readinessStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [HypercarePlan_startDate_idx] ON [dbo].[HypercarePlan]([startDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PilotRollout_tenantId_status_idx] ON [dbo].[PilotRollout]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PilotRollout_tenantId_department_idx] ON [dbo].[PilotRollout]([tenantId], [department]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CutoverChecklistItem_tenantId_category_idx] ON [dbo].[CutoverChecklistItem]([tenantId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CutoverChecklistItem_tenantId_status_idx] ON [dbo].[CutoverChecklistItem]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RolloutWave_tenantId_status_idx] ON [dbo].[RolloutWave]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GoLiveDecision_tenantId_createdAt_idx] ON [dbo].[GoLiveDecision]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GoLiveDecision_tenantId_decisionStage_idx] ON [dbo].[GoLiveDecision]([tenantId], [decisionStage]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RollbackPlan_tenantId_active_idx] ON [dbo].[RollbackPlan]([tenantId], [active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GoLiveSignOff_tenantId_signOffRole_idx] ON [dbo].[GoLiveSignOff]([tenantId], [signOffRole]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GoLiveSignOff_tenantId_decision_idx] ON [dbo].[GoLiveSignOff]([tenantId], [decision]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GoLiveSignOff_tenantId_applicationCommitSha_idx] ON [dbo].[GoLiveSignOff]([tenantId], [applicationCommitSha]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UatScenarioExecution_tenantId_scenarioId_idx] ON [dbo].[UatScenarioExecution]([tenantId], [scenarioId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UatScenarioExecution_tenantId_evidenceClass_idx] ON [dbo].[UatScenarioExecution]([tenantId], [evidenceClass]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UatScenarioExecution_tenantId_outcome_idx] ON [dbo].[UatScenarioExecution]([tenantId], [outcome]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpFieldMapping_tenantId_targetModel_idx] ON [dbo].[ErpFieldMapping]([tenantId], [targetModel]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpFieldMapping_tenantId_active_idx] ON [dbo].[ErpFieldMapping]([tenantId], [active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpImportBatch_tenantId_status_idx] ON [dbo].[ErpImportBatch]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpImportBatch_tenantId_importType_idx] ON [dbo].[ErpImportBatch]([tenantId], [importType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpImportRow_tenantId_importRunId_idx] ON [dbo].[ErpImportRow]([tenantId], [importRunId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpImportRow_tenantId_sourceLineKey_idx] ON [dbo].[ErpImportRow]([tenantId], [sourceLineKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpImportRow_tenantId_status_idx] ON [dbo].[ErpImportRow]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpImportRow_tenantId_mappedPartId_idx] ON [dbo].[ErpImportRow]([tenantId], [mappedPartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpReconciliationMismatch_tenantId_reportType_idx] ON [dbo].[ErpReconciliationMismatch]([tenantId], [reportType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpReconciliationMismatch_tenantId_status_idx] ON [dbo].[ErpReconciliationMismatch]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpReconciliationMismatch_tenantId_severity_idx] ON [dbo].[ErpReconciliationMismatch]([tenantId], [severity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpReconciliationMismatch_tenantId_partId_warehouseId_idx] ON [dbo].[ErpReconciliationMismatch]([tenantId], [partId], [warehouseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpAccessChecklistItem_tenantId_status_idx] ON [dbo].[ErpAccessChecklistItem]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ErpMockSyncRun_tenantId_createdAt_idx] ON [dbo].[ErpMockSyncRun]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BusinessException_tenantId_status_severity_idx] ON [dbo].[BusinessException]([tenantId], [status], [severity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BusinessException_tenantId_module_createdAt_idx] ON [dbo].[BusinessException]([tenantId], [module], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BusinessException_tenantId_entityType_entityId_idx] ON [dbo].[BusinessException]([tenantId], [entityType], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartCompatibility_tenantId_partId_idx] ON [dbo].[PartCompatibility]([tenantId], [partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartCompatibility_tenantId_make_vehicleModel_idx] ON [dbo].[PartCompatibility]([tenantId], [make], [vehicleModel]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PartCompatibility_tenantId_assetTypeMasterId_idx] ON [dbo].[PartCompatibility]([tenantId], [assetTypeMasterId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InstalledPart_tenantId_vehicleId_installedAt_idx] ON [dbo].[InstalledPart]([tenantId], [vehicleId], [installedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InstalledPart_tenantId_partId_installedAt_idx] ON [dbo].[InstalledPart]([tenantId], [partId], [installedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InstalledPart_tenantId_serialNumber_idx] ON [dbo].[InstalledPart]([tenantId], [serialNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleHealthSnapshot_tenantId_vehicleId_createdAt_idx] ON [dbo].[VehicleHealthSnapshot]([tenantId], [vehicleId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleHealthSnapshot_tenantId_band_createdAt_idx] ON [dbo].[VehicleHealthSnapshot]([tenantId], [band], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProcurementRecommendation_tenantId_status_priority_idx] ON [dbo].[ProcurementRecommendation]([tenantId], [status], [priority]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProcurementRecommendation_tenantId_partId_idx] ON [dbo].[ProcurementRecommendation]([tenantId], [partId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceForecast_tenantId_estimatedDueDate_idx] ON [dbo].[MaintenanceForecast]([tenantId], [estimatedDueDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MaintenanceForecast_tenantId_vehicleId_idx] ON [dbo].[MaintenanceForecast]([tenantId], [vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DomainEventOutbox_tenantId_status_createdAt_idx] ON [dbo].[DomainEventOutbox]([tenantId], [status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DomainEventOutbox_tenantId_eventType_createdAt_idx] ON [dbo].[DomainEventOutbox]([tenantId], [eventType], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DomainEventOutbox_tenantId_aggregateType_aggregateId_idx] ON [dbo].[DomainEventOutbox]([tenantId], [aggregateType], [aggregateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BudgetCommitment_tenantId_period_status_idx] ON [dbo].[BudgetCommitment]([tenantId], [period], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BudgetCommitment_tenantId_departmentId_period_idx] ON [dbo].[BudgetCommitment]([tenantId], [departmentId], [period]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalRule_tenantId_processType_isActive_idx] ON [dbo].[ApprovalRule]([tenantId], [processType], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalRule_tenantId_ruleFamilyKey_version_idx] ON [dbo].[ApprovalRule]([tenantId], [ruleFamilyKey], [version]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalRule_tenantId_effectiveFrom_effectiveTo_idx] ON [dbo].[ApprovalRule]([tenantId], [effectiveFrom], [effectiveTo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalRule_tenantId_isActive_processType_idx] ON [dbo].[ApprovalRule]([tenantId], [isActive], [processType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalRuleLevel_tenantId_ruleId_idx] ON [dbo].[ApprovalRuleLevel]([tenantId], [ruleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalRequest_tenantId_status_requestedAt_idx] ON [dbo].[ApprovalRequest]([tenantId], [status], [requestedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalRequest_tenantId_processType_status_idx] ON [dbo].[ApprovalRequest]([tenantId], [processType], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalRequest_tenantId_subjectEntityType_subjectEntityId_idx] ON [dbo].[ApprovalRequest]([tenantId], [subjectEntityType], [subjectEntityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalRequest_tenantId_requesterId_status_idx] ON [dbo].[ApprovalRequest]([tenantId], [requesterId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalStep_tenantId_assignedApproverId_status_idx] ON [dbo].[ApprovalStep]([tenantId], [assignedApproverId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalStep_tenantId_status_dueAt_idx] ON [dbo].[ApprovalStep]([tenantId], [status], [dueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalStep_tenantId_backupApproverId_status_idx] ON [dbo].[ApprovalStep]([tenantId], [backupApproverId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalDecision_tenantId_approvalRequestId_decidedAt_idx] ON [dbo].[ApprovalDecision]([tenantId], [approvalRequestId], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalDecision_tenantId_actorId_decidedAt_idx] ON [dbo].[ApprovalDecision]([tenantId], [actorId], [decidedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlan_tenantId_status_idx] ON [dbo].[PmPlan]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlan_tenantId_nextDueAt_idx] ON [dbo].[PmPlan]([tenantId], [nextDueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlan_assetId_idx] ON [dbo].[PmPlan]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlan_vehicleId_idx] ON [dbo].[PmPlan]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlan_checklistTemplateId_idx] ON [dbo].[PmPlan]([checklistTemplateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlan_tenantId_siteId_idx] ON [dbo].[PmPlan]([tenantId], [siteId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlan_tenantId_functionalLocationId_idx] ON [dbo].[PmPlan]([tenantId], [functionalLocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlanRevision_tenantId_planId_idx] ON [dbo].[PmPlanRevision]([tenantId], [planId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlanRevision_planId_effectiveFrom_idx] ON [dbo].[PmPlanRevision]([planId], [effectiveFrom]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmTrigger_tenantId_planId_idx] ON [dbo].[PmTrigger]([tenantId], [planId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmTrigger_planId_kind_idx] ON [dbo].[PmTrigger]([planId], [kind]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmTrigger_meterId_idx] ON [dbo].[PmTrigger]([meterId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmAutoGeneration_tenantId_planId_idx] ON [dbo].[PmAutoGeneration]([tenantId], [planId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetMeter_tenantId_assetId_idx] ON [dbo].[AssetMeter]([tenantId], [assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetMeter_tenantId_vehicleId_idx] ON [dbo].[AssetMeter]([tenantId], [vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetMeter_tenantId_meterType_idx] ON [dbo].[AssetMeter]([tenantId], [meterType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetMeterReading_tenantId_meterId_recordedAt_idx] ON [dbo].[AssetMeterReading]([tenantId], [meterId], [recordedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AssetMeterReading_meterId_recordedAt_idx] ON [dbo].[AssetMeterReading]([meterId], [recordedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ChecklistTemplate_tenantId_isActive_idx] ON [dbo].[ChecklistTemplate]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ChecklistTemplate_tenantId_domainKey_idx] ON [dbo].[ChecklistTemplate]([tenantId], [domainKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ChecklistTemplateItem_templateId_sortOrder_idx] ON [dbo].[ChecklistTemplateItem]([templateId], [sortOrder]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InspectionTemplate_tenantId_isActive_idx] ON [dbo].[InspectionTemplate]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Inspection_tenantId_status_idx] ON [dbo].[Inspection]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Inspection_tenantId_result_idx] ON [dbo].[Inspection]([tenantId], [result]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Inspection_assetId_idx] ON [dbo].[Inspection]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Inspection_vehicleId_idx] ON [dbo].[Inspection]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Inspection_templateId_idx] ON [dbo].[Inspection]([templateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CalibrationRecord_tenantId_nextDueAt_idx] ON [dbo].[CalibrationRecord]([tenantId], [nextDueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CalibrationRecord_tenantId_equipmentAssetId_idx] ON [dbo].[CalibrationRecord]([tenantId], [equipmentAssetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CalibrationRecord_tenantId_result_idx] ON [dbo].[CalibrationRecord]([tenantId], [result]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ComplianceRequirement_tenantId_typeKey_status_idx] ON [dbo].[ComplianceRequirement]([tenantId], [typeKey], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ComplianceRequirement_tenantId_subjectType_subjectId_idx] ON [dbo].[ComplianceRequirement]([tenantId], [subjectType], [subjectId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ComplianceRequirement_tenantId_expiresAt_idx] ON [dbo].[ComplianceRequirement]([tenantId], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ComplianceRequirement_tenantId_isActive_expiresAt_idx] ON [dbo].[ComplianceRequirement]([tenantId], [isActive], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ChecklistExecution_tenantId_workOrderId_idx] ON [dbo].[ChecklistExecution]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ChecklistExecution_tenantId_inspectionId_idx] ON [dbo].[ChecklistExecution]([tenantId], [inspectionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ChecklistExecution_tenantId_templateId_idx] ON [dbo].[ChecklistExecution]([tenantId], [templateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InspectionFinding_tenantId_inspectionId_idx] ON [dbo].[InspectionFinding]([tenantId], [inspectionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InspectionFinding_tenantId_maintenanceRequestId_idx] ON [dbo].[InspectionFinding]([tenantId], [maintenanceRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderCostSnapshot_tenantId_snappedAt_idx] ON [dbo].[WorkOrderCostSnapshot]([tenantId], [snappedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorContact_tenantId_supplierId_idx] ON [dbo].[VendorContact]([tenantId], [supplierId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorContract_tenantId_status_idx] ON [dbo].[VendorContract]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorContract_tenantId_supplierId_idx] ON [dbo].[VendorContract]([tenantId], [supplierId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorContract_tenantId_endDate_idx] ON [dbo].[VendorContract]([tenantId], [endDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorContract_tenantId_complianceRequirementId_idx] ON [dbo].[VendorContract]([tenantId], [complianceRequirementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RepairWarranty_tenantId_workOrderId_idx] ON [dbo].[RepairWarranty]([tenantId], [workOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RepairWarranty_tenantId_endDate_idx] ON [dbo].[RepairWarranty]([tenantId], [endDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RepairWarranty_tenantId_supplierId_idx] ON [dbo].[RepairWarranty]([tenantId], [supplierId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RolePermission_permissionId_idx] ON [dbo].[RolePermission]([permissionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserSkill_skill_idx] ON [dbo].[UserSkill]([skill]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [JobCodeRequiredPart_sparePartId_idx] ON [dbo].[JobCodeRequiredPart]([sparePartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PmPlanRequiredPart_sparePartId_idx] ON [dbo].[PmPlanRequiredPart]([sparePartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TraceabilitySprayLink_sprayLogId_idx] ON [dbo].[TraceabilitySprayLink]([sprayLogId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorContractAsset_assetId_idx] ON [dbo].[VendorContractAsset]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorContractSite_siteId_idx] ON [dbo].[VendorContractSite]([siteId]);

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SecurityEvent] ADD CONSTRAINT [SecurityEvent_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshToken] ADD CONSTRAINT [RefreshToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshToken] ADD CONSTRAINT [RefreshToken_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PasswordResetToken] ADD CONSTRAINT [PasswordResetToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Role] ADD CONSTRAINT [Role_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TenantMembership] ADD CONSTRAINT [TenantMembership_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TenantMembership] ADD CONSTRAINT [TenantMembership_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TenantInvitation] ADD CONSTRAINT [TenantInvitation_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TenantInvitation] ADD CONSTRAINT [TenantInvitation_invitedById_fkey] FOREIGN KEY ([invitedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserInvitation] ADD CONSTRAINT [UserInvitation_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserInvitation] ADD CONSTRAINT [UserInvitation_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserInvitation] ADD CONSTRAINT [UserInvitation_invitedById_fkey] FOREIGN KEY ([invitedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Subscription] ADD CONSTRAINT [Subscription_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Subscription] ADD CONSTRAINT [Subscription_planId_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[Plan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Entitlement] ADD CONSTRAINT [Entitlement_planId_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[Plan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UsageMetric] ADD CONSTRAINT [UsageMetric_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UsageEvent] ADD CONSTRAINT [UsageEvent_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StripeCustomer] ADD CONSTRAINT [StripeCustomer_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StripeInvoice] ADD CONSTRAINT [StripeInvoice_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StripeInvoice] ADD CONSTRAINT [StripeInvoice_subscriptionId_fkey] FOREIGN KEY ([subscriptionId]) REFERENCES [dbo].[Subscription]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Department] ADD CONSTRAINT [Department_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Department] ADD CONSTRAINT [Department_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Department] ADD CONSTRAINT [Department_managerId_fkey] FOREIGN KEY ([managerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_domainId_fkey] FOREIGN KEY ([domainId]) REFERENCES [dbo].[AssetDomain]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_categoryMasterId_fkey] FOREIGN KEY ([categoryMasterId]) REFERENCES [dbo].[AssetCategoryMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_typeMasterId_fkey] FOREIGN KEY ([typeMasterId]) REFERENCES [dbo].[AssetTypeMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_siteId_fkey] FOREIGN KEY ([siteId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_functionalLocationId_fkey] FOREIGN KEY ([functionalLocationId]) REFERENCES [dbo].[FunctionalLocation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_parentAssetId_fkey] FOREIGN KEY ([parentAssetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_responsiblePersonId_fkey] FOREIGN KEY ([responsiblePersonId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetDomain] ADD CONSTRAINT [AssetDomain_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetCategoryMaster] ADD CONSTRAINT [AssetCategoryMaster_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetCategoryMaster] ADD CONSTRAINT [AssetCategoryMaster_domainId_fkey] FOREIGN KEY ([domainId]) REFERENCES [dbo].[AssetDomain]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetTypeMaster] ADD CONSTRAINT [AssetTypeMaster_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetTypeMaster] ADD CONSTRAINT [AssetTypeMaster_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[AssetCategoryMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetAttributeDefinition] ADD CONSTRAINT [AssetAttributeDefinition_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetAttributeDefinition] ADD CONSTRAINT [AssetAttributeDefinition_typeMasterId_fkey] FOREIGN KEY ([typeMasterId]) REFERENCES [dbo].[AssetTypeMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetLocationHistory] ADD CONSTRAINT [AssetLocationHistory_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetLocationHistory] ADD CONSTRAINT [AssetLocationHistory_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Vehicle] ADD CONSTRAINT [Vehicle_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Vehicle] ADD CONSTRAINT [Vehicle_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Vehicle] ADD CONSTRAINT [Vehicle_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Driver]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Vehicle] ADD CONSTRAINT [Vehicle_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleTyre] ADD CONSTRAINT [VehicleTyre_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleTyre] ADD CONSTRAINT [VehicleTyre_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleBattery] ADD CONSTRAINT [VehicleBattery_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleBattery] ADD CONSTRAINT [VehicleBattery_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleAssignment] ADD CONSTRAINT [VehicleAssignment_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleAssignment] ADD CONSTRAINT [VehicleAssignment_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleAssignment] ADD CONSTRAINT [VehicleAssignment_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Driver]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Driver] ADD CONSTRAINT [Driver_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Driver] ADD CONSTRAINT [Driver_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Driver] ADD CONSTRAINT [Driver_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FuelLog] ADD CONSTRAINT [FuelLog_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FuelLog] ADD CONSTRAINT [FuelLog_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Driver]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TripLog] ADD CONSTRAINT [TripLog_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TripLog] ADD CONSTRAINT [TripLog_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Driver]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleMeterLog] ADD CONSTRAINT [VehicleMeterLog_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleMeterLog] ADD CONSTRAINT [VehicleMeterLog_recordedById_fkey] FOREIGN KEY ([recordedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleGateMovement] ADD CONSTRAINT [VehicleGateMovement_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleGateMovement] ADD CONSTRAINT [VehicleGateMovement_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Driver]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleGateMovement] ADD CONSTRAINT [VehicleGateMovement_approvedById_fkey] FOREIGN KEY ([approvedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GpsLocation] ADD CONSTRAINT [GpsLocation_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceSchedule] ADD CONSTRAINT [MaintenanceSchedule_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceSchedule] ADD CONSTRAINT [MaintenanceSchedule_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JobCode] ADD CONSTRAINT [JobCode_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JobCode] ADD CONSTRAINT [JobCode_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[JobCode]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceLog] ADD CONSTRAINT [MaintenanceLog_scheduleId_fkey] FOREIGN KEY ([scheduleId]) REFERENCES [dbo].[MaintenanceSchedule]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceLog] ADD CONSTRAINT [MaintenanceLog_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceLog] ADD CONSTRAINT [MaintenanceLog_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceLog] ADD CONSTRAINT [MaintenanceLog_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_approvedById_fkey] FOREIGN KEY ([approvedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_scheduleId_fkey] FOREIGN KEY ([scheduleId]) REFERENCES [dbo].[MaintenanceSchedule]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_technicianId_fkey] FOREIGN KEY ([technicianId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_verifiedById_fkey] FOREIGN KEY ([verifiedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_reopenedById_fkey] FOREIGN KEY ([reopenedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_vendorSupplierId_fkey] FOREIGN KEY ([vendorSupplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_qrVerifiedById_fkey] FOREIGN KEY ([qrVerifiedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_accidentId_fkey] FOREIGN KEY ([accidentId]) REFERENCES [dbo].[AccidentReport]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_trafficFineId_fkey] FOREIGN KEY ([trafficFineId]) REFERENCES [dbo].[TrafficFine]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_siteId_fkey] FOREIGN KEY ([siteId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_functionalLocationId_fkey] FOREIGN KEY ([functionalLocationId]) REFERENCES [dbo].[FunctionalLocation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_domainId_fkey] FOREIGN KEY ([domainId]) REFERENCES [dbo].[AssetDomain]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_failureCodeId_fkey] FOREIGN KEY ([failureCodeId]) REFERENCES [dbo].[MaintenanceAnalysisCode]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_causeCodeId_fkey] FOREIGN KEY ([causeCodeId]) REFERENCES [dbo].[MaintenanceAnalysisCode]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_remedyCodeId_fkey] FOREIGN KEY ([remedyCodeId]) REFERENCES [dbo].[MaintenanceAnalysisCode]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_pmPlanId_fkey] FOREIGN KEY ([pmPlanId]) REFERENCES [dbo].[PmPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_taxonomyCategoryId_fkey] FOREIGN KEY ([taxonomyCategoryId]) REFERENCES [dbo].[WorkOrderTaxonomy]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_taxonomyTypeId_fkey] FOREIGN KEY ([taxonomyTypeId]) REFERENCES [dbo].[WorkOrderTaxonomy]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_taxonomyIssueId_fkey] FOREIGN KEY ([taxonomyIssueId]) REFERENCES [dbo].[WorkOrderTaxonomy]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderTaxonomy] ADD CONSTRAINT [WorkOrderTaxonomy_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderTaxonomy] ADD CONSTRAINT [WorkOrderTaxonomy_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[WorkOrderTaxonomy]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_linkedUserId_fkey] FOREIGN KEY ([linkedUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderAssignee] ADD CONSTRAINT [WorkOrderAssignee_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderAssignee] ADD CONSTRAINT [WorkOrderAssignee_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderAssignee] ADD CONSTRAINT [WorkOrderAssignee_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderAssignee] ADD CONSTRAINT [WorkOrderAssignee_assignedById_fkey] FOREIGN KEY ([assignedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceAnalysisCode] ADD CONSTRAINT [MaintenanceAnalysisCode_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderHoldHistory] ADD CONSTRAINT [WorkOrderHoldHistory_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderHoldHistory] ADD CONSTRAINT [WorkOrderHoldHistory_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderLabourEntry] ADD CONSTRAINT [WorkOrderLabourEntry_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderLabourEntry] ADD CONSTRAINT [WorkOrderLabourEntry_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderStatusHistory] ADD CONSTRAINT [WorkOrderStatusHistory_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderStatusHistory] ADD CONSTRAINT [WorkOrderStatusHistory_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeRosterEntry] ADD CONSTRAINT [EmployeeRosterEntry_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeRosterEntry] ADD CONSTRAINT [EmployeeRosterEntry_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeLeaveRequest] ADD CONSTRAINT [EmployeeLeaveRequest_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeLeaveRequest] ADD CONSTRAINT [EmployeeLeaveRequest_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeLeaveRequest] ADD CONSTRAINT [EmployeeLeaveRequest_approvedById_fkey] FOREIGN KEY ([approvedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SparePart] ADD CONSTRAINT [SparePart_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SparePart] ADD CONSTRAINT [SparePart_supplierId_fkey] FOREIGN KEY ([supplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Warehouse] ADD CONSTRAINT [Warehouse_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WarehouseItemBalance] ADD CONSTRAINT [WarehouseItemBalance_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WarehouseItemBalance] ADD CONSTRAINT [WarehouseItemBalance_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[Warehouse]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WarehouseItemBalance] ADD CONSTRAINT [WarehouseItemBalance_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StockMovement] ADD CONSTRAINT [StockMovement_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StockMovement] ADD CONSTRAINT [StockMovement_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StockMovement] ADD CONSTRAINT [StockMovement_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[Warehouse]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StockMovement] ADD CONSTRAINT [StockMovement_importRunId_fkey] FOREIGN KEY ([importRunId]) REFERENCES [dbo].[ErpImportBatch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StockMovement] ADD CONSTRAINT [StockMovement_reversalOfMovementId_fkey] FOREIGN KEY ([reversalOfMovementId]) REFERENCES [dbo].[StockMovement]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryIdempotency] ADD CONSTRAINT [InventoryIdempotency_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryImportRun] ADD CONSTRAINT [InventoryImportRun_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryImportRun] ADD CONSTRAINT [InventoryImportRun_uploadedById_fkey] FOREIGN KEY ([uploadedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryImportRow] ADD CONSTRAINT [InventoryImportRow_importRunId_fkey] FOREIGN KEY ([importRunId]) REFERENCES [dbo].[InventoryImportRun]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BulkImportRun] ADD CONSTRAINT [BulkImportRun_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BulkImportRun] ADD CONSTRAINT [BulkImportRun_actorUserId_fkey] FOREIGN KEY ([actorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BulkImportRow] ADD CONSTRAINT [BulkImportRow_runId_fkey] FOREIGN KEY ([runId]) REFERENCES [dbo].[BulkImportRun]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderPart] ADD CONSTRAINT [WorkOrderPart_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderPart] ADD CONSTRAINT [WorkOrderPart_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderPart] ADD CONSTRAINT [WorkOrderPart_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderPart] ADD CONSTRAINT [WorkOrderPart_partRequestId_fkey] FOREIGN KEY ([partRequestId]) REFERENCES [dbo].[PartRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Supplier] ADD CONSTRAINT [Supplier_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorRepairCase] ADD CONSTRAINT [VendorRepairCase_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorRepairCase] ADD CONSTRAINT [VendorRepairCase_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorRepairCase] ADD CONSTRAINT [VendorRepairCase_supplierId_fkey] FOREIGN KEY ([supplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorQuotation] ADD CONSTRAINT [VendorQuotation_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorQuotation] ADD CONSTRAINT [VendorQuotation_vendorRepairCaseId_fkey] FOREIGN KEY ([vendorRepairCaseId]) REFERENCES [dbo].[VendorRepairCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorQuotation] ADD CONSTRAINT [VendorQuotation_supplierId_fkey] FOREIGN KEY ([supplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorInvoice] ADD CONSTRAINT [VendorInvoice_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorInvoice] ADD CONSTRAINT [VendorInvoice_vendorRepairCaseId_fkey] FOREIGN KEY ([vendorRepairCaseId]) REFERENCES [dbo].[VendorRepairCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorInvoice] ADD CONSTRAINT [VendorInvoice_supplierId_fkey] FOREIGN KEY ([supplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrder] ADD CONSTRAINT [PurchaseOrder_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrder] ADD CONSTRAINT [PurchaseOrder_supplierId_fkey] FOREIGN KEY ([supplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrder] ADD CONSTRAINT [PurchaseOrder_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderLine] ADD CONSTRAINT [PurchaseOrderLine_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderLine] ADD CONSTRAINT [PurchaseOrderLine_purchaseOrderId_fkey] FOREIGN KEY ([purchaseOrderId]) REFERENCES [dbo].[PurchaseOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderLine] ADD CONSTRAINT [PurchaseOrderLine_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderLine] ADD CONSTRAINT [PurchaseOrderLine_partRequestId_fkey] FOREIGN KEY ([partRequestId]) REFERENCES [dbo].[PartRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderApproval] ADD CONSTRAINT [PurchaseOrderApproval_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderApproval] ADD CONSTRAINT [PurchaseOrderApproval_purchaseOrderId_fkey] FOREIGN KEY ([purchaseOrderId]) REFERENCES [dbo].[PurchaseOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderApproval] ADD CONSTRAINT [PurchaseOrderApproval_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderErpSync] ADD CONSTRAINT [PurchaseOrderErpSync_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderErpSync] ADD CONSTRAINT [PurchaseOrderErpSync_purchaseOrderId_fkey] FOREIGN KEY ([purchaseOrderId]) REFERENCES [dbo].[PurchaseOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderErpSync] ADD CONSTRAINT [PurchaseOrderErpSync_triggeredById_fkey] FOREIGN KEY ([triggeredById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartRequest] ADD CONSTRAINT [PartRequest_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartRequest] ADD CONSTRAINT [PartRequest_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartRequest] ADD CONSTRAINT [PartRequest_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartRequest] ADD CONSTRAINT [PartRequest_requestedById_fkey] FOREIGN KEY ([requestedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartRequestApproval] ADD CONSTRAINT [PartRequestApproval_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartRequestApproval] ADD CONSTRAINT [PartRequestApproval_partRequestId_fkey] FOREIGN KEY ([partRequestId]) REFERENCES [dbo].[PartRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartRequestApproval] ADD CONSTRAINT [PartRequestApproval_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartIssue] ADD CONSTRAINT [PartIssue_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartIssue] ADD CONSTRAINT [PartIssue_partRequestId_fkey] FOREIGN KEY ([partRequestId]) REFERENCES [dbo].[PartRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartIssue] ADD CONSTRAINT [PartIssue_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartIssue] ADD CONSTRAINT [PartIssue_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartIssue] ADD CONSTRAINT [PartIssue_issuedById_fkey] FOREIGN KEY ([issuedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseReceipt] ADD CONSTRAINT [PurchaseReceipt_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseReceipt] ADD CONSTRAINT [PurchaseReceipt_purchaseOrderId_fkey] FOREIGN KEY ([purchaseOrderId]) REFERENCES [dbo].[PurchaseOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseReceipt] ADD CONSTRAINT [PurchaseReceipt_receivedById_fkey] FOREIGN KEY ([receivedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseReceiptLine] ADD CONSTRAINT [PurchaseReceiptLine_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseReceiptLine] ADD CONSTRAINT [PurchaseReceiptLine_receiptId_fkey] FOREIGN KEY ([receiptId]) REFERENCES [dbo].[PurchaseReceipt]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseReceiptLine] ADD CONSTRAINT [PurchaseReceiptLine_purchaseOrderLineId_fkey] FOREIGN KEY ([purchaseOrderLineId]) REFERENCES [dbo].[PurchaseOrderLine]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseReceiptIdempotency] ADD CONSTRAINT [PurchaseReceiptIdempotency_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UtilityMeter] ADD CONSTRAINT [UtilityMeter_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MeterReading] ADD CONSTRAINT [MeterReading_meterId_fkey] FOREIGN KEY ([meterId]) REFERENCES [dbo].[UtilityMeter]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UtilityBill] ADD CONSTRAINT [UtilityBill_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UtilityBill] ADD CONSTRAINT [UtilityBill_meterId_fkey] FOREIGN KEY ([meterId]) REFERENCES [dbo].[UtilityMeter]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PredictiveLog] ADD CONSTRAINT [PredictiveLog_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CopilotConversation] ADD CONSTRAINT [CopilotConversation_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CopilotMessage] ADD CONSTRAINT [CopilotMessage_conversationId_fkey] FOREIGN KEY ([conversationId]) REFERENCES [dbo].[CopilotConversation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CopilotMessage] ADD CONSTRAINT [CopilotMessage_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CopilotExchangeLog] ADD CONSTRAINT [CopilotExchangeLog_conversationId_fkey] FOREIGN KEY ([conversationId]) REFERENCES [dbo].[CopilotConversation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CopilotExchangeLog] ADD CONSTRAINT [CopilotExchangeLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Property] ADD CONSTRAINT [Property_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Building] ADD CONSTRAINT [Building_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Building] ADD CONSTRAINT [Building_propertyId_fkey] FOREIGN KEY ([propertyId]) REFERENCES [dbo].[Property]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Floor] ADD CONSTRAINT [Floor_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Floor] ADD CONSTRAINT [Floor_buildingId_fkey] FOREIGN KEY ([buildingId]) REFERENCES [dbo].[Building]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Room] ADD CONSTRAINT [Room_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Room] ADD CONSTRAINT [Room_floorId_fkey] FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Site] ADD CONSTRAINT [Site_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FunctionalLocation] ADD CONSTRAINT [FunctionalLocation_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FunctionalLocation] ADD CONSTRAINT [FunctionalLocation_siteId_fkey] FOREIGN KEY ([siteId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FunctionalLocation] ADD CONSTRAINT [FunctionalLocation_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[FunctionalLocation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FunctionalLocation] ADD CONSTRAINT [FunctionalLocation_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CleaningLocation] ADD CONSTRAINT [CleaningLocation_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CleaningLocation] ADD CONSTRAINT [CleaningLocation_assignedCleanerId_fkey] FOREIGN KEY ([assignedCleanerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CleaningChecklistTemplate] ADD CONSTRAINT [CleaningChecklistTemplate_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[CleaningLocation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CleaningVisit] ADD CONSTRAINT [CleaningVisit_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CleaningVisit] ADD CONSTRAINT [CleaningVisit_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[CleaningLocation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CleaningVisit] ADD CONSTRAINT [CleaningVisit_cleanerId_fkey] FOREIGN KEY ([cleanerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CleaningVisit] ADD CONSTRAINT [CleaningVisit_signedOffById_fkey] FOREIGN KEY ([signedOffById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CleaningChecklist] ADD CONSTRAINT [CleaningChecklist_visitId_fkey] FOREIGN KEY ([visitId]) REFERENCES [dbo].[CleaningVisit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RequestProblemCategory] ADD CONSTRAINT [RequestProblemCategory_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_reportedById_fkey] FOREIGN KEY ([reportedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_siteId_fkey] FOREIGN KEY ([siteId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_functionalLocationId_fkey] FOREIGN KEY ([functionalLocationId]) REFERENCES [dbo].[FunctionalLocation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_domainId_fkey] FOREIGN KEY ([domainId]) REFERENCES [dbo].[AssetDomain]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_problemCategoryId_fkey] FOREIGN KEY ([problemCategoryId]) REFERENCES [dbo].[RequestProblemCategory]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_triageOwnerId_fkey] FOREIGN KEY ([triageOwnerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_duplicateOfId_fkey] FOREIGN KEY ([duplicateOfId]) REFERENCES [dbo].[MaintenanceRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_relatedRequestId_fkey] FOREIGN KEY ([relatedRequestId]) REFERENCES [dbo].[MaintenanceRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequest] ADD CONSTRAINT [MaintenanceRequest_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequestHistory] ADD CONSTRAINT [MaintenanceRequestHistory_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequestHistory] ADD CONSTRAINT [MaintenanceRequestHistory_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[MaintenanceRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceRequestHistory] ADD CONSTRAINT [MaintenanceRequestHistory_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FacilityIssue] ADD CONSTRAINT [FacilityIssue_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FacilityIssue] ADD CONSTRAINT [FacilityIssue_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[CleaningLocation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FacilityIssue] ADD CONSTRAINT [FacilityIssue_roomId_fkey] FOREIGN KEY ([roomId]) REFERENCES [dbo].[Room]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FacilityIssue] ADD CONSTRAINT [FacilityIssue_reportedById_fkey] FOREIGN KEY ([reportedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FacilityIssue] ADD CONSTRAINT [FacilityIssue_assignedToId_fkey] FOREIGN KEY ([assignedToId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FacilityIssue] ADD CONSTRAINT [FacilityIssue_resolvedById_fkey] FOREIGN KEY ([resolvedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FacilityIssue] ADD CONSTRAINT [FacilityIssue_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EvidenceAttachment] ADD CONSTRAINT [EvidenceAttachment_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EvidenceAttachment] ADD CONSTRAINT [EvidenceAttachment_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EvidenceAttachment] ADD CONSTRAINT [EvidenceAttachment_facilityIssueId_fkey] FOREIGN KEY ([facilityIssueId]) REFERENCES [dbo].[FacilityIssue]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EvidenceAttachment] ADD CONSTRAINT [EvidenceAttachment_maintenanceRequestId_fkey] FOREIGN KEY ([maintenanceRequestId]) REFERENCES [dbo].[MaintenanceRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EvidenceAttachment] ADD CONSTRAINT [EvidenceAttachment_uploadedById_fkey] FOREIGN KEY ([uploadedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CropCycle] ADD CONSTRAINT [CropCycle_fieldId_fkey] FOREIGN KEY ([fieldId]) REFERENCES [dbo].[Field]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[HarvestRecord] ADD CONSTRAINT [HarvestRecord_cropCycleId_fkey] FOREIGN KEY ([cropCycleId]) REFERENCES [dbo].[CropCycle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AnimalHealthRecord] ADD CONSTRAINT [AnimalHealthRecord_animalId_fkey] FOREIGN KEY ([animalId]) REFERENCES [dbo].[LivestockAnimal]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AnimalProductionLog] ADD CONSTRAINT [AnimalProductionLog_animalId_fkey] FOREIGN KEY ([animalId]) REFERENCES [dbo].[LivestockAnimal]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FeedingLog] ADD CONSTRAINT [FeedingLog_animalId_fkey] FOREIGN KEY ([animalId]) REFERENCES [dbo].[LivestockAnimal]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[IrrigationLog] ADD CONSTRAINT [IrrigationLog_fieldId_fkey] FOREIGN KEY ([fieldId]) REFERENCES [dbo].[Field]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SprayLog] ADD CONSTRAINT [SprayLog_fieldId_fkey] FOREIGN KEY ([fieldId]) REFERENCES [dbo].[Field]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SprayLog] ADD CONSTRAINT [SprayLog_cropCycleId_fkey] FOREIGN KEY ([cropCycleId]) REFERENCES [dbo].[CropCycle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SoilTest] ADD CONSTRAINT [SoilTest_fieldId_fkey] FOREIGN KEY ([fieldId]) REFERENCES [dbo].[Field]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AttendanceLog] ADD CONSTRAINT [AttendanceLog_workerId_fkey] FOREIGN KEY ([workerId]) REFERENCES [dbo].[FarmWorker]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleDocument] ADD CONSTRAINT [VehicleDocument_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleDocument] ADD CONSTRAINT [VehicleDocument_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleDocument] ADD CONSTRAINT [VehicleDocument_verifiedById_fkey] FOREIGN KEY ([verifiedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleDocument] ADD CONSTRAINT [VehicleDocument_uploadedById_fkey] FOREIGN KEY ([uploadedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AccidentReport] ADD CONSTRAINT [AccidentReport_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AccidentReport] ADD CONSTRAINT [AccidentReport_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AccidentReport] ADD CONSTRAINT [AccidentReport_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Driver]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AccidentReport] ADD CONSTRAINT [AccidentReport_reportedById_fkey] FOREIGN KEY ([reportedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AccidentEvidence] ADD CONSTRAINT [AccidentEvidence_accidentId_fkey] FOREIGN KEY ([accidentId]) REFERENCES [dbo].[AccidentReport]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AccidentEvidence] ADD CONSTRAINT [AccidentEvidence_uploadedById_fkey] FOREIGN KEY ([uploadedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InsuranceClaim] ADD CONSTRAINT [InsuranceClaim_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InsuranceClaim] ADD CONSTRAINT [InsuranceClaim_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InsuranceClaim] ADD CONSTRAINT [InsuranceClaim_accidentId_fkey] FOREIGN KEY ([accidentId]) REFERENCES [dbo].[AccidentReport]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InsuranceClaim] ADD CONSTRAINT [InsuranceClaim_filedById_fkey] FOREIGN KEY ([filedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TrafficFine] ADD CONSTRAINT [TrafficFine_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TrafficFine] ADD CONSTRAINT [TrafficFine_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TrafficFine] ADD CONSTRAINT [TrafficFine_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Driver]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TrafficFine] ADD CONSTRAINT [TrafficFine_reportedById_fkey] FOREIGN KEY ([reportedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[QaIssue] ADD CONSTRAINT [QaIssue_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[QaIssueRca] ADD CONSTRAINT [QaIssueRca_issueId_fkey] FOREIGN KEY ([issueId]) REFERENCES [dbo].[QaIssue]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[QaRegressionTest] ADD CONSTRAINT [QaRegressionTest_issueId_fkey] FOREIGN KEY ([issueId]) REFERENCES [dbo].[QaIssue]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeliveryChecklist] ADD CONSTRAINT [DeliveryChecklist_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeliveryChecklistItem] ADD CONSTRAINT [DeliveryChecklistItem_checklistId_fkey] FOREIGN KEY ([checklistId]) REFERENCES [dbo].[DeliveryChecklist]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeliverySignOff] ADD CONSTRAINT [DeliverySignOff_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TrainingSession] ADD CONSTRAINT [TrainingSession_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupportTicket] ADD CONSTRAINT [SupportTicket_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EscalationRule] ADD CONSTRAINT [EscalationRule_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ChangeRequest] ADD CONSTRAINT [ChangeRequest_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SoftwareRelease] ADD CONSTRAINT [SoftwareRelease_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[HypercarePlan] ADD CONSTRAINT [HypercarePlan_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupportHandover] ADD CONSTRAINT [SupportHandover_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PilotRollout] ADD CONSTRAINT [PilotRollout_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CutoverChecklistItem] ADD CONSTRAINT [CutoverChecklistItem_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolloutWave] ADD CONSTRAINT [RolloutWave_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GoLiveDecision] ADD CONSTRAINT [GoLiveDecision_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RollbackPlan] ADD CONSTRAINT [RollbackPlan_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GoLiveSignOff] ADD CONSTRAINT [GoLiveSignOff_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UatScenarioExecution] ADD CONSTRAINT [UatScenarioExecution_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ErpFieldMapping] ADD CONSTRAINT [ErpFieldMapping_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ErpImportBatch] ADD CONSTRAINT [ErpImportBatch_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ErpImportRow] ADD CONSTRAINT [ErpImportRow_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ErpImportRow] ADD CONSTRAINT [ErpImportRow_importRunId_fkey] FOREIGN KEY ([importRunId]) REFERENCES [dbo].[ErpImportBatch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ErpImportRow] ADD CONSTRAINT [ErpImportRow_mappedWarehouseId_fkey] FOREIGN KEY ([mappedWarehouseId]) REFERENCES [dbo].[Warehouse]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ErpReconciliationMismatch] ADD CONSTRAINT [ErpReconciliationMismatch_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ErpAccessChecklistItem] ADD CONSTRAINT [ErpAccessChecklistItem_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ErpMockSyncRun] ADD CONSTRAINT [ErpMockSyncRun_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BusinessException] ADD CONSTRAINT [BusinessException_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartCompatibility] ADD CONSTRAINT [PartCompatibility_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PartCompatibility] ADD CONSTRAINT [PartCompatibility_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InstalledPart] ADD CONSTRAINT [InstalledPart_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InstalledPart] ADD CONSTRAINT [InstalledPart_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InstalledPart] ADD CONSTRAINT [InstalledPart_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InstalledPart] ADD CONSTRAINT [InstalledPart_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleHealthSnapshot] ADD CONSTRAINT [VehicleHealthSnapshot_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleHealthSnapshot] ADD CONSTRAINT [VehicleHealthSnapshot_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProcurementRecommendation] ADD CONSTRAINT [ProcurementRecommendation_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProcurementRecommendation] ADD CONSTRAINT [ProcurementRecommendation_partId_fkey] FOREIGN KEY ([partId]) REFERENCES [dbo].[SparePart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceForecast] ADD CONSTRAINT [MaintenanceForecast_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MaintenanceForecast] ADD CONSTRAINT [MaintenanceForecast_scheduleId_fkey] FOREIGN KEY ([scheduleId]) REFERENCES [dbo].[MaintenanceSchedule]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DomainEventOutbox] ADD CONSTRAINT [DomainEventOutbox_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BudgetCommitment] ADD CONSTRAINT [BudgetCommitment_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRule] ADD CONSTRAINT [ApprovalRule_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRule] ADD CONSTRAINT [ApprovalRule_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRule] ADD CONSTRAINT [ApprovalRule_updatedById_fkey] FOREIGN KEY ([updatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRuleLevel] ADD CONSTRAINT [ApprovalRuleLevel_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRuleLevel] ADD CONSTRAINT [ApprovalRuleLevel_ruleId_fkey] FOREIGN KEY ([ruleId]) REFERENCES [dbo].[ApprovalRule]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRuleLevel] ADD CONSTRAINT [ApprovalRuleLevel_approverUserId_fkey] FOREIGN KEY ([approverUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRuleLevel] ADD CONSTRAINT [ApprovalRuleLevel_backupUserId_fkey] FOREIGN KEY ([backupUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRequest] ADD CONSTRAINT [ApprovalRequest_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRequest] ADD CONSTRAINT [ApprovalRequest_triggeredRuleId_fkey] FOREIGN KEY ([triggeredRuleId]) REFERENCES [dbo].[ApprovalRule]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalRequest] ADD CONSTRAINT [ApprovalRequest_requesterId_fkey] FOREIGN KEY ([requesterId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalStep] ADD CONSTRAINT [ApprovalStep_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalStep] ADD CONSTRAINT [ApprovalStep_approvalRequestId_fkey] FOREIGN KEY ([approvalRequestId]) REFERENCES [dbo].[ApprovalRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalStep] ADD CONSTRAINT [ApprovalStep_assignedApproverId_fkey] FOREIGN KEY ([assignedApproverId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalStep] ADD CONSTRAINT [ApprovalStep_backupApproverId_fkey] FOREIGN KEY ([backupApproverId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalDecision] ADD CONSTRAINT [ApprovalDecision_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalDecision] ADD CONSTRAINT [ApprovalDecision_approvalRequestId_fkey] FOREIGN KEY ([approvalRequestId]) REFERENCES [dbo].[ApprovalRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalDecision] ADD CONSTRAINT [ApprovalDecision_approvalStepId_fkey] FOREIGN KEY ([approvalStepId]) REFERENCES [dbo].[ApprovalStep]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalDecision] ADD CONSTRAINT [ApprovalDecision_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmPlan] ADD CONSTRAINT [PmPlan_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmPlan] ADD CONSTRAINT [PmPlan_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmPlan] ADD CONSTRAINT [PmPlan_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmPlan] ADD CONSTRAINT [PmPlan_checklistTemplateId_fkey] FOREIGN KEY ([checklistTemplateId]) REFERENCES [dbo].[ChecklistTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmPlan] ADD CONSTRAINT [PmPlan_siteId_fkey] FOREIGN KEY ([siteId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmPlan] ADD CONSTRAINT [PmPlan_functionalLocationId_fkey] FOREIGN KEY ([functionalLocationId]) REFERENCES [dbo].[FunctionalLocation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmPlanRevision] ADD CONSTRAINT [PmPlanRevision_planId_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[PmPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmTrigger] ADD CONSTRAINT [PmTrigger_planId_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[PmPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmTrigger] ADD CONSTRAINT [PmTrigger_meterId_fkey] FOREIGN KEY ([meterId]) REFERENCES [dbo].[AssetMeter]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmAutoGeneration] ADD CONSTRAINT [PmAutoGeneration_planId_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[PmPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetMeter] ADD CONSTRAINT [AssetMeter_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetMeter] ADD CONSTRAINT [AssetMeter_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetMeter] ADD CONSTRAINT [AssetMeter_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetMeterReading] ADD CONSTRAINT [AssetMeterReading_meterId_fkey] FOREIGN KEY ([meterId]) REFERENCES [dbo].[AssetMeter]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ChecklistTemplate] ADD CONSTRAINT [ChecklistTemplate_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ChecklistTemplateItem] ADD CONSTRAINT [ChecklistTemplateItem_templateId_fkey] FOREIGN KEY ([templateId]) REFERENCES [dbo].[ChecklistTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InspectionTemplate] ADD CONSTRAINT [InspectionTemplate_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InspectionTemplate] ADD CONSTRAINT [InspectionTemplate_checklistTemplateId_fkey] FOREIGN KEY ([checklistTemplateId]) REFERENCES [dbo].[ChecklistTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inspection] ADD CONSTRAINT [Inspection_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inspection] ADD CONSTRAINT [Inspection_templateId_fkey] FOREIGN KEY ([templateId]) REFERENCES [dbo].[InspectionTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inspection] ADD CONSTRAINT [Inspection_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Inspection] ADD CONSTRAINT [Inspection_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CalibrationRecord] ADD CONSTRAINT [CalibrationRecord_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CalibrationRecord] ADD CONSTRAINT [CalibrationRecord_equipmentAssetId_fkey] FOREIGN KEY ([equipmentAssetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ComplianceRequirement] ADD CONSTRAINT [ComplianceRequirement_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ChecklistExecution] ADD CONSTRAINT [ChecklistExecution_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InspectionFinding] ADD CONSTRAINT [InspectionFinding_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InspectionFinding] ADD CONSTRAINT [InspectionFinding_inspectionId_fkey] FOREIGN KEY ([inspectionId]) REFERENCES [dbo].[Inspection]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderCostSnapshot] ADD CONSTRAINT [WorkOrderCostSnapshot_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderCostSnapshot] ADD CONSTRAINT [WorkOrderCostSnapshot_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorContact] ADD CONSTRAINT [VendorContact_supplierId_fkey] FOREIGN KEY ([supplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorContract] ADD CONSTRAINT [VendorContract_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorContract] ADD CONSTRAINT [VendorContract_supplierId_fkey] FOREIGN KEY ([supplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RepairWarranty] ADD CONSTRAINT [RepairWarranty_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RepairWarranty] ADD CONSTRAINT [RepairWarranty_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RepairWarranty] ADD CONSTRAINT [RepairWarranty_supplierId_fkey] FOREIGN KEY ([supplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_permissionId_fkey] FOREIGN KEY ([permissionId]) REFERENCES [dbo].[Permission]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserSkill] ADD CONSTRAINT [UserSkill_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JobCodeRequiredPart] ADD CONSTRAINT [JobCodeRequiredPart_jobCodeId_fkey] FOREIGN KEY ([jobCodeId]) REFERENCES [dbo].[JobCode]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmPlanRequiredPart] ADD CONSTRAINT [PmPlanRequiredPart_pmPlanId_fkey] FOREIGN KEY ([pmPlanId]) REFERENCES [dbo].[PmPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TraceabilitySprayLink] ADD CONSTRAINT [TraceabilitySprayLink_traceabilityRecordId_fkey] FOREIGN KEY ([traceabilityRecordId]) REFERENCES [dbo].[TraceabilityRecord]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorContractAsset] ADD CONSTRAINT [VendorContractAsset_vendorContractId_fkey] FOREIGN KEY ([vendorContractId]) REFERENCES [dbo].[VendorContract]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorContractSite] ADD CONSTRAINT [VendorContractSite_vendorContractId_fkey] FOREIGN KEY ([vendorContractId]) REFERENCES [dbo].[VendorContract]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
