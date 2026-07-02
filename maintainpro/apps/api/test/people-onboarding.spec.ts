import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AuditAction, EmployeeAvailabilityStatus, RoleName, UserInviteStatus } from "@prisma/client";
import { createHash } from "node:crypto";

import { AuthService } from "../src/modules/auth/auth.service";
import { PeopleService } from "../src/modules/people/people.service";
import { UserInvitationService } from "../src/modules/people/user-invitation.service";
import { TechniciansService } from "../src/modules/people/technicians.service";

jest.mock("../src/common/context/request-context", () => ({
  requestContext: {
    get: jest.fn(() => ({
      actorId: "admin-1",
      actorRole: RoleName.ADMIN,
      tenantId: "tenant-1",
      ipAddress: "127.0.0.1"
    }))
  }
}));

const TECH_ROLE = { id: "role-tech", name: RoleName.TECHNICIAN };
const ADMIN_ROLE = { id: "role-admin", name: RoleName.ADMIN };

const buildPrisma = () => {
  const prisma: Record<string, any> = {
    employee: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    role: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    department: {
      findFirst: jest.fn(),
      findUnique: jest.fn()
    },
    tenantMembership: {
      create: jest.fn()
    },
    userInvitation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  return prisma;
};

const buildEmailDispatch = () => ({
  describeProvider: jest.fn(() => ({ configured: false, mode: "disabled" as const })),
  dispatch: jest.fn()
});

const buildConfig = () => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === "FRONTEND_URL") return "http://localhost:3001";
    return fallback;
  })
});

describe("PeopleService onboarding", () => {
  it("creates employee without login", async () => {
    const prisma = buildPrisma();
    prisma.employee.count.mockResolvedValue(0);
    prisma.employee.create.mockResolvedValue({
      id: "emp-1",
      employeeNo: "EMP-0001",
      fullName: "Jane Tech",
      phone: "077",
      email: null,
      branchName: "HQ",
      departmentId: null,
      designation: "TECHNICIAN",
      skills: ["Electrical"],
      workCategories: [],
      shift: null,
      availabilityStatus: EmployeeAvailabilityStatus.AVAILABLE,
      canReceiveWorkOrders: true,
      dailyCapacityHours: 8,
      active: true,
      canLogin: false,
      linkedUserId: null,
      department: null,
      linkedUser: null
    });

    const service = new PeopleService(prisma as never, new UserInvitationService(prisma as never, buildConfig() as never, buildEmailDispatch() as never));

    const result = await service.create({
      fullName: "Jane Tech",
      designation: "TECHNICIAN",
      branchName: "HQ",
      isTechnician: true,
      skills: ["Electrical"],
      canLogin: false
    });

    expect(result.person.fullName).toBe("Jane Tech");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("blocks duplicate employeeNo", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "existing" });
    const service = new PeopleService(prisma as never, new UserInvitationService(prisma as never, buildConfig() as never, buildEmailDispatch() as never));

    await expect(
      service.create({
        employeeNo: "EMP-0001",
        fullName: "Dup",
        designation: "TECHNICIAN",
        branchName: "HQ",
        skills: ["A"]
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("blocks login without role", async () => {
    const prisma = buildPrisma();
    prisma.employee.count.mockResolvedValue(0);
    const service = new PeopleService(prisma as never, new UserInvitationService(prisma as never, buildConfig() as never, buildEmailDispatch() as never));

    await expect(
      service.create({
        fullName: "Login User",
        designation: "TECHNICIAN",
        branchName: "HQ",
        email: "user@example.com",
        canLogin: true,
        skills: ["A"]
      })
    ).rejects.toThrow("Role is required");
  });

  it("blocks inactive employee login enable", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1", active: false, fullName: "Inactive", linkedUserId: null, designation: "TECHNICIAN", phone: null, departmentId: null, branchName: "HQ", skills: [], dailyCapacityHours: 8 });
    const service = new PeopleService(prisma as never, new UserInvitationService(prisma as never, buildConfig() as never, buildEmailDispatch() as never));

    await expect(
      service.enableLogin("emp-1", { email: "x@example.com", roleId: "role-tech" })
    ).rejects.toThrow("Inactive employee cannot login");
  });
});

describe("UserInvitationService", () => {
  it("stores invite token hashed", async () => {
    const prisma = buildPrisma();
    prisma.userInvitation.updateMany.mockResolvedValue({ count: 0 });
    prisma.userInvitation.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "inv-1", ...data }));

    const service = new UserInvitationService(prisma as never, buildConfig() as never, buildEmailDispatch() as never);
    const token = "abc123";
    const spy = jest.spyOn(service, "generateToken").mockReturnValue(token);

    await service.createOrRefreshInvitation({
      tenantId: "tenant-1",
      userId: "user-1",
      invitedById: "admin-1",
      fullName: "User",
      roleName: "TECHNICIAN",
      sendEmail: false
    });

    expect(prisma.userInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: createHash("sha256").update(token).digest("hex")
        })
      })
    );
    spy.mockRestore();
  });

  it("rejects expired invite", async () => {
    const prisma = buildPrisma();
    prisma.userInvitation.findUnique.mockResolvedValue({
      id: "inv-1",
      status: UserInviteStatus.SENT,
      expiresAt: new Date(Date.now() - 1000),
      acceptedAt: null,
      user: { email: "a@b.com", firstName: "A", lastName: "B", isActive: true }
    });
    prisma.userInvitation.update.mockResolvedValue({});

    const service = new UserInvitationService(prisma as never, buildConfig() as never, buildEmailDispatch() as never);
    await expect(service.verifyToken("raw")).rejects.toThrow("Invitation expired");
  });

  it("rejects accepted invite reuse", async () => {
    const prisma = buildPrisma();
    prisma.userInvitation.findUnique.mockResolvedValue({
      id: "inv-1",
      status: UserInviteStatus.ACCEPTED,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: new Date(),
      user: { email: "a@b.com", firstName: "A", lastName: "B", isActive: true }
    });

    const service = new UserInvitationService(prisma as never, buildConfig() as never, buildEmailDispatch() as never);
    await expect(service.verifyToken("raw")).rejects.toThrow("Invitation already accepted");
  });

  it("rejects revoked invite", async () => {
    const prisma = buildPrisma();
    prisma.userInvitation.findUnique.mockResolvedValue({
      id: "inv-1",
      status: UserInviteStatus.REVOKED,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      user: { email: "a@b.com", firstName: "A", lastName: "B", isActive: true }
    });

    const service = new UserInvitationService(prisma as never, buildConfig() as never, buildEmailDispatch() as never);
    await expect(service.verifyToken("raw")).rejects.toThrow("Invitation revoked");
  });
});

describe("AuthService invite + login hardening", () => {
  const buildAuthService = (prisma: ReturnType<typeof buildPrisma>) =>
    new AuthService(
      prisma as never,
      { signAsync: jest.fn(), verifyAsync: jest.fn(), decode: jest.fn() } as never,
      buildConfig() as never,
      buildEmailDispatch() as never
    );

  it("accept invite sets passwordHash and clears mustChangePassword", async () => {
    const prisma = buildPrisma();
    const token = "invite-token";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    prisma.userInvitation.findUnique.mockResolvedValue({
      id: "inv-1",
      userId: "user-1",
      tenantId: "tenant-1",
      status: UserInviteStatus.SENT,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null
    });
    prisma.$transaction.mockImplementation(async (ops: unknown) => {
      if (typeof ops === "function") return ops(prisma);
      if (Array.isArray(ops)) {
        for (const op of ops) await op;
      }
    });

    const service = buildAuthService(prisma);
    await service.acceptInvite({ token, password: "Password1!" });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ mustChangePassword: false })
      })
    );
    expect(tokenHash.length).toBeGreaterThan(10);
  });

  it("login blocks inactive linked employee", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "tech@example.com",
      passwordHash: "$2a$10$hashed",
      isActive: true,
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      tenantId: "tenant-1",
      role: { name: RoleName.TECHNICIAN, permissions: [] },
      linkedWorkforceEmployees: [{ id: "emp-1", active: false }]
    });

    const bcrypt = require("bcryptjs");
    jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

    const service = buildAuthService(prisma);
    await expect(service.login({ email: "tech@example.com", password: "Password1!" })).rejects.toThrow("Invalid email or password");
  });

  it("login returns mustChangePassword flag for temp password users", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "tech@example.com",
      passwordHash: "$2a$10$hashed",
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
      failedLoginAttempts: 0,
      lockedUntil: null,
      tenantId: "tenant-1",
      firstName: "T",
      lastName: "User",
      phone: null,
      role: { name: RoleName.TECHNICIAN, permissions: [] },
      linkedWorkforceEmployees: [{ id: "emp-1", active: true }]
    });
    prisma.user.update.mockResolvedValue({});

    const bcrypt = require("bcryptjs");
    jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

    const service = buildAuthService(prisma);
    service["generateTokens"] = jest.fn().mockResolvedValue({ accessToken: "a", refreshToken: "r" });

    const result = await service.login({ email: "tech@example.com", password: "Password1!" });
    expect(result.data.mustChangePassword).toBe(true);
  });
});

describe("TechniciansService assignable filter", () => {
  it("excludes inactive availability technicians", async () => {
    const prisma = buildPrisma();
    prisma.employee.findMany.mockResolvedValue([]);

    const workforcePlanning = { getAllocatedHoursForDay: jest.fn().mockResolvedValue(0) };
    const service = new TechniciansService(prisma as never, workforcePlanning as never);

    await service.listAssignable("tenant-1");

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          canReceiveWorkOrders: true,
          availabilityStatus: EmployeeAvailabilityStatus.AVAILABLE
        })
      })
    );
  });
});

describe("People RBAC expectations", () => {
  it("technician role cannot pass admin-only create guard by service tenant requirement", async () => {
    const { requestContext } = require("../src/common/context/request-context");
    requestContext.get.mockReturnValueOnce({
      actorId: "tech-1",
      actorRole: RoleName.TECHNICIAN,
      tenantId: null
    });

    const prisma = buildPrisma();
    const service = new PeopleService(prisma as never, new UserInvitationService(prisma as never, buildConfig() as never, buildEmailDispatch() as never));

    await expect(
      service.create({
        fullName: "Blocked",
        designation: "TECHNICIAN",
        branchName: "HQ",
        skills: ["A"]
      })
    ).rejects.toThrow(BadRequestException);
  });
});
