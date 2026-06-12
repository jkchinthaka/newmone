import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { RoleName, TenantInvitationStatus, TenantMembershipRole } from "@prisma/client";

import { AuthService } from "../src/modules/auth/auth.service";

const TECHNICIAN_ROLE = { id: "role-technician", name: RoleName.TECHNICIAN, permissions: [] };
const ADMIN_ROLE = { id: "role-admin", name: RoleName.ADMIN, permissions: [] };

const baseDto = {
  email: "new-user@example.com",
  firstName: "New",
  lastName: "User",
  password: "Password1!"
};

const buildPrisma = () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn()
  },
  role: {
    findFirst: jest.fn()
  },
  tenantInvitation: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  tenantMembership: {
    create: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  },
  refreshToken: {
    create: jest.fn()
  }
});

const buildJwtService = () => ({
  signAsync: jest.fn().mockResolvedValue("signed-token"),
  verifyAsync: jest.fn(),
  decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 }))
});

const buildConfigService = (
  allowPublicRegistration: boolean,
  nodeEnv = "test",
  allowPublicRegistrationInProduction = false
) => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === "ALLOW_PUBLIC_REGISTRATION") return allowPublicRegistration;
    if (key === "NODE_ENV") return nodeEnv;
    if (key === "ALLOW_PUBLIC_REGISTRATION_IN_PRODUCTION") return allowPublicRegistrationInProduction;
    if (key === "JWT_ACCESS_SECRET" || key === "JWT_REFRESH_SECRET" || key === "JWT_SECRET") {
      return "test-secret";
    }
    return fallback;
  })
});

const buildService = (
  allowPublicRegistration: boolean,
  prisma: ReturnType<typeof buildPrisma>,
  options?: { nodeEnv?: string; allowPublicRegistrationInProduction?: boolean }
) =>
  new AuthService(
    prisma as any,
    buildJwtService() as any,
    buildConfigService(
      allowPublicRegistration,
      options?.nodeEnv ?? "test",
      options?.allowPublicRegistrationInProduction ?? false
    ) as any,
    { dispatch: jest.fn() } as any
  );

describe("AuthService.register", () => {
  it("rejects self-registration with no invitation when ALLOW_PUBLIC_REGISTRATION is false", async () => {
    const prisma = buildPrisma();
    const service = buildService(false, prisma);

    await expect(service.register({ ...baseDto })).rejects.toThrow(ForbiddenException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("allows self-registration as TECHNICIAN when ALLOW_PUBLIC_REGISTRATION is true", async () => {
    const prisma = buildPrisma();
    prisma.role.findFirst.mockResolvedValue(TECHNICIAN_ROLE);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: baseDto.email,
      passwordHash: "hash",
      tenantId: null,
      role: TECHNICIAN_ROLE
    });

    const service = buildService(true, prisma);

    const result = await service.register({ ...baseDto });

    expect(prisma.role.findFirst).toHaveBeenCalledWith({ where: { name: RoleName.TECHNICIAN } });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: TECHNICIAN_ROLE.id, tenantId: undefined })
      })
    );
    expect(result.data.user).not.toHaveProperty("passwordHash");
    expect(result.message).toBe("Registration successful");
  });

  it("rejects public self-registration in production unless explicitly allowed", async () => {
    const prisma = buildPrisma();
    const service = buildService(true, prisma, { nodeEnv: "production" });

    await expect(service.register({ ...baseDto })).rejects.toThrow(ForbiddenException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("allows public self-registration in production only with explicit override", async () => {
    const prisma = buildPrisma();
    prisma.role.findFirst.mockResolvedValue(TECHNICIAN_ROLE);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: baseDto.email,
      passwordHash: "hash",
      tenantId: null,
      role: TECHNICIAN_ROLE
    });
    const service = buildService(true, prisma, {
      nodeEnv: "production",
      allowPublicRegistrationInProduction: true
    });

    const result = await service.register({ ...baseDto });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.message).toBe("Registration successful");
  });

  it("rejects an unknown invitation token", async () => {
    const prisma = buildPrisma();
    prisma.tenantInvitation.findUnique.mockResolvedValue(null);

    const service = buildService(false, prisma);

    await expect(service.register({ ...baseDto, invitationToken: "bad-token" })).rejects.toThrow(
      BadRequestException
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects an invitation whose email does not match", async () => {
    const prisma = buildPrisma();
    prisma.tenantInvitation.findUnique.mockResolvedValue({
      id: "invite-1",
      tenantId: "tenant-a",
      email: "someone-else@example.com",
      status: TenantInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      membershipRole: TenantMembershipRole.MEMBER
    });

    const service = buildService(false, prisma);

    await expect(service.register({ ...baseDto, invitationToken: "token-1" })).rejects.toThrow(
      BadRequestException
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects an expired invitation", async () => {
    const prisma = buildPrisma();
    prisma.tenantInvitation.findUnique.mockResolvedValue({
      id: "invite-1",
      tenantId: "tenant-a",
      email: baseDto.email,
      status: TenantInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() - 60_000),
      membershipRole: TenantMembershipRole.MEMBER
    });

    const service = buildService(false, prisma);

    await expect(service.register({ ...baseDto, invitationToken: "token-1" })).rejects.toThrow(
      BadRequestException
    );
  });

  it("accepts a valid invitation, attaches the tenant, and marks it ACCEPTED", async () => {
    const prisma = buildPrisma();
    prisma.tenantInvitation.findUnique.mockResolvedValue({
      id: "invite-1",
      tenantId: "tenant-a",
      email: baseDto.email,
      status: TenantInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      membershipRole: TenantMembershipRole.ADMIN
    });
    prisma.role.findFirst.mockResolvedValue(ADMIN_ROLE);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: baseDto.email,
      passwordHash: "hash",
      tenantId: "tenant-a",
      role: ADMIN_ROLE
    });

    const service = buildService(false, prisma);

    const result = await service.register({ ...baseDto, invitationToken: "token-1" });

    expect(prisma.role.findFirst).toHaveBeenCalledWith({ where: { name: RoleName.ADMIN } });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: ADMIN_ROLE.id, tenantId: "tenant-a" })
      })
    );
    expect(prisma.tenantMembership.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-a", userId: "user-1", membershipRole: TenantMembershipRole.ADMIN }
    });
    expect(prisma.tenantInvitation.update).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: { status: TenantInvitationStatus.ACCEPTED, acceptedAt: expect.any(Date) }
    });
    expect(result.data.user).toHaveProperty("tenantId", "tenant-a");
  });

  it("rejects when the email is already in use", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

    const service = buildService(true, prisma);

    await expect(service.register({ ...baseDto })).rejects.toThrow(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("throws if the default role is missing (seed not run)", async () => {
    const prisma = buildPrisma();
    prisma.role.findFirst.mockResolvedValue(null);

    const service = buildService(true, prisma);

    await expect(service.register({ ...baseDto })).rejects.toThrow(NotFoundException);
  });
});
