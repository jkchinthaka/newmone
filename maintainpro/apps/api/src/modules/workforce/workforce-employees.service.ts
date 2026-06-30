import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { RoleName, TenantMembershipRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

import {
  isAssignableWorkforceDesignation,
  matchesWorkforceDesignation
} from "../../common/utils/workforce-designation";
import { PrismaService } from "../../database/prisma.service";
import type { CreateWorkforceEmployeeDto, UpdateWorkforceEmployeeDto } from "./dto/workforce-employee.dto";

function designationToRoleName(designation: string): RoleName {
  switch (designation.trim().toUpperCase()) {
    case "MECHANIC":
      return RoleName.MECHANIC;
    case "SUPERVISOR":
      return RoleName.SUPERVISOR;
    case "CLEANER":
      return RoleName.CLEANER;
    case "DRIVER":
      return RoleName.DRIVER;
    default:
      return RoleName.TECHNICIAN;
  }
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "Employee", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

@Injectable()
export class WorkforceEmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextEmployeeNo(tenantId: string | null): Promise<string> {
    const count = await this.prisma.employee.count({
      where: tenantId !== null && tenantId !== undefined ? { tenantId } : {}
    });
    const seq = String(count + 1).padStart(4, "0");
    return `EMP-${seq}`;
  }

  private async assertUniqueEmployeeNo(
    tenantId: string | null,
    employeeNo: string,
    excludeId?: string
  ) {
    const existing = await this.prisma.employee.findFirst({
      where: {
        tenantId: tenantId ?? null,
        employeeNo,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });
    if (existing) {
      throw new BadRequestException(`Employee number "${employeeNo}" is already in use`);
    }
  }

  private async assertUniqueEmail(email: string, excludeLinkedUserId?: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.id !== excludeLinkedUserId) {
      throw new BadRequestException(`Email "${email}" is already registered`);
    }

    const existingEmployee = await this.prisma.employee.findFirst({
      where: {
        email,
        ...(excludeLinkedUserId
          ? {
              OR: [{ linkedUserId: null }, { linkedUserId: { not: excludeLinkedUserId } }]
            }
          : {})
      }
    });
    if (existingEmployee) {
      throw new BadRequestException(`Email "${email}" is already used by another employee`);
    }
  }

  async findAll(
    tenantId: string | null | undefined,
    filters: {
      q?: string;
      designation?: string;
      departmentId?: string;
      branchName?: string;
      active?: boolean;
      pageSize?: number;
    } = {}
  ) {
    const q = filters.q?.trim();
    const take = Math.min(Math.max(filters.pageSize ?? 100, 1), 200);

    const rows = await this.prisma.employee.findMany({
      where: {
        ...(tenantId !== undefined && tenantId !== null ? { tenantId } : {}),
        ...(filters.active !== undefined ? { active: filters.active } : {}),
        ...(filters.departmentId?.trim() ? { departmentId: filters.departmentId.trim() } : {}),
        ...(filters.branchName?.trim()
          ? { branchName: { equals: filters.branchName.trim(), mode: "insensitive" } }
          : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { employeeNo: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        linkedUser: { select: { id: true, email: true, isActive: true, role: { select: { name: true } } } }
      },
      orderBy: [{ active: "desc" }, { fullName: "asc" }],
      take
    });

    if (filters.designation?.trim()) {
      return rows.filter((row) =>
        matchesWorkforceDesignation({ designation: row.designation }, filters.designation)
      );
    }

    return rows;
  }

  async findOne(tenantId: string | null | undefined, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        ...(tenantId !== undefined && tenantId !== null ? { tenantId } : {})
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        linkedUser: { select: { id: true, email: true, isActive: true, role: { select: { name: true } } } }
      }
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    return employee;
  }

  async create(tenantId: string | null, input: CreateWorkforceEmployeeDto) {
    const fullName = input.fullName.trim();
    if (!fullName) {
      throw new BadRequestException("fullName is required");
    }

    const designation = input.designation.trim().toUpperCase();
    if (!isAssignableWorkforceDesignation(designation)) {
      throw new BadRequestException(`Invalid designation "${input.designation}"`);
    }

    const dailyCapacityHours = input.dailyCapacityHours ?? 8;
    if (dailyCapacityHours <= 0) {
      throw new BadRequestException("dailyCapacityHours must be greater than 0");
    }

    const canLogin = Boolean(input.canLogin);
    const email = input.email?.trim().toLowerCase() || null;

    if (canLogin && !email) {
      throw new BadRequestException("email is required when canLogin is true");
    }

    const employeeNo = input.employeeNo?.trim() || (await this.nextEmployeeNo(tenantId));
    await this.assertUniqueEmployeeNo(tenantId, employeeNo);

    if (email) {
      await this.assertUniqueEmail(email);
    }

    if (input.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: input.departmentId, tenantId: tenantId ?? null }
      });
      if (!dept) {
        throw new BadRequestException("Department not found");
      }
    }

    let linkedUserId: string | null = null;

    if (canLogin && email) {
      const roleName = designationToRoleName(designation);
      const role = await this.prisma.role.findFirst({
        where: {
          name: roleName,
          OR: [{ tenantId: tenantId ?? null }, { tenantId: null }]
        },
        orderBy: { tenantId: "desc" }
      });

      if (!role) {
        throw new BadRequestException(`Role ${roleName} is not configured`);
      }

      const { firstName, lastName } = splitFullName(fullName);
      const passwordSeed =
        process.env.MAINTAINPRO_SEED_PASSWORD?.trim() ||
        process.env.MAINTAINPRO_DEFAULT_EMPLOYEE_PASSWORD?.trim() ||
        randomBytes(12).toString("base64url");
      const passwordHash = await bcrypt.hash(passwordSeed, 10);

      const user = await this.prisma.user.create({
        data: {
          tenantId,
          email,
          passwordHash,
          firstName,
          lastName,
          phone: input.phone?.trim() || null,
          roleId: role.id,
          departmentId: input.departmentId || null,
          designation,
          dailyCapacityHours,
          skills: input.skills ?? [],
          isActive: input.active !== false
        }
      });

      if (tenantId) {
        await this.prisma.tenantMembership.create({
          data: {
            tenantId,
            userId: user.id,
            membershipRole:
              roleName === RoleName.ADMIN || roleName === RoleName.SUPER_ADMIN
                ? TenantMembershipRole.ADMIN
                : TenantMembershipRole.MEMBER
          }
        });
      }

      linkedUserId = user.id;
    }

    return this.prisma.employee.create({
      data: {
        tenantId,
        employeeNo,
        fullName,
        phone: input.phone?.trim() || null,
        email,
        branchName: input.branchName?.trim() || null,
        departmentId: input.departmentId || null,
        designation,
        skills: input.skills ?? [],
        dailyCapacityHours,
        active: input.active !== false,
        canLogin,
        linkedUserId
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        linkedUser: { select: { id: true, email: true, isActive: true, role: { select: { name: true } } } }
      }
    });
  }

  async update(tenantId: string | null, id: string, input: UpdateWorkforceEmployeeDto) {
    const existing = await this.findOne(tenantId, id);

    const data: Record<string, unknown> = {};

    if (input.fullName !== undefined) {
      const fullName = input.fullName.trim();
      if (!fullName) {
        throw new BadRequestException("fullName is required");
      }
      data.fullName = fullName;
    }

    if (input.designation !== undefined) {
      const designation = input.designation.trim().toUpperCase();
      if (!isAssignableWorkforceDesignation(designation)) {
        throw new BadRequestException(`Invalid designation "${input.designation}"`);
      }
      data.designation = designation;
    }

    if (input.dailyCapacityHours !== undefined) {
      if (input.dailyCapacityHours <= 0) {
        throw new BadRequestException("dailyCapacityHours must be greater than 0");
      }
      data.dailyCapacityHours = input.dailyCapacityHours;
    }

    if (input.employeeNo !== undefined) {
      const employeeNo = input.employeeNo.trim();
      if (employeeNo) {
        await this.assertUniqueEmployeeNo(tenantId, employeeNo, id);
        data.employeeNo = employeeNo;
      }
    }

    if (input.phone !== undefined) data.phone = input.phone.trim() || null;
    if (input.branchName !== undefined) data.branchName = input.branchName.trim() || null;
    if (input.departmentId !== undefined) data.departmentId = input.departmentId || null;
    if (input.skills !== undefined) data.skills = input.skills;
    if (input.active !== undefined) data.active = input.active;

    const nextCanLogin = input.canLogin !== undefined ? input.canLogin : existing.canLogin;
    const nextEmail = input.email !== undefined ? input.email?.trim().toLowerCase() || null : existing.email;

    if (nextCanLogin && !nextEmail) {
      throw new BadRequestException("email is required when canLogin is true");
    }

    if (input.email !== undefined && nextEmail) {
      await this.assertUniqueEmail(nextEmail, existing.linkedUserId ?? undefined);
      data.email = nextEmail;
    }

    if (input.canLogin !== undefined) {
      data.canLogin = input.canLogin;
    }

    if (nextCanLogin && nextEmail && !existing.linkedUserId) {
      const designation = (data.designation as string | undefined) ?? existing.designation;
      const fullName = (data.fullName as string | undefined) ?? existing.fullName;
      const roleName = designationToRoleName(designation);
      const role = await this.prisma.role.findFirst({
        where: {
          name: roleName,
          OR: [{ tenantId: tenantId ?? null }, { tenantId: null }]
        },
        orderBy: { tenantId: "desc" }
      });
      if (!role) {
        throw new BadRequestException(`Role ${roleName} is not configured`);
      }

      const { firstName, lastName } = splitFullName(fullName);
      const passwordSeed =
        process.env.MAINTAINPRO_SEED_PASSWORD?.trim() ||
        process.env.MAINTAINPRO_DEFAULT_EMPLOYEE_PASSWORD?.trim() ||
        randomBytes(12).toString("base64url");
      const passwordHash = await bcrypt.hash(passwordSeed, 10);

      const user = await this.prisma.user.create({
        data: {
          tenantId,
          email: nextEmail,
          passwordHash,
          firstName,
          lastName,
          phone: (data.phone as string | null | undefined) ?? existing.phone,
          roleId: role.id,
          departmentId: (data.departmentId as string | null | undefined) ?? existing.departmentId,
          designation,
          dailyCapacityHours:
            (data.dailyCapacityHours as number | undefined) ?? existing.dailyCapacityHours,
          skills: (data.skills as string[] | undefined) ?? existing.skills,
          isActive: (data.active as boolean | undefined) ?? existing.active
        }
      });

      if (tenantId) {
        await this.prisma.tenantMembership.create({
          data: { tenantId, userId: user.id, membershipRole: TenantMembershipRole.MEMBER }
        });
      }

      data.linkedUserId = user.id;
    }

    if (existing.linkedUserId) {
      const userPatch: Record<string, unknown> = {};
      if (input.active !== undefined) userPatch.isActive = input.active;
      if (input.email !== undefined && nextEmail) userPatch.email = nextEmail;
      if (input.phone !== undefined) userPatch.phone = input.phone.trim() || null;
      if (input.designation !== undefined) userPatch.designation = data.designation;
      if (input.dailyCapacityHours !== undefined) userPatch.dailyCapacityHours = data.dailyCapacityHours;
      if (input.skills !== undefined) userPatch.skills = data.skills;
      if (input.fullName !== undefined) {
        const { firstName, lastName } = splitFullName(input.fullName.trim());
        userPatch.firstName = firstName;
        userPatch.lastName = lastName;
      }

      if (Object.keys(userPatch).length > 0) {
        await this.prisma.user.update({
          where: { id: existing.linkedUserId },
          data: userPatch
        });
      }
    }

    return this.prisma.employee.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, name: true, code: true } },
        linkedUser: { select: { id: true, email: true, isActive: true, role: { select: { name: true } } } }
      }
    });
  }

  /**
   * Resolve workforce employee by Employee id, with legacy fallback when assignee rows still store User ids.
   */
  async resolveAssignableEmployee(employeeId: string, tenantId?: string | null) {
    const scopedWhere =
      tenantId !== undefined && tenantId !== null ? { tenantId } : {};

    const direct = await this.prisma.employee.findFirst({
      where: { id: employeeId, active: true, ...scopedWhere },
      include: {
        linkedUser: { select: { id: true, role: { select: { name: true } } } },
        department: { select: { id: true, name: true, code: true } }
      }
    });

    if (direct) {
      return direct;
    }

    const linked = await this.prisma.employee.findFirst({
      where: { linkedUserId: employeeId, active: true, ...scopedWhere },
      include: {
        linkedUser: { select: { id: true, role: { select: { name: true } } } },
        department: { select: { id: true, name: true, code: true } }
      }
    });

    if (linked) {
      return linked;
    }

    return null;
  }
}
