import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RoleName, TenantInvitationStatus, TenantMembershipRole } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { AdminInvitationsService } from "../src/modules/admin/admin-invitations.service";
import {
  CREATE_INVITATION_SENSITIVE_FIELDS,
  CREATE_TENANT_INVITATION_RESPONSE_FIELDS,
  InvitationsService
} from "../src/modules/invitations/invitations.service";

const createResponse = {
  id: "invite-1",
  tenantId: "tenant-a",
  tenantName: "Tenant A",
  email: "invitee@example.com",
  inviteeDisplayName: "Invite User",
  membershipRole: TenantMembershipRole.MEMBER,
  status: TenantInvitationStatus.PENDING,
  createdAt: "2026-06-01T00:00:00.000Z",
  expiresAt: "2026-07-01T00:00:00.000Z",
  invitationLink: "https://app.example.com/register?invitationToken=secret-token-value"
};

const createPrismaMock = () => ({
  tenantInvitation: {
    findMany: jest.fn()
  }
});

const createInvitationsServiceMock = () => ({
  createInvitation: jest.fn().mockResolvedValue(createResponse)
});

describe("Admin invitation create flow", () => {
  it("creates an invitation for ADMIN within active tenant scope", async () => {
    const invitationsService = createInvitationsServiceMock();
    const service = new AdminInvitationsService(createPrismaMock() as any, invitationsService as any);

    const result = await requestContext.run(
      {
        actorId: "admin-1",
        actorEmail: "admin@example.com",
        actorRole: RoleName.ADMIN,
        tenantId: "tenant-a",
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/invitations"
      },
      () =>
        service.createInvitationForAdminConsole({
          email: "invitee@example.com",
          membershipRole: TenantMembershipRole.MEMBER
        })
    );

    expect(invitationsService.createInvitation).toHaveBeenCalledWith("admin-1", "tenant-a", {
      email: "invitee@example.com",
      firstName: undefined,
      lastName: undefined,
      membershipRole: TenantMembershipRole.MEMBER
    });
    expect(Object.keys(result).sort()).toEqual([...CREATE_TENANT_INVITATION_RESPONSE_FIELDS].sort());
    expect(result.invitationLink).toContain("/register?invitationToken=");

    for (const field of CREATE_INVITATION_SENSITIVE_FIELDS) {
      assertObjectTreeHasNoSensitiveField(result, field);
    }
  });

  it("blocks ADMIN from creating invitations for another tenant", async () => {
    const invitationsService = createInvitationsServiceMock();
    const service = new AdminInvitationsService(createPrismaMock() as any, invitationsService as any);

    await expect(
      requestContext.run(
        {
          actorId: "admin-1",
          actorEmail: "admin@example.com",
          actorRole: RoleName.ADMIN,
          tenantId: "tenant-a",
          module: "admin",
          ipAddress: null,
          userAgent: null,
          requestPath: "/admin/invitations"
        },
        () =>
          service.createInvitationForAdminConsole({
            email: "invitee@example.com",
            tenantId: "tenant-b"
          })
      )
    ).rejects.toThrow(ForbiddenException);

    expect(invitationsService.createInvitation).not.toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN to create invitations for a selected tenant", async () => {
    const invitationsService = createInvitationsServiceMock();
    const service = new AdminInvitationsService(createPrismaMock() as any, invitationsService as any);

    await requestContext.run(
      {
        actorId: "super-1",
        actorEmail: "super@example.com",
        actorRole: RoleName.SUPER_ADMIN,
        tenantId: null,
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/invitations"
      },
      () =>
        service.createInvitationForAdminConsole({
          email: "invitee@example.com",
          tenantId: "tenant-b"
        })
    );

    expect(invitationsService.createInvitation).toHaveBeenCalledWith("super-1", "tenant-b", {
      email: "invitee@example.com",
      firstName: undefined,
      lastName: undefined,
      membershipRole: undefined
    });
  });

  it("requires tenant context for ADMIN create requests", async () => {
    const invitationsService = createInvitationsServiceMock();
    const service = new AdminInvitationsService(createPrismaMock() as any, invitationsService as any);

    await expect(
      requestContext.run(
        {
          actorId: "admin-1",
          actorEmail: "admin@example.com",
          actorRole: RoleName.ADMIN,
          tenantId: null,
          module: "admin",
          ipAddress: null,
          userAgent: null,
          requestPath: "/admin/invitations"
        },
        () =>
          service.createInvitationForAdminConsole({
            email: "invitee@example.com"
          })
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects unsafe membership roles through shared invitation service", async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: "tenant-a", name: "Tenant A" }) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      tenantInvitation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      tenantMembership: { findUnique: jest.fn() }
    };
    const tenancyService = {
      ensureTenantAccess: jest.fn().mockResolvedValue({
        user: { role: { name: RoleName.ADMIN } },
        membershipRole: TenantMembershipRole.ADMIN
      })
    };
    const service = new InvitationsService(
      prisma as any,
      tenancyService as any,
      { get: jest.fn() } as unknown as ConfigService
    );

    await expect(
      service.createInvitation("admin-1", "tenant-a", {
        email: "invitee@example.com",
        membershipRole: TenantMembershipRole.OWNER
      })
    ).rejects.toThrow("Membership role OWNER cannot be assigned through invitation");
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
