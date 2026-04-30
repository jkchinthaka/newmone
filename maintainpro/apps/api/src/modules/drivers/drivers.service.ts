import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(params: { q?: string; pageSize?: number } = {}) {
    const q = params.q?.trim();
    const take = Math.min(Math.max(params.pageSize ?? 50, 1), 100);
    return this.prisma.driver.findMany({
      where: q
        ? {
            OR: [
              { licenseNumber: { contains: q, mode: "insensitive" } },
              { user: { is: { firstName: { contains: q, mode: "insensitive" } } } },
              { user: { is: { lastName: { contains: q, mode: "insensitive" } } } },
              { user: { is: { email: { contains: q, mode: "insensitive" } } } }
            ]
          }
        : undefined,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take
    });
  }

  create(data: { userId: string; licenseNumber: string; licenseClass: string; licenseExpiry: string }) {
    return this.prisma.driver.create({
      data: {
        userId: data.userId,
        licenseNumber: data.licenseNumber,
        licenseClass: data.licenseClass,
        licenseExpiry: new Date(data.licenseExpiry)
      }
    });
  }

  findOne(id: string) {
    return this.prisma.driver.findUnique({ where: { id }, include: { user: true, vehicles: true } });
  }
}
