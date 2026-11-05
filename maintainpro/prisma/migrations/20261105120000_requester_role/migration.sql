-- REQUESTER role: can only report problems and follow their own requests (Report a Problem + Requests).
-- Idempotent data migration: adds the permissions, the role per tenant, and the role/permission links.
DECLARE @keys TABLE ([key] NVARCHAR(191));
INSERT INTO @keys ([key]) VALUES
  ('maintenance_requests.create'),
  ('maintenance_requests.view_own'),
  ('maintenance_requests.cancel_own');

INSERT INTO [dbo].[Permission] ([id], [key], [description], [createdAt], [updatedAt])
SELECT CONVERT(NVARCHAR(36), NEWID()), k.[key], NULL, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM @keys k
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[Permission] p WHERE p.[key] = k.[key]);

INSERT INTO [dbo].[Role] ([id], [tenantId], [name], [createdAt], [updatedAt])
SELECT CONVERT(NVARCHAR(36), NEWID()), t.[id], 'REQUESTER', SYSUTCDATETIME(), SYSUTCDATETIME()
FROM [dbo].[Tenant] t
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[Role] r WHERE r.[tenantId] = t.[id] AND r.[name] = 'REQUESTER');

INSERT INTO [dbo].[RolePermission] ([id], [roleId], [permissionId], [createdAt])
SELECT CONVERT(NVARCHAR(36), NEWID()), r.[id], p.[id], SYSUTCDATETIME()
FROM [dbo].[Role] r
JOIN [dbo].[Permission] p ON p.[key] IN (SELECT [key] FROM @keys)
WHERE r.[name] = 'REQUESTER'
  AND NOT EXISTS (SELECT 1 FROM [dbo].[RolePermission] rp WHERE rp.[roleId] = r.[id] AND rp.[permissionId] = p.[id]);
