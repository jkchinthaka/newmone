import { Injectable } from "@nestjs/common";

import { requestContext } from "../../common/context/request-context";
import { PUBLIC_USER_WITH_ROLE_SELECT } from "../../common/selects/public-user.select";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  private currentTenantId(): string | null {
    return requestContext.get()?.tenantId ?? null;
  }

  findAll(params: { q?: string; pageSize?: number } = {}) {
    const tenantId = this.currentTenantId();
    const q = params.q?.trim();
    const take = Math.min(Math.max(params.pageSize ?? 50, 1), 100);
    return this.prisma.driver.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(q
          ? {
              OR: [
                { licenseNumber: { contains: q, mode: "insensitive" } },
                { user: { is: { firstName: { contains: q, mode: "insensitive" } } } },
                { user: { is: { lastName: { contains: q, mode: "insensitive" } } } },
                { user: { is: { email: { contains: q, mode: "insensitive" } } } }
              ]
            }
          : {})
      },
      include: { user: { select: PUBLIC_USER_WITH_ROLE_SELECT } },
      orderBy: { createdAt: "desc" },
      take
    });
  }

  create(data: { userId: string; licenseNumber: string; licenseClass: string; licenseExpiry: string }) {
    const tenantId = this.currentTenantId();
    return this.prisma.driver.create({
      data: {
        tenantId: tenantId ?? undefined,
        userId: data.userId,
        licenseNumber: data.licenseNumber,
        licenseClass: data.licenseClass,
        licenseExpiry: new Date(data.licenseExpiry)
      }
    });
  }

  findOne(id: string) {
    const tenantId = this.currentTenantId();
    return this.prisma.driver.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {})
      },
      include: { user: { select: PUBLIC_USER_WITH_ROLE_SELECT }, vehicles: true }
    });
  }
}
