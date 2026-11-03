import { Prisma, PrismaClient } from "@prisma/client";

type CleanupClient = Pick<PrismaClient, "$queryRaw" | "$transaction" | "$executeRawUnsafe">;

const TENANT_ID = /^[a-z0-9]+$/i;

/**
 * Throws unless the connected SQL Server database is a disposable maintainpro_e2e_* database.
 * Every cleanup that deletes rows or touches the AuditLog trigger must call this first.
 */
export async function assertDisposableSqlServer(prisma: Pick<PrismaClient, "$queryRaw">): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>(Prisma.sql`SELECT DB_NAME() AS name`);
  const database = rows[0]?.name ?? "";
  if (!database.startsWith("maintainpro_e2e_") || /nelna|MaintainProDev/i.test(database)) {
    throw new Error(`Refusing cleanup on database ${database || "(unknown)"}`);
  }
  return database;
}

/**
 * Deletes tenants created by disposable SQL Server specs.
 * AuditLog is immutable, so the cleanup turns that trigger off only inside this
 * transaction on a maintainpro_e2e_* database, then turns it back on before commit.
 * Users that are not fixture accounts are moved back to the seeded default tenant.
 */
export async function deleteDisposableTenants(prisma: CleanupClient, tenantIds: string[]): Promise<void> {
  const ids = [...new Set(tenantIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return;
  if (ids.some((id) => !TENANT_ID.test(id))) {
    throw new Error("Refusing tenant cleanup because a tenant id is not a plain id");
  }

  await assertDisposableSqlServer(prisma);

  const list = ids.map((id) => `N'${id}'`).join(", ");
  const fixtureUser = `[tenantId] IN (${list}) AND ([email] LIKE N'%@e2e.maintainpro.test' OR [email] LIKE N'nav-admin-%@example.test')`;

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`DISABLE TRIGGER [dbo].[trg_AuditLog_immutable] ON [dbo].[AuditLog]`);
      try {
        await tx.$executeRawUnsafe(`
          DECLARE @default nvarchar(36) = (SELECT [id] FROM [Tenant] WHERE [slug] = N'default');
          IF EXISTS (
            SELECT 1 FROM [User]
            WHERE [tenantId] IN (${list})
              AND [email] NOT LIKE N'%@e2e.maintainpro.test'
              AND [email] NOT LIKE N'nav-admin-%@example.test'
          ) AND @default IS NULL
            THROW 50005, N'default tenant missing; refusing to detach preserved users', 1;

          UPDATE [User]
          SET [tenantId] = @default
          WHERE [tenantId] IN (${list})
            AND [email] NOT LIKE N'%@e2e.maintainpro.test'
            AND [email] NOT LIKE N'nav-admin-%@example.test'
            AND @default IS NOT NULL;

          UPDATE [RefreshToken]
          SET [tenantId] = @default
          WHERE [tenantId] IN (${list})
            AND [userId] NOT IN (SELECT [id] FROM [User] WHERE ${fixtureUser})
            AND @default IS NOT NULL;

          DELETE FROM [AuditLog]
          WHERE [tenantId] IN (${list})
            OR [actorId] IN (SELECT [id] FROM [User] WHERE ${fixtureUser});

          DELETE FROM [WorkOrderAssignee] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderStatusHistory] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderLabourEntry] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderCostSnapshot] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderClassification] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderCompletion] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderExecution] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderHoldHistory] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderPart] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderPlanning] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderSafety] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrderTaxonomy] WHERE [tenantId] IN (${list});
          DELETE FROM [WorkOrder] WHERE [tenantId] IN (${list});
          DELETE FROM [EmployeeLeaveRequest] WHERE [tenantId] IN (${list});
          DELETE FROM [Employee] WHERE [tenantId] IN (${list});
          DELETE FROM [MeterReading] WHERE [meterId] IN (SELECT [id] FROM [UtilityMeter] WHERE [tenantId] IN (${list}));
          DELETE FROM [UtilityBill] WHERE [tenantId] IN (${list});
          DELETE FROM [UtilityMeter] WHERE [tenantId] IN (${list});
          DELETE FROM [Asset] WHERE [tenantId] IN (${list});
          DELETE FROM [UserSkill] WHERE [userId] IN (SELECT [id] FROM [User] WHERE ${fixtureUser});
          DELETE FROM [UserInvitation]
          WHERE [tenantId] IN (${list})
            OR [userId] IN (SELECT [id] FROM [User] WHERE ${fixtureUser})
            OR [invitedById] IN (SELECT [id] FROM [User] WHERE ${fixtureUser});
          DELETE FROM [BulkImportRow] WHERE [tenantId] IN (${list});
          DELETE FROM [BulkImportRun] WHERE [tenantId] IN (${list});
          DELETE FROM [Notification] WHERE [userId] IN (SELECT [id] FROM [User] WHERE ${fixtureUser});
          DELETE FROM [RefreshToken] WHERE [userId] IN (SELECT [id] FROM [User] WHERE ${fixtureUser});
          DELETE FROM [TenantMembership] WHERE [tenantId] IN (${list}) OR [userId] IN (SELECT [id] FROM [User] WHERE ${fixtureUser});
          DELETE FROM [RolePermission] WHERE [roleId] IN (SELECT [id] FROM [Role] WHERE [tenantId] IN (${list}));
          DELETE FROM [Permission]
          WHERE [key] LIKE N'e2e.%'
            AND NOT EXISTS (SELECT 1 FROM [RolePermission] rp WHERE rp.[permissionId] = [Permission].[id])
            AND EXISTS (
              SELECT 1 FROM [User] u
              WHERE ${fixtureUser.replaceAll("[tenantId]", "u.[tenantId]").replaceAll("[email]", "u.[email]")}
                AND [Permission].[key] LIKE N'%' + u.[id] + N'%'
            );
          DELETE FROM [TenantFeatureFlag] WHERE [tenantId] IN (${list});
          DELETE FROM [TenantMaintenanceSetting] WHERE [tenantId] IN (${list});
          DELETE FROM [DomainEventOutbox] WHERE [tenantId] IN (${list});
          DELETE FROM [User] WHERE ${fixtureUser};
          DELETE FROM [Role] WHERE [tenantId] IN (${list});
          DELETE FROM [Tenant] WHERE [id] IN (${list});
        `);
      } finally {
        await tx.$executeRawUnsafe(`ENABLE TRIGGER [dbo].[trg_AuditLog_immutable] ON [dbo].[AuditLog]`);
      }
    },
    { timeout: 60_000 }
  );
}
