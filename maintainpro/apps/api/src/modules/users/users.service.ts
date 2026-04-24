import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({ include: { role: true } });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    roleId: string;
    phone?: string;
  }) {
    return this.prisma.user.create({ data });
  }

  async invite(data: {
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
    phone?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true }
    });

    if (existing) {
      throw new BadRequestException("Email already in use");
    }

    const tempPassword = `Invite-${randomUUID().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        roleId: data.roleId,
        phone: data.phone,
        passwordHash,
        isActive: true
      },
      include: {
        role: true
      }
    });
  }

  async update(id: string, data: Partial<{ firstName: string; lastName: string; phone: string; roleId: string }>) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data
    });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      include: { role: true }
    });
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
