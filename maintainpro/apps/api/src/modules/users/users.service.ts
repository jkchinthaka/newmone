import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { CreateUserDto, InviteUserDto, UpdateUserDto } from "./dto/users.dto";

type UserRecord = { passwordHash: string };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toPublicUser<T extends UserRecord>(user: T): Omit<T, "passwordHash"> {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  private async ensureRoleExists(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true }
    });

    if (!role) {
      throw new BadRequestException("Role not found");
    }
  }

  async findAll(params: { q?: string; pageSize?: number; roleName?: string } = {}) {
    const q = params.q?.trim();
    const roleName = this.parseRoleName(params.roleName);
    const take = Math.min(Math.max(params.pageSize ?? 50, 1), 100);
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } }
                ]
              }
            : {},
          roleName ? { role: { is: { name: roleName } } } : {}
        ]
      },
      include: { role: true },
      orderBy: { createdAt: "desc" },
      take
    });

    return users.map((user) => this.toPublicUser(user));
  }

  private parseRoleName(value?: string): RoleName | undefined {
    const trimmed = value?.trim();

    if (!trimmed) {
      return undefined;
    }

    if ((Object.values(RoleName) as string[]).includes(trimmed)) {
      return trimmed as RoleName;
    }

    throw new BadRequestException(`Invalid roleName filter: ${trimmed}`);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.toPublicUser(user);
  }

  async create(data: CreateUserDto) {
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existing) {
      throw new BadRequestException("Email already in use");
    }

    await this.ensureRoleExists(data.roleId);

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        roleId: data.roleId,
        phone: data.phone?.trim() || undefined
      },
      include: { role: true }
    });

    return this.toPublicUser(user);
  }

  async invite(data: InviteUserDto) {
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existing) {
      throw new BadRequestException("Email already in use");
    }

    await this.ensureRoleExists(data.roleId);

    const tempPassword = `Invite-${randomUUID().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        roleId: data.roleId,
        phone: data.phone?.trim() || undefined,
        passwordHash,
        isActive: true
      },
      include: {
        role: true
      }
    });

    return this.toPublicUser(user);
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findOne(id);

    if (data.roleId) {
      await this.ensureRoleExists(data.roleId);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        phone: data.phone?.trim() || undefined,
        roleId: data.roleId
      },
      include: { role: true }
    });

    return this.toPublicUser(user);
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      include: { role: true }
    });

    return this.toPublicUser(user);
  }

  async remove(id: string) {
    const openWorkOrders = await this.prisma.workOrder.count({
      where: {
        technicianId: id,
        status: {
          in: ["OPEN", "IN_PROGRESS", "ON_HOLD"]
        }
      }
    });

    if (openWorkOrders > 0) {
      throw new BadRequestException("Cannot delete user with assigned open work orders");
    }

    await this.prisma.user.delete({ where: { id } });

    return {
      deleted: true
    };
  }
}
