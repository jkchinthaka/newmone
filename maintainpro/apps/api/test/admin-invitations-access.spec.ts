import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleName, TenantInvitationStatus, TenantMembershipRole } from "@prisma/client";

import { RolesGuard } from "../src/common/guards/roles.guard";
import { requestContext } from "../src/common/context/request-context";
import { AdminAccessController } from "../src/modules/admin/admin-access.controller";
import {
  ADMIN_INVITATION_REVIEW_FIELDS,
  ADMIN_INVITATION_SENSITIVE_FIELDS,
  AdminInvitationsService
} from "../src/modules/admin/admin-invitations.service";

const sampleInvitation = {
  id: "invite-1",
  tenantId: "tenant-a",
  email: "invitee@example.com",
  firstName: "Invite",
  lastName: "User",
  membershipRole: TenantMembershipRole.MEMBER,
  status: TenantInvitationStatus.PENDING,
  token: "secret-token-value",
  expiresAt: new Date("2026-07-01T00:00:00.000Z"),
  acceptedAt: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  tenant: { id: "tenant-a", name: "Tenant A" },
  invitedBy: {
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com"
  }
};

const createPrismaMock = () => ({
  tenantInvitation: {
    findMany: jest.fn().mockResolvedValue([sampleInvitation])
  }
});

describe("Admin invitation review", () => {
  it("returns sanitized tenant-scoped rows for ADMIN without tokens", async () => {
    const prisma = createPrismaMock();
    const service = new AdminInvitationsService(prisma as any, { createInvitation: jest.fn() } as any);

    const rows = await requestContext.run(
      {
        actorId: "admin-1",
        actorEmail: "admin@example.com",
        actorRole: "ADMIN",
        tenantId: "tenant-a",
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/invitations"
      },
      () => service.findAllForAdminInvitationReview()
    );

    expect(prisma.tenantInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a" },
        select: expect.not.objectContaining({ token: true })
      })
    );

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(Object.keys(row).sort()).toEqual([...ADMIN_INVITATION_REVIEW_FIELDS].sort());
    expect(row.email).toBe("invitee@example.com");
    expect(row.invitedByEmail).toBe("admin@example.com");

    for (const field of ADMIN_INVITATION_SENSITIVE_FIELDS) {
      assertObjectTreeHasNoSensitiveField(row, field);
    }
  });

  it("returns cross-tenant rows for SUPER_ADMIN without tenant filter", async () => {
    const prisma = createPrismaMock();
    const service = new AdminInvitationsService(prisma as any, { createInvitation: jest.fn() } as any);

    await requestContext.run(
      {
        actorId: "super-1",
        actorEmail: "super@example.com",
        actorRole: "SUPER_ADMIN",
        tenantId: null,
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/invitations"
      },
      () => service.findAllForAdminInvitationReview()
    );

    expect(prisma.tenantInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {}
      })
    );
  });

  it("blocks non-admin roles from the admin invitations endpoint via RolesGuard", () => {
    const guard = new RolesGuard(new Reflector());

    const context = {
      getHandler: () => AdminAccessController.prototype.listInvitationsForReview,
      getClass: () => AdminAccessController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "VIEWER" } })
      })
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(false);
  });
});

function assertObjectTreeHasNoSensitiveField(value: unknown, field: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => assertObjectTreeHasNoSensitiveField(entry, field));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  expect(Object.prototype.hasOwnProperty.call(value, field)).toBe(false);
  Object.values(value).forEach((entry) => assertObjectTreeHasNoSensitiveField(entry, field));
}
