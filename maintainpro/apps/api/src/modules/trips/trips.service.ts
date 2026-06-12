import { Injectable } from "@nestjs/common";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  allTrips() {
    const tenantId = requestContext.get()?.tenantId ?? null;
    return this.prisma.tripLog.findMany({
      where: tenantId ? { vehicle: { is: { tenantId } } } : {},
      include: { vehicle: true, driver: true },
      orderBy: { createdAt: "desc" }
    });
  }
}
