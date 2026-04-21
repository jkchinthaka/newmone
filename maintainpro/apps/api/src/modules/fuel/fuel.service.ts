import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class FuelService {
  constructor(private readonly prisma: PrismaService) {}

  allLogs() {
    return this.prisma.fuelLog.findMany({ include: { vehicle: true }, orderBy: { date: "desc" } });
  }
}
