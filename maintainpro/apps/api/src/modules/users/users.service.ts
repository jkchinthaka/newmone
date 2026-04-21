import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

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

  async update(id: string, data: Partial<{ firstName: string; lastName: string; phone: string; roleId: string }>) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data
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
