import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  EmployeeAvailabilityStatus,
  RoleName,
  TenantMembershipRole,
  UserInviteStatus
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

import { requestContext } from "../../common/context/request-context";
import { createPaginationMeta } from "../../common/utils/pagination-meta";
import { clampPage, clampPageSize } from "../../common/utils/pagination.util";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { isAssignableWorkforceDesignation } from "../../common/utils/workforce-designation";
import { PrismaService } from "../../database/prisma.service";
import {
  CreatePersonDto,
  EnableLoginDto,
  InviteMethod,
  PeopleListQueryDto,
  UpdatePersonDto,
  UpdateTechnicianProfileDto
} from "./dto/people.dto";
import { UserInvitationService } from "./user-invitation.service";

const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Employee", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function parseAvailability(value?: string): EmployeeAvailabilityStatus {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "ON_LEAVE") return EmployeeAvailabilityStatus.ON_LEAVE;
  if (normalized === "INACTIVE") return EmployeeAvailabilityStatus.INACTIVE;
  return EmployeeAvailabilityStatus.AVAILABLE;
}

@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userInvitation: UserInvitationService
  ) {}

  private actorId(): string {
    const ctx = requestContext.get();
    if (!ctx?.actorId) throw new ForbiddenException("You do not have permission to perform this action");
    return ctx.actorId;
  }

  private tenantScope(): { tenantId: string | null; isSuperAdmin: boolean } {
    const ctx = requestContext.get();
    const tenantId = ctx?.tenantId ?? null;
    const isSuperAdmin = ctx?.actorRole === RoleName.SUPER_ADMIN;
    return { tenantId, isSuperAdmin };
  }

  private requiredTenantId(): string | null {
    const { tenantId, isSuperAdmin } = this.tenantScope();
    if (!isSuperAdmin && !tenantId) {
      throw new BadRequestException("Tenant context is required");
    }
    return tenantId;
  }

  private async assertUniqueEmployeeNo(tenantId: string | null, employeeNo: string, excludeId?: string) {
    const existing = await this.prisma.employee.findFirst({
      where: {
        tenantId: tenantId ?? null,
        employeeNo,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });
    if (existing) throw new BadRequestException("Employee number already exists");
  }

  private async assertUniqueEmail(email: string, excludeUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.id !== excludeUserId) throw new BadRequestException("Email already exists");
    const employee = await this.prisma.employee.findFirst({
      where: {
        email,
        ...(excludeUserId ? { OR: [{ linkedUserId: null }, { linkedUserId: { not: excludeUserId } }] } : {})
      }
    });
    if (employee) throw new BadRequestException("Email already exists");
  }

  private async nextEmployeeNo(tenantId: string | null): Promise<string> {
    const count = await this.prisma.employee.count({
      where: tenantId ? { tenantId } : {}
    });
    return `EMP-${String(count + 1).padStart(4, "0")}`;
  }

  private employeeInclude() {
    return {
      department: { select: { id: true, name: true, code: true } },
      linkedUser: {
        select: {
          id: true,
          email: true,
          isActive: true,
          mustChangePassword: true,
          branchScope: true,
          role: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } }
        }
      }
    } as const;
  }

  private async latestInviteStatus(userId: string | null | undefined): Promise<UserInviteStatus | null> {
    if (!userId) return null;
    const invite = await this.prisma.userInvitation.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { status: true }
    });
    return invite?.status ?? null;
  }

  private mapPersonRow(
    employee: Awaited<ReturnType<typeof this.prisma.employee.findFirst>> & {
      department?: { id: string; name: string; code: string } | null;
      linkedUser?: {
        id: string;
        email: string;
        isActive: boolean;
        mustChangePassword: boolean;
        branchScope: string | null;
        role: { id: string; name: RoleName };
        department?: { id: string; name: string } | null;
      } | null;
    },
    inviteStatus: UserInviteStatus | null
  ) {
    return {
      id: employee!.id,
      employeeNo: employee!.employeeNo,
      fullName: employee!.fullName,
      phone: employee!.phone,
      email: employee!.email,
      branchName: employee!.branchName,
      departmentId: employee!.departmentId,
      designation: employee!.designation,
      skills: employee!.skills,
      workCategories: employee!.workCategories ?? [],
      shift: employee!.shift,
      availabilityStatus: employee!.availabilityStatus,
      canReceiveWorkOrders: employee!.canReceiveWorkOrders,
      dailyCapacityHours: employee!.dailyCapacityHours,
      active: employee!.active,
      canLogin: employee!.canLogin,
      linkedUserId: employee!.linkedUserId,
      department: employee!.department ?? null,
      loginStatus: employee!.linkedUserId
        ? employee!.linkedUser?.isActive
          ? "ACTIVE"
          : "DISABLED"
        : "NO_LOGIN",
      role: employee!.linkedUser?.role ?? null,
      branchScope: employee!.linkedUser?.branchScope ?? null,
      inviteStatus: inviteStatus ?? (employee!.canLogin ? UserInviteStatus.NOT_SENT : null),
      linkedUser: employee!.linkedUser
        ? {
            id: employee!.linkedUser.id,
            email: employee!.linkedUser.email,
            isActive: employee!.linkedUser.isActive,
            mustChangePassword: employee!.linkedUser.mustChangePassword,
            role: employee!.linkedUser.role
          }
        : null
    };
  }

  async findAll(query: PeopleListQueryDto) {
    const tenantId = this.requiredTenantId();
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const skip = (page - 1) * pageSize;
    const search = query.search?.trim();
    const technicianOnly = query.technicianOnly === "true" || query.technicianOnly === "1";

    const where: Record<string, unknown> = {
      ...(tenantId ? { tenantId } : {}),
      ...(query.departmentId?.trim() ? { departmentId: query.departmentId.trim() } : {}),
      ...(query.branchName?.trim() || query.branchId?.trim()
        ? { branchName: { equals: (query.branchName ?? query.branchId)!.trim(), mode: "insensitive" } }
        : {}),
      ...(query.status === "active" ? { active: true } : {}),
      ...(query.status === "inactive" ? { active: false } : {}),
      ...(technicianOnly
        ? {
            OR: [
              { designation: { contains: "TECHNICIAN", mode: "insensitive" } },
              { designation: { contains: "MECHANIC", mode: "insensitive" } },
              { canReceiveWorkOrders: true }
            ]
          }
        : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { employeeNo: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    let items = await this.prisma.employee.findMany({
      where,
      include: this.employeeInclude(),
      orderBy: [{ active: "desc" }, { fullName: "asc" }],
      skip,
      take: pageSize
    });

    if (query.roleId?.trim()) {
      items = items.filter((row) => row.linkedUser?.role.id === query.roleId!.trim());
    }

    if (query.loginStatus === "active") {
      items = items.filter((row) => row.linkedUser?.isActive === true);
    } else if (query.loginStatus === "disabled") {
      items = items.filter((row) => row.linkedUser && row.linkedUser.isActive === false);
    } else if (query.loginStatus === "none") {
      items = items.filter((row) => !row.linkedUserId);
    }

    const inviteStatuses = await Promise.all(
      items.map((row) => this.latestInviteStatus(row.linkedUserId))
    );

    let mapped = items.map((row, index) => this.mapPersonRow(row, inviteStatuses[index]));

    if (query.inviteStatus?.trim()) {
      mapped = mapped.filter((row) => row.inviteStatus === query.inviteStatus!.trim().toUpperCase());
    }

    const total = await this.prisma.employee.count({ where });

    return {
      items: mapped,
      meta: createPaginationMeta(page, pageSize, total)
    };
  }

  async findOne(id: string) {
    const tenantId = this.requiredTenantId();
    const employee = await this.prisma.employee.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      include: this.employeeInclude()
    });
    if (!employee) throw new NotFoundException("Person not found");
    const inviteStatus = await this.latestInviteStatus(employee.linkedUserId);
    return this.mapPersonRow(employee, inviteStatus);
  }

  async create(dto: CreatePersonDto) {
    const tenantId = this.requiredTenantId();
    const actorId = this.actorId();
    const fullName = dto.fullName.trim();
    if (!fullName) throw new BadRequestException("Full name is required");

    const designation = dto.designation.trim().toUpperCase();
    if (!isAssignableWorkforceDesignation(designation)) {
      throw new BadRequestException(`Invalid designation "${dto.designation}"`);
    }

    const active = dto.active !== false;
    const canLogin = Boolean(dto.canLogin);
    const email = dto.email?.trim().toLowerCase() || null;

    if (canLogin && !email) throw new BadRequestException("Email is required when login access is enabled");
    if (canLogin && !dto.roleId?.trim()) throw new BadRequestException("Role is required when login access is enabled");
    if (!active && canLogin) throw new BadRequestException("Inactive employee cannot have login access");

    const employeeNo = dto.employeeNo?.trim() || (await this.nextEmployeeNo(tenantId));
    await this.assertUniqueEmployeeNo(tenantId, employeeNo);
    if (email) await this.assertUniqueEmail(email);

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, ...(tenantId ? { tenantId } : {}) }
      });
      if (!dept) throw new BadRequestException("Department not found");
    }

    if (!dto.branchName?.trim() && canLogin) {
      throw new BadRequestException("Branch is required");
    }

    const isTechnician = dto.isTechnician === true || designation.includes("TECHNICIAN") || designation.includes("MECHANIC");
    if (isTechnician && (!dto.skills || dto.skills.length === 0)) {
      throw new BadRequestException("Technician selected but skills missing");
    }

    let linkedUserId: string | null = null;
    let temporaryPassword: string | null = null;
    let inviteLink: string | null = null;

    const employee = await this.prisma.$transaction(async (tx) => {
      let userId: string | null = null;

      if (canLogin && email && dto.roleId) {
        const role = await tx.role.findUnique({ where: { id: dto.roleId.trim() } });
        if (!role) throw new BadRequestException("Role not found");
        if (role.name === RoleName.SUPER_ADMIN && requestContext.get()?.actorRole !== RoleName.SUPER_ADMIN) {
          throw new ForbiddenException("You do not have permission to perform this action");
        }

        const { firstName, lastName } = splitFullName(fullName);
        const inviteMethod = dto.inviteMethod ?? InviteMethod.INVITE_EMAIL;
        let passwordHash: string;
        let mustChangePassword = false;
        let temporaryPasswordExpiresAt: Date | null = null;

        if (inviteMethod === InviteMethod.TEMP_PASSWORD) {
          temporaryPassword = randomBytes(9).toString("base64url");
          passwordHash = await bcrypt.hash(temporaryPassword, 10);
          mustChangePassword = true;
          temporaryPasswordExpiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
        } else {
          const placeholder = randomBytes(24).toString("hex");
          passwordHash = await bcrypt.hash(placeholder, 10);
          mustChangePassword = true;
        }

        const user = await tx.user.create({
          data: {
            tenantId,
            email,
            passwordHash,
            firstName,
            lastName,
            phone: dto.phone?.trim() || null,
            roleId: role.id,
            departmentId: dto.departmentId || null,
            designation,
            skills: dto.skills ?? [],
            dailyCapacityHours: dto.dailyCapacityHours ?? 8,
            branchScope: dto.branchScope?.trim() || dto.branchName?.trim() || null,
            mustChangePassword,
            temporaryPasswordExpiresAt,
            isActive: active
          }
        });

        if (tenantId) {
          await tx.tenantMembership.create({
            data: {
              tenantId,
              userId: user.id,
              membershipRole:
                role.name === RoleName.ADMIN || role.name === RoleName.SUPER_ADMIN
                  ? TenantMembershipRole.ADMIN
                  : TenantMembershipRole.MEMBER
            }
          });
        }

        userId = user.id;
        linkedUserId = user.id;

        await writeAuditTrail(this.prisma, {
          entity: "User",
          entityId: user.id,
          action: AuditAction.CREATE,
          module: "people",
          metadata: { event: "user_created", roleId: role.id, roleName: role.name }
        });
      }

      const created = await tx.employee.create({
        data: {
          tenantId,
          employeeNo,
          fullName,
          phone: dto.phone?.trim() || null,
          email,
          branchName: dto.branchName?.trim() || null,
          departmentId: dto.departmentId || null,
          designation,
          skills: dto.skills ?? [],
          workCategories: dto.workCategories ?? [],
          shift: dto.shift?.trim() || null,
          availabilityStatus: parseAvailability(dto.availabilityStatus),
          canReceiveWorkOrders: dto.canReceiveWorkOrders ?? isTechnician,
          dailyCapacityHours: dto.dailyCapacityHours ?? 8,
          active,
          canLogin,
          linkedUserId: userId
        },
        include: this.employeeInclude()
      });

      await writeAuditTrail(this.prisma, {
        entity: "Employee",
        entityId: created.id,
        action: AuditAction.CREATE,
        module: "people",
        metadata: {
          event: isTechnician ? "technician_profile_created" : "employee_created",
          canLogin,
          designation
        }
      });

      return created;
    });

    if (linkedUserId && dto.canLogin) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId!.trim() } });
      const dept = dto.departmentId
        ? await this.prisma.department.findUnique({ where: { id: dto.departmentId }, select: { name: true } })
        : null;

      if (dto.inviteMethod === InviteMethod.TEMP_PASSWORD && temporaryPassword) {
        await writeAuditTrail(this.prisma, {
          entity: "User",
          entityId: linkedUserId,
          action: AuditAction.UPDATE,
          module: "people",
          metadata: { event: "temporary_password_generated" }
        });
      } else {
        const invite = await this.userInvitation.createOrRefreshInvitation({
          tenantId,
          userId: linkedUserId,
          invitedById: actorId,
          fullName,
          roleName: role?.name ?? "User",
          branchName: dto.branchName,
          departmentName: dept?.name ?? null,
          sendEmail: dto.inviteMethod !== InviteMethod.COPY_LINK
        });
        inviteLink = invite.inviteLink;
        await writeAuditTrail(this.prisma, {
          entity: "UserInvitation",
          entityId: linkedUserId,
          action: AuditAction.CREATE,
          module: "people",
          metadata: { event: "invitation_sent", emailSent: invite.emailSent }
        });
      }
    }

    const inviteStatus = await this.latestInviteStatus(linkedUserId);
    const result = this.mapPersonRow(employee, inviteStatus);

    return {
      person: result,
      ...(temporaryPassword ? { temporaryPassword } : {}),
      ...(inviteLink ? { inviteLink } : {}),
      emailProviderConfigured: this.userInvitation.isEmailConfigured()
    };
  }

  async update(id: string, dto: UpdatePersonDto) {
    const tenantId = this.requiredTenantId();
    const existing = await this.prisma.employee.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) }
    });
    if (!existing) throw new NotFoundException("Person not found");

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.branchName !== undefined) data.branchName = dto.branchName.trim() || null;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId || null;
    if (dto.designation !== undefined) {
      const designation = dto.designation.trim().toUpperCase();
      if (!isAssignableWorkforceDesignation(designation)) {
        throw new BadRequestException(`Invalid designation "${dto.designation}"`);
      }
      data.designation = designation;
    }
    if (dto.skills !== undefined) data.skills = dto.skills;
    if (dto.workCategories !== undefined) data.workCategories = dto.workCategories;
    if (dto.dailyCapacityHours !== undefined) data.dailyCapacityHours = dto.dailyCapacityHours;
    if (dto.shift !== undefined) data.shift = dto.shift.trim() || null;
    if (dto.canReceiveWorkOrders !== undefined) data.canReceiveWorkOrders = dto.canReceiveWorkOrders;
    if (dto.availabilityStatus !== undefined) {
      data.availabilityStatus = parseAvailability(dto.availabilityStatus);
    }
    if (dto.active !== undefined) data.active = dto.active;

    if (dto.employeeNo !== undefined) {
      const employeeNo = dto.employeeNo.trim();
      if (employeeNo) {
        await this.assertUniqueEmployeeNo(tenantId, employeeNo, id);
        data.employeeNo = employeeNo;
      }
    }

    if (dto.email !== undefined) {
      const email = dto.email?.trim().toLowerCase() || null;
      if (email) await this.assertUniqueEmail(email, existing.linkedUserId ?? undefined);
      data.email = email;
    }

    if (dto.active === false && existing.linkedUserId) {
      await this.prisma.user.update({
        where: { id: existing.linkedUserId },
        data: { isActive: false }
      });
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data,
      include: this.employeeInclude()
    });

    await writeAuditTrail(this.prisma, {
      entity: "Employee",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "people",
      metadata: { event: "employee_updated" },
      beforeData: existing as object,
      afterData: updated as object
    });

    const inviteStatus = await this.latestInviteStatus(updated.linkedUserId);
    return this.mapPersonRow(updated, inviteStatus);
  }

  async deactivate(id: string) {
    const tenantId = this.requiredTenantId();
    const existing = await this.findOne(id);
    if (!existing.active) return existing;

    if (existing.linkedUserId) {
      await this.prisma.user.update({
        where: { id: existing.linkedUserId },
        data: { isActive: false }
      });
      await writeAuditTrail(this.prisma, {
        entity: "User",
        entityId: existing.linkedUserId,
        action: AuditAction.UPDATE,
        module: "people",
        metadata: { event: "login_disabled" }
      });
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: { active: false, availabilityStatus: EmployeeAvailabilityStatus.INACTIVE },
      include: this.employeeInclude()
    });

    await writeAuditTrail(this.prisma, {
      entity: "Employee",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "people",
      metadata: { event: "employee_deactivated" }
    });

    const inviteStatus = await this.latestInviteStatus(updated.linkedUserId);
    return this.mapPersonRow(updated, inviteStatus);
  }

  async reactivate(id: string) {
    const tenantId = this.requiredTenantId();
    const existing = await this.prisma.employee.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) }
    });
    if (!existing) throw new NotFoundException("Person not found");

    const updated = await this.prisma.employee.update({
      where: { id },
      data: { active: true, availabilityStatus: EmployeeAvailabilityStatus.AVAILABLE },
      include: this.employeeInclude()
    });

    await writeAuditTrail(this.prisma, {
      entity: "Employee",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "people",
      metadata: { event: "employee_reactivated" }
    });

    const inviteStatus = await this.latestInviteStatus(updated.linkedUserId);
    return this.mapPersonRow(updated, inviteStatus);
  }

  async upsertTechnicianProfile(employeeId: string, dto: UpdateTechnicianProfileDto) {
    const tenantId = this.requiredTenantId();
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, ...(tenantId ? { tenantId } : {}) }
    });
    if (!employee) throw new NotFoundException("Person not found");

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(dto.skills !== undefined ? { skills: dto.skills } : {}),
        ...(dto.workCategories !== undefined ? { workCategories: dto.workCategories } : {}),
        ...(dto.dailyCapacityHours !== undefined ? { dailyCapacityHours: dto.dailyCapacityHours } : {}),
        ...(dto.shift !== undefined ? { shift: dto.shift.trim() || null } : {}),
        ...(dto.canReceiveWorkOrders !== undefined ? { canReceiveWorkOrders: dto.canReceiveWorkOrders } : {}),
        ...(dto.availabilityStatus !== undefined
          ? { availabilityStatus: parseAvailability(dto.availabilityStatus) }
          : {}),
        ...(dto.branchName !== undefined ? { branchName: dto.branchName.trim() || null } : {})
      },
      include: this.employeeInclude()
    });

    await writeAuditTrail(this.prisma, {
      entity: "Employee",
      entityId: employeeId,
      action: AuditAction.UPDATE,
      module: "people",
      metadata: { event: "technician_profile_updated" }
    });

    const inviteStatus = await this.latestInviteStatus(updated.linkedUserId);
    return this.mapPersonRow(updated, inviteStatus);
  }

  async enableLogin(employeeId: string, dto: EnableLoginDto) {
    const tenantId = this.requiredTenantId();
    const actorId = this.actorId();
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, ...(tenantId ? { tenantId } : {}) }
    });
    if (!employee) throw new NotFoundException("Person not found");
    if (!employee.active) throw new BadRequestException("Inactive employee cannot login");
    if (employee.linkedUserId) throw new BadRequestException("This employee already has a login account");

    const email = dto.email.trim().toLowerCase();
    await this.assertUniqueEmail(email);

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new BadRequestException("Role not found");

    const { firstName, lastName } = splitFullName(employee.fullName);
    const inviteMethod = dto.inviteMethod ?? InviteMethod.INVITE_EMAIL;
    let temporaryPassword: string | null = null;
    let inviteLink: string | null = null;

    let passwordHash: string;
    let mustChangePassword = false;
    let temporaryPasswordExpiresAt: Date | null = null;

    if (inviteMethod === InviteMethod.TEMP_PASSWORD) {
      temporaryPassword = randomBytes(9).toString("base64url");
      passwordHash = await bcrypt.hash(temporaryPassword, 10);
      mustChangePassword = true;
      temporaryPasswordExpiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
    } else {
      passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
      mustChangePassword = true;
    }

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName,
        lastName,
        phone: employee.phone,
        roleId: role.id,
        departmentId: dto.departmentId ?? employee.departmentId,
        designation: employee.designation,
        skills: employee.skills,
        dailyCapacityHours: employee.dailyCapacityHours,
        branchScope: dto.branchScope?.trim() || employee.branchName,
        mustChangePassword,
        temporaryPasswordExpiresAt,
        isActive: true
      }
    });

    if (tenantId) {
      await this.prisma.tenantMembership.create({
        data: {
          tenantId,
          userId: user.id,
          membershipRole:
            role.name === RoleName.ADMIN || role.name === RoleName.SUPER_ADMIN
              ? TenantMembershipRole.ADMIN
              : TenantMembershipRole.MEMBER
        }
      });
    }

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: { linkedUserId: user.id, canLogin: true, email },
      include: this.employeeInclude()
    });

    await writeAuditTrail(this.prisma, {
      entity: "User",
      entityId: user.id,
      action: AuditAction.CREATE,
      module: "people",
      metadata: { event: "login_enabled" }
    });

    if (inviteMethod === InviteMethod.TEMP_PASSWORD && temporaryPassword) {
      await writeAuditTrail(this.prisma, {
        entity: "User",
        entityId: user.id,
        action: AuditAction.UPDATE,
        module: "people",
        metadata: { event: "temporary_password_generated" }
      });
    } else {
      const dept = updated.departmentId
        ? await this.prisma.department.findUnique({ where: { id: updated.departmentId }, select: { name: true } })
        : null;
      const invite = await this.userInvitation.createOrRefreshInvitation({
        tenantId,
        userId: user.id,
        invitedById: actorId,
        fullName: employee.fullName,
        roleName: role.name,
        branchName: employee.branchName,
        departmentName: dept?.name ?? null,
        sendEmail: inviteMethod !== InviteMethod.COPY_LINK
      });
      inviteLink = invite.inviteLink;
    }

    const inviteStatus = await this.latestInviteStatus(user.id);
    return {
      person: this.mapPersonRow(updated, inviteStatus),
      ...(temporaryPassword ? { temporaryPassword } : {}),
      ...(inviteLink ? { inviteLink } : {}),
      emailProviderConfigured: this.userInvitation.isEmailConfigured()
    };
  }

  async disableLogin(employeeId: string) {
    const employee = await this.findOne(employeeId);
    if (!employee.linkedUserId) throw new BadRequestException("Employee has no login account");

    await this.prisma.user.update({
      where: { id: employee.linkedUserId },
      data: { isActive: false }
    });

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { canLogin: false }
    });

    await writeAuditTrail(this.prisma, {
      entity: "User",
      entityId: employee.linkedUserId,
      action: AuditAction.UPDATE,
      module: "people",
      metadata: { event: "login_disabled" }
    });

    return this.findOne(employeeId);
  }

  async resetPassword(userId: string, inviteMethod: InviteMethod = InviteMethod.TEMP_PASSWORD) {
    const tenantId = this.requiredTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...(tenantId ? { tenantId } : {}) },
      include: { linkedWorkforceEmployees: true }
    });
    if (!user) throw new NotFoundException("User not found");

    const employee = user.linkedWorkforceEmployees[0];
    if (employee && !employee.active) {
      throw new BadRequestException("Inactive employee cannot login");
    }

    let temporaryPassword: string | null = null;
    let inviteLink: string | null = null;

    if (inviteMethod === InviteMethod.TEMP_PASSWORD) {
      temporaryPassword = randomBytes(9).toString("base64url");
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
      await writeAuditTrail(this.prisma, {
        entity: "User",
        entityId: userId,
        action: AuditAction.UPDATE,
        module: "people",
        metadata: { event: "password_reset_issued" }
      });
    } else {
      const actorId = this.actorId();
      const invite = await this.userInvitation.createOrRefreshInvitation({
        tenantId,
        userId,
        invitedById: actorId,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        roleName: "User",
        sendEmail: inviteMethod !== InviteMethod.COPY_LINK
      });
      inviteLink = invite.inviteLink;
      await writeAuditTrail(this.prisma, {
        entity: "User",
        entityId: userId,
        action: AuditAction.UPDATE,
        module: "people",
        metadata: { event: "password_reset_issued", mode: "invite" }
      });
    }

    return {
      userId,
      ...(temporaryPassword ? { temporaryPassword } : {}),
      ...(inviteLink ? { inviteLink } : {}),
      emailProviderConfigured: this.userInvitation.isEmailConfigured()
    };
  }

  async sendInvite(userId: string) {
    const tenantId = this.requiredTenantId();
    const actorId = this.actorId();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...(tenantId ? { tenantId } : {}) },
      include: {
        role: { select: { name: true } },
        department: { select: { name: true } },
        linkedWorkforceEmployees: { select: { fullName: true, branchName: true, active: true } }
      }
    });
    if (!user) throw new NotFoundException("User not found");
    const employee = user.linkedWorkforceEmployees[0];
    if (employee && !employee.active) throw new BadRequestException("Inactive employee cannot login");

    const invite = await this.userInvitation.createOrRefreshInvitation({
      tenantId,
      userId,
      invitedById: actorId,
      fullName: employee?.fullName ?? `${user.firstName} ${user.lastName}`.trim(),
      roleName: user.role.name,
      branchName: employee?.branchName ?? user.branchScope,
      departmentName: user.department?.name ?? null,
      sendEmail: true
    });

    await writeAuditTrail(this.prisma, {
      entity: "UserInvitation",
      entityId: userId,
      action: AuditAction.CREATE,
      module: "people",
      metadata: { event: "invitation_sent", emailSent: invite.emailSent }
    });

    return {
      inviteLink: invite.inviteLink,
      emailSent: invite.emailSent,
      emailProviderConfigured: this.userInvitation.isEmailConfigured(),
      status: invite.status
    };
  }

  async resendInvite(userId: string) {
    const result = await this.sendInvite(userId);
    await writeAuditTrail(this.prisma, {
      entity: "UserInvitation",
      entityId: userId,
      action: AuditAction.UPDATE,
      module: "people",
      metadata: { event: "invitation_resent" }
    });
    return result;
  }

  async revokeInvite(userId: string) {
    await this.userInvitation.revokeInvitation(userId);
    await writeAuditTrail(this.prisma, {
      entity: "UserInvitation",
      entityId: userId,
      action: AuditAction.UPDATE,
      module: "people",
      metadata: { event: "invitation_revoked" }
    });
    return { revoked: true };
  }
}
