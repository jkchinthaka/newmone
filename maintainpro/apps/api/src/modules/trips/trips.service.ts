import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  allTrips() {
    return this.prisma.tripLog.findMany({ include: { vehicle: true, driver: true }, orderBy: { createdAt: "desc" } });
  }
}
