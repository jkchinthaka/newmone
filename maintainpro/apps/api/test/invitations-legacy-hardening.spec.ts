import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RoleName, TenantInvitationStatus, TenantMembershipRole } from "@prisma/client";

import {
  INVITATIONS_LEGACY_SENSITIVE_FIELDS,
  InvitationsService,
  PUBLIC_TENANT_INVITATION_RESPONSE_FIELDS
} from "../src/modules/invitations/invitations.service";

const sampleInvitationDb = {
  id: "invite-1",
  tenantId: "tenant-a",
  email: "invitee@example.com",
  firstName: "Invite",
  lastName: "User",
  membershipRole: TenantMembershipRole.MEMBER,
  status: TenantInvitationStatus.PENDING,
  token: "secret-token-value",
  invitedById: "admin-1",
  expiresAt: new Date("2026-07-01T00:00:00.000Z"),
  acceptedAt: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  invitedBy: {
    id: "admin-1",
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com"
  }
};

const createPrismaMock = () => ({
  tenantInvitation: {
    findMany: jest.fn().mockResolvedValue([sampleInvitationDb]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  tenant: {
    findUnique: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  },
  tenantMembership: {
    findUnique: jest.fn()
  }
});

const createTenancyMock = (membershipRole: TenantMembershipRole = TenantMembershipRole.ADMIN) => ({
  ensureTenantAccess: jest.fn().mockResolvedValue({
    user: { role: { name: RoleName.ADMIN } },
    membershipRole
  })
});

describe("Legacy tenant invitation API hardening", () => {
  it("returns allowlisted GET /tenants/:id/invitations rows without tokens or invitation links", async () => {
    const prisma = createPrismaMock();
    const tenancyService = createTenancyMock();
    const service = new InvitationsService(
      prisma as any,
      tenancyService as any,
      { get: jest.fn() } as unknown as ConfigService
    );

    const rows = await service.listInvitations("admin-1", "tenant-a");

    expect(tenancyService.ensureTenantAccess).toHaveBeenCalledWith("admin-1", "tenant-a");
    expect(prisma.tenantInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a" },
        select: expect.not.objectContaining({ token: true })
      })
    );

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(Object.keys(row).sort()).toEqual([...PUBLIC_TENANT_INVITATION_RESPONSE_FIELDS].sort());
    expect(row.inviteeDisplayName).toBe("Invite User");
    expect(row.invitedByEmail).toBe("admin@example.com");

    for (const field of INVITATIONS_LEGACY_SENSITIVE_FIELDS) {
      assertObjectTreeHasNoSensitiveField(row, field);
    }
  });

  it("blocks invitation list for membership roles without manage permission", async () => {
    const prisma = createPrismaMock();
    const tenancyService = createTenancyMock(TenantMembershipRole.MEMBER);
    const service = new InvitationsService(
      prisma as any,
      tenancyService as any,
      { get: jest.fn() } as unknown as ConfigService
    );

    await expect(service.listInvitations("member-1", "tenant-a")).rejects.toThrow(ForbiddenException);
    expect(prisma.tenantInvitation.findMany).not.toHaveBeenCalled();
  });

  it("preserves POST /tenants/:id/invitations invitationLink for onboarding handoff", async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-a", name: "Tenant A" });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.tenantInvitation.findFirst.mockResolvedValue(null);
    prisma.tenantInvitation.create.mockResolvedValue(sampleInvitationDb);

    const tenancyService = createTenancyMock();
    const configService = { get: jest.fn().mockReturnValue("https://app.example.com") };
    const service = new InvitationsService(prisma as any, tenancyService as any, configService as any);

    const result = await service.createInvitation("admin-1", "tenant-a", {
      email: "invitee@example.com"
    });

    expect(result.invitationLink).toBe("https://app.example.com/register?invitationToken=secret-token-value");
    expect(result.tenantName).toBe("Tenant A");
    expect(result.token).toBe("secret-token-value");
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
