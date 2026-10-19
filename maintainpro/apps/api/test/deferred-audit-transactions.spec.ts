/**
 * Automatic Prisma audits for batch and interactive transactions.
 * Runs only against a disposable maintainpro_e2e_* database.
 *
 * Batch audits are written after Prisma reports success, not inside the batch.
 * A crash between commit and that flush can omit the automatic row.
 * createMany stays unaudited at the middleware. Role-permission and user-skill
 * replacements write explicit audit rows inside their business transaction.
 * Explicit auditLog.create commits and rolls back with the business rows.
 */
import { randomUUID } from "node:crypto";
import { RoleName, UserInviteStatus } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { syncUserSkills, syncUserSkillsTx } from "../src/common/utils/user-skills.util";
import { PrismaService } from "../src/database/prisma.service";
import { RolesService } from "../src/modules/roles/roles.service";

function databaseName(url: string): string {
  const match = url.match(/(?:database|initial catalog)\s*=\s*([^;]+)/i);
  return match?.[1]?.trim() ?? "";
}

const disposableUrl = process.env.DISPOSABLE_SQLSERVER_URL?.trim() ?? "";
const name = databaseName(disposableUrl);
const usable =
  name.startsWith("maintainpro_e2e_") &&
  !/nelna/i.test(disposableUrl) &&
  !/MaintainProDev/i.test(disposableUrl);
const describeIfDisposable = usable ? describe : describe.skip;

describeIfDisposable("deferred automatic audits (disposable SQL Server)", () => {
  jest.setTimeout(60_000);
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = disposableUrl;
    process.env.PRIMARY_DATABASE_URL = disposableUrl;
    process.env.DATABASE_REPLICATION_ENABLED = "false";
    process.env.DATABASE_REPLICATION_MODE = "disabled";
    prisma = new PrismaService();
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    if (!usable) return;
    await prisma.$disconnect();
  });

  async function fixture(label: string) {
    const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}-${label}`;
    const tenant = await prisma.tenant.create({
      data: { name: `E2E audit ${stamp}`, slug: `e2e-audit-${stamp}` }
    });
    const role = await prisma.role.create({
      data: { tenantId: tenant.id, name: RoleName.ADMIN }
    });
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `audit-${stamp}@e2e.maintainpro.test`,
        passwordHash: "e2e-not-a-secret",
        firstName: "Before",
        lastName: "Audit",
        roleId: role.id
      }
    });
    return { stamp, tenant, role, user };
  }

  async function auditsFor(entity: string, entityId: string, action?: string) {
    return prisma.auditLog.findMany({
      where: { entity, entityId, ...(action ? { action } : {}) }
    });
  }

  it("writes one automatic audit after a successful batch transaction", async () => {
    const { tenant, user } = await fixture("batch-ok");
    await requestContext.run(
      {
        actorId: user.id,
        actorEmail: "audit@e2e.maintainpro.test",
        actorRole: "ADMIN",
        tenantId: tenant.id,
        module: "people",
        ipAddress: null,
        userAgent: null,
        requestPath: "/batch"
      },
      () =>
        prisma.$transaction([
          prisma.user.update({ where: { id: user.id }, data: { firstName: "BatchOk" } })
        ])
    );

    const rows = await auditsFor("User", user.id, "UPDATE");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenantId).toBe(tenant.id);
    expect(rows[0]?.actorId).toBe(user.id);
    expect(rows[0]?.action).toBe("UPDATE");
    expect(rows[0]?.entity).toBe("User");
    const saved = await prisma.user.findUnique({ where: { id: user.id } });
    expect(saved?.firstName).toBe("BatchOk");
  });

  it("writes one automatic audit after a successful interactive transaction", async () => {
    const { tenant, user } = await fixture("itx-ok");
    await requestContext.run(
      {
        actorId: user.id,
        actorEmail: "audit@e2e.maintainpro.test",
        actorRole: "ADMIN",
        tenantId: tenant.id,
        module: "people",
        ipAddress: null,
        userAgent: null,
        requestPath: "/interactive"
      },
      () =>
        prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: user.id }, data: { firstName: "InteractiveOk" } });
        })
    );

    const rows = await auditsFor("User", user.id, "UPDATE");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenantId).toBe(tenant.id);
    expect(rows[0]?.actorId).toBe(user.id);
  });

  it("does not write automatic audits when an interactive transaction rolls back", async () => {
    const { tenant, user } = await fixture("itx-rollback");
    await expect(
      requestContext.run(
        {
          actorId: user.id,
          actorEmail: "audit@e2e.maintainpro.test",
          actorRole: "ADMIN",
          tenantId: tenant.id,
          module: "people",
          ipAddress: null,
          userAgent: null,
          requestPath: "/interactive-rollback"
        },
        () =>
          prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: user.id }, data: { firstName: "ShouldRollback" } });
            throw new Error("rollback interactive");
          })
      )
    ).rejects.toThrow("rollback interactive");

    expect(await auditsFor("User", user.id, "UPDATE")).toHaveLength(0);
    const saved = await prisma.user.findUnique({ where: { id: user.id } });
    expect(saved?.firstName).toBe("Before");
  });

  it("does not write automatic audits when a batch transaction fails", async () => {
    const { tenant, role, user } = await fixture("batch-fail");
    await expect(
      requestContext.run(
        {
          actorId: user.id,
          actorEmail: "audit@e2e.maintainpro.test",
          actorRole: "ADMIN",
          tenantId: tenant.id,
          module: "people",
          ipAddress: null,
          userAgent: null,
          requestPath: "/batch-fail"
        },
        () =>
          prisma.$transaction([
            prisma.user.update({ where: { id: user.id }, data: { firstName: "ShouldRollback" } }),
            prisma.user.create({
              data: {
                tenantId: tenant.id,
                email: user.email,
                passwordHash: "e2e-not-a-secret",
                firstName: "Duplicate",
                lastName: "Email",
                roleId: role.id
              }
            })
          ])
      )
    ).rejects.toThrow();

    expect(await auditsFor("User", user.id, "UPDATE")).toHaveLength(0);
    const saved = await prisma.user.findUnique({ where: { id: user.id } });
    expect(saved?.firstName).toBe("Before");
  });

  it("audits removed role permissions once and does not duplicate the batch", async () => {
    const { tenant, role, user } = await fixture("rbac");
    const removed = await prisma.permission.create({
      data: { key: `e2e.rbac.removed.${user.id}`, description: "removed" }
    });
    const kept = await prisma.permission.create({
      data: { key: `e2e.rbac.kept.${user.id}`, description: "kept" }
    });
    const link = await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: removed.id }
    });

    await requestContext.run(
      {
        actorId: user.id,
        actorEmail: "audit@e2e.maintainpro.test",
        actorRole: "ADMIN",
        tenantId: tenant.id,
        module: "roles",
        ipAddress: null,
        userAgent: null,
        requestPath: "/roles"
      },
      () =>
        prisma.$transaction([
          prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
          prisma.rolePermission.createMany({
            data: [{ roleId: role.id, permissionId: kept.id }]
          })
        ])
    );

    const deleted = await auditsFor("RolePermission", link.id, "DELETE");
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.actorId).toBe(user.id);
    expect(deleted[0]?.tenantId).toBe(tenant.id);
    const createdLinks = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    expect(createdLinks).toHaveLength(1);
    const createdAudits = await prisma.auditLog.findMany({
      where: { entity: "RolePermission", entityId: createdLinks[0]?.id, action: "CREATE" }
    });
    expect(createdAudits).toHaveLength(0);
  });

  it("covers invitation acceptance with one automatic user audit and one explicit invitation audit", async () => {
    const { tenant, user } = await fixture("invite");
    const inviter = user;
    const now = new Date();
    const invitation = await prisma.userInvitation.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        tokenHash: `token-${user.id}`,
        expiresAt: new Date(now.getTime() + 60_000),
        invitedById: inviter.id,
        status: UserInviteStatus.SENT
      }
    });

    await requestContext.run(
      {
        actorId: user.id,
        actorEmail: "audit@e2e.maintainpro.test",
        actorRole: "ADMIN",
        tenantId: tenant.id,
        module: "people",
        ipAddress: null,
        userAgent: null,
        requestPath: "/accept-invite"
      },
      () =>
        prisma.$transaction(async (tx) => {
          const claim = await tx.userInvitation.updateMany({
            where: {
              id: invitation.id,
              acceptedAt: null,
              status: UserInviteStatus.SENT
            },
            data: { status: UserInviteStatus.ACCEPTED, acceptedAt: now }
          });
          if (claim.count !== 1) throw new Error("invitation was not claimed");
          await tx.user.update({
            where: { id: user.id },
            data: {
              passwordHash: "accepted-hash",
              mustChangePassword: false,
              isActive: true
            }
          });
          await tx.auditLog.create({
            data: {
              tenantId: tenant.id,
              actorId: user.id,
              module: "people",
              entity: "UserInvitation",
              entityId: invitation.id,
              action: "UPDATE"
            }
          });
        })
    );

    const userAudits = await auditsFor("User", user.id, "UPDATE");
    expect(userAudits).toHaveLength(1);
    expect(userAudits[0]?.tenantId).toBe(tenant.id);
    expect(userAudits[0]?.actorId).toBe(user.id);
    const invitationAudits = await auditsFor("UserInvitation", invitation.id, "UPDATE");
    expect(invitationAudits).toHaveLength(1);
    expect(invitationAudits[0]?.actorId).toBe(user.id);
  });

  it("audits a replaced user skill from the batch delete and does not duplicate it", async () => {
    const { tenant, user } = await fixture("skills");
    const previous = await prisma.userSkill.create({
      data: { userId: user.id, skill: "electrical" }
    });

    await requestContext.run(
      {
        actorId: user.id,
        actorEmail: "audit@e2e.maintainpro.test",
        actorRole: "ADMIN",
        tenantId: tenant.id,
        module: "people",
        ipAddress: null,
        userAgent: null,
        requestPath: "/skills"
      },
      () => syncUserSkills(prisma, user.id, ["mechanical"])
    );

    const removed = await auditsFor("UserSkill", previous.id, "DELETE");
    expect(removed).toHaveLength(1);
    expect(removed[0]?.tenantId).toBe(tenant.id);
    expect(removed[0]?.actorId).toBe(user.id);
    const next = await prisma.userSkill.findFirst({ where: { userId: user.id, skill: "mechanical" } });
    expect(next?.id).toBeTruthy();
    const inserted = await auditsFor("UserSkill", next!.id, "CREATE");
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.tenantId).toBe(tenant.id);
    expect(inserted[0]?.actorId).toBe(user.id);
    expect(inserted[0]?.afterData).toContain("mechanical");
  });

  function actorContext(tenantId: string, userId: string, path: string) {
    return {
      actorId: userId,
      actorEmail: "audit@e2e.maintainpro.test",
      actorRole: "ADMIN",
      tenantId,
      module: "roles",
      ipAddress: null,
      userAgent: null,
      requestPath: path
    };
  }

  it("records one grant and one removal for a role permission without duplicates", async () => {
    const { tenant, role, user } = await fixture("role-grant");
    const permission = await prisma.permission.create({
      data: { key: `e2e.grant.${user.id}`, description: "grant" }
    });
    const roles = new RolesService(prisma);

    await requestContext.run(actorContext(tenant.id, user.id, "/roles/grant"), () =>
      roles.update(role.id, { permissionIds: [permission.id] })
    );
    const granted = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permissionId: permission.id }
    });
    expect(granted?.id).toBeTruthy();
    const created = await auditsFor("RolePermission", granted!.id, "CREATE");
    expect(created).toHaveLength(1);
    expect(created[0]?.tenantId).toBe(tenant.id);
    expect(created[0]?.actorId).toBe(user.id);
    expect(created[0]?.afterData).toContain(permission.id);

    await requestContext.run(actorContext(tenant.id, user.id, "/roles/remove"), () =>
      roles.update(role.id, { permissionIds: [] })
    );
    const removed = await auditsFor("RolePermission", granted!.id, "DELETE");
    expect(removed).toHaveLength(1);
    expect(removed[0]?.tenantId).toBe(tenant.id);
    expect(removed[0]?.actorId).toBe(user.id);
    expect(removed[0]?.beforeData).toContain(permission.id);
    expect(await prisma.rolePermission.count({ where: { roleId: role.id } })).toBe(0);
    expect(await auditsFor("RolePermission", granted!.id, "CREATE")).toHaveLength(1);
  });

  it("leaves unchanged role permissions in place and audits only the delta", async () => {
    const { tenant, role, user } = await fixture("role-delta");
    const kept = await prisma.permission.create({
      data: { key: `e2e.keep.${user.id}`, description: "keep" }
    });
    const removedPermission = await prisma.permission.create({
      data: { key: `e2e.drop.${user.id}`, description: "drop" }
    });
    const added = await prisma.permission.create({
      data: { key: `e2e.add.${user.id}`, description: "add" }
    });
    const roles = new RolesService(prisma);
    const run = (permissionIds: string[], path: string) =>
      requestContext.run(actorContext(tenant.id, user.id, path), () =>
        roles.update(role.id, { permissionIds })
      );

    await run([kept.id, removedPermission.id], "/roles/base");
    const before = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    const keptLink = before.find((row) => row.permissionId === kept.id);
    const removedLink = before.find((row) => row.permissionId === removedPermission.id);
    expect(keptLink?.id).toBeTruthy();
    expect(removedLink?.id).toBeTruthy();
    const auditsBefore = await prisma.auditLog.count({
      where: { entity: "RolePermission", entityId: { in: before.map((row) => row.id) } }
    });

    await run([kept.id, removedPermission.id], "/roles/noop");
    const afterNoop = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    expect(afterNoop.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
    expect(
      await prisma.auditLog.count({
        where: { entity: "RolePermission", entityId: { in: before.map((row) => row.id) } }
      })
    ).toBe(auditsBefore);

    await run([kept.id, added.id], "/roles/mixed");
    const after = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    const stillKept = after.find((row) => row.permissionId === kept.id);
    const inserted = after.find((row) => row.permissionId === added.id);
    expect(stillKept?.id).toBe(keptLink!.id);
    expect(inserted?.id).toBeTruthy();
    expect(after.find((row) => row.permissionId === removedPermission.id)).toBeUndefined();
    expect(await auditsFor("RolePermission", keptLink!.id, "DELETE")).toHaveLength(0);
    expect(await auditsFor("RolePermission", keptLink!.id, "CREATE")).toHaveLength(1);
    expect(await auditsFor("RolePermission", removedLink!.id, "DELETE")).toHaveLength(1);
    const addedAudits = await auditsFor("RolePermission", inserted!.id, "CREATE");
    expect(addedAudits).toHaveLength(1);
    expect(addedAudits[0]?.tenantId).toBe(tenant.id);
    expect(addedAudits[0]?.actorId).toBe(user.id);
  });

  it("does not keep role-permission audits when the grant transaction rolls back", async () => {
    const { tenant, role, user } = await fixture("role-rollback");
    const permission = await prisma.permission.create({
      data: { key: `e2e.rollback.${user.id}`, description: "rollback" }
    });
    const link = await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id }
    });
    const roles = new RolesService(prisma);

    await expect(
      requestContext.run(actorContext(tenant.id, user.id, "/roles/rollback"), () =>
        roles.update(role.id, { permissionIds: ["missing-permission"] })
      )
    ).rejects.toThrow();

    expect(await prisma.rolePermission.findUnique({ where: { id: link.id } })).toBeTruthy();
    expect(await auditsFor("RolePermission", link.id, "DELETE")).toHaveLength(0);
    expect(await prisma.rolePermission.count({ where: { roleId: role.id } })).toBe(1);
  });

  it("does not keep user-skill audits when the replacement transaction rolls back", async () => {
    const { tenant, user } = await fixture("skill-rollback");
    const previous = await prisma.userSkill.create({
      data: { userId: user.id, skill: "electrical" }
    });

    await expect(
      requestContext.run(actorContext(tenant.id, user.id, "/skills/rollback"), () =>
        prisma.$transaction(async (tx) => {
          await syncUserSkillsTx(tx, user.id, ["mechanical"]);
          throw new Error("rollback skills");
        })
      )
    ).rejects.toThrow("rollback skills");

    expect(await prisma.userSkill.findUnique({ where: { id: previous.id } })).toBeTruthy();
    expect(await prisma.userSkill.findFirst({ where: { userId: user.id, skill: "mechanical" } })).toBeNull();
    expect(await auditsFor("UserSkill", previous.id, "DELETE")).toHaveLength(0);
  });
});
