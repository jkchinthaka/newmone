import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.driver.findMany({ include: { user: true }, orderBy: { createdAt: "desc" } });
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
