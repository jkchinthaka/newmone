import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type ScanActor = Pick<JwtPayload, "tenantId">;

type ScanTargetKind = "ASSET" | "VEHICLE" | "DRIVER" | "WORK_ORDER";

type ScanTarget = {
  type: ScanTargetKind;
  id: string;
  route: string;
  matchedBy: string;
  title: string;
  subtitle: string;
  metadata: Record<string, unknown>;
};

type RouteHint = {
  type: ScanTargetKind;
  identifier: string;
};

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async scanLookup(rawCode: string, actor?: ScanActor) {
    const code = this.normalizeCode(rawCode);
    const tenantId = actor?.tenantId ?? null;
    const routeHint = this.extractRouteHint(code);

    if (routeHint) {
      const target = await this.resolveHintedTarget(routeHint, tenantId);
      if (target) {
        return {
          code: rawCode,
          normalizedCode: code,
          target
        };
      }
    }

    const target = await this.resolveGenericTarget(code, tenantId);
    if (!target) {
      throw new NotFoundException("No operational match found for the scanned code");
    }

    return {
      code: rawCode,
      normalizedCode: code,
      target
    };
  }

  private async resolveHintedTarget(routeHint: RouteHint, tenantId: string | null): Promise<ScanTarget | null> {
    switch (routeHint.type) {
      case "ASSET":
        return this.findAssetTarget(routeHint.identifier, tenantId, "route");
      case "VEHICLE":
        return this.findVehicleTarget(routeHint.identifier, tenantId, "route");
      case "DRIVER":
        return this.findDriverTarget(routeHint.identifier, tenantId, "route");
      case "WORK_ORDER":
        return this.findWorkOrderTarget(routeHint.identifier, tenantId, "route");
    }
  }

  private async resolveGenericTarget(code: string, tenantId: string | null): Promise<ScanTarget | null> {
    const upperCode = code.toUpperCase();

    if (upperCode.startsWith("WO-")) {
      const workOrder = await this.findWorkOrderTarget(code, tenantId, "woNumber");
      if (workOrder) {
        return workOrder;
      }
    }

    if (code.includes("@")) {
      const driver = await this.findDriverTarget(code, tenantId, "email");
      if (driver) {
        return driver;
      }
    }

    const resolvers = [
      () => this.findAssetTarget(code, tenantId, "reference"),
      () => this.findVehicleTarget(code, tenantId, "reference"),
      () => this.findDriverTarget(code, tenantId, "reference"),
      () => this.findWorkOrderTarget(code, tenantId, "reference")
    ];

    for (const resolve of resolvers) {
      const target = await resolve();
      if (target) {
        return target;
      }
    }

    return null;
  }

  private async findAssetTarget(
    code: string,
    tenantId: string | null,
    matchedByPrefix: string
  ): Promise<ScanTarget | null> {
    const asset = await this.prisma.asset.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [
          ...(this.isObjectId(code) ? [{ id: code }] : []),
          { assetTag: { equals: code, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        assetTag: true,
        name: true,
        status: true,
        category: true,
        location: true
      }
    });

    if (!asset) {
      return null;
    }

    return {
      type: "ASSET",
      id: asset.id,
      route: `/assets/${asset.id}`,
      matchedBy: matchedByPrefix === "route" ? "route" : this.isObjectId(code) ? "id" : "assetTag",
      title: asset.assetTag,
      subtitle: [asset.name, this.humanize(asset.status)].filter(Boolean).join(" · "),
      metadata: {
        category: asset.category,
        status: asset.status,
        location: asset.location
      }
    };
  }

  private async findVehicleTarget(
    code: string,
    tenantId: string | null,
    matchedByPrefix: string
  ): Promise<ScanTarget | null> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [
          ...(this.isObjectId(code) ? [{ id: code }] : []),
          { registrationNo: { equals: code, mode: "insensitive" } },
          { assetTag: { equals: code, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        registrationNo: true,
        make: true,
        vehicleModel: true,
        status: true,
        assetTag: true,
        driverId: true
      }
    });

    if (!vehicle) {
      return null;
    }

    const matchedBy = matchedByPrefix === "route"
      ? "route"
      : this.isObjectId(code)
        ? "id"
        : vehicle.registrationNo.toLowerCase() == code.toLowerCase()
          ? "registrationNo"
          : "assetTag";

    return {
      type: "VEHICLE",
      id: vehicle.id,
      route: `/fleet/vehicles/${vehicle.id}`,
      matchedBy,
      title: vehicle.registrationNo,
      subtitle: [vehicle.make, vehicle.vehicleModel, this.humanize(vehicle.status)]
        .filter(Boolean)
        .join(" · "),
      metadata: {
        status: vehicle.status,
        assetTag: vehicle.assetTag,
        driverId: vehicle.driverId
      }
    };
  }

  private async findDriverTarget(
    code: string,
    tenantId: string | null,
    matchedByPrefix: string
  ): Promise<ScanTarget | null> {
    const driver = await this.prisma.driver.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [
          ...(this.isObjectId(code) ? [{ id: code }, { userId: code }] : []),
          { licenseNumber: { equals: code, mode: "insensitive" } },
          { user: { is: { email: { equals: code, mode: "insensitive" } } } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!driver) {
      return null;
    }

    const displayName = [driver.user.firstName, driver.user.lastName].filter(Boolean).join(" ").trim();
    const matchedBy = matchedByPrefix === "route"
      ? "route"
      : this.isObjectId(code)
        ? code === driver.userId
          ? "userId"
          : "id"
        : driver.licenseNumber.toLowerCase() === code.toLowerCase()
          ? "licenseNumber"
          : "email";

    return {
      type: "DRIVER",
      id: driver.id,
      route: `/fleet/drivers/${driver.id}`,
      matchedBy,
      title: displayName.length > 0 ? displayName : driver.user.email,
      subtitle: [driver.licenseNumber, this.humanize(driver.trainingStatus)].join(" · "),
      metadata: {
        userId: driver.user.id,
        email: driver.user.email,
        isAvailable: driver.isAvailable,
        trainingStatus: driver.trainingStatus
      }
    };
  }

  private async findWorkOrderTarget(
    code: string,
    tenantId: string | null,
    matchedByPrefix: string
  ): Promise<ScanTarget | null> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [
          ...(this.isObjectId(code) ? [{ id: code }] : []),
          { woNumber: { equals: code, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        woNumber: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true
      }
    });

    if (!workOrder) {
      return null;
    }

    return {
      type: "WORK_ORDER",
      id: workOrder.id,
      route: `/work-orders/${workOrder.id}`,
      matchedBy: matchedByPrefix === "route" ? "route" : this.isObjectId(code) ? "id" : "woNumber",
      title: workOrder.woNumber,
      subtitle: [workOrder.title, this.humanize(workOrder.status)].filter(Boolean).join(" · "),
      metadata: {
        status: workOrder.status,
        priority: workOrder.priority,
        dueDate: workOrder.dueDate?.toISOString() ?? null
      }
    };
  }

  private normalizeCode(rawCode: string): string {
    const trimmed = rawCode.trim();
    if (!trimmed) {
      throw new BadRequestException("Scan code is required");
    }

    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  private extractRouteHint(code: string): RouteHint | null {
    const routePatterns: Array<{ type: ScanTargetKind; pattern: RegExp }> = [
      { type: "ASSET", pattern: /\/assets\/([A-Za-z0-9-]+)/i },
      { type: "VEHICLE", pattern: /\/vehicles\/([A-Za-z0-9-]+)/i },
      { type: "DRIVER", pattern: /\/drivers\/([A-Za-z0-9-]+)/i },
      { type: "WORK_ORDER", pattern: /\/work-orders\/([A-Za-z0-9-]+)/i }
    ];

    for (const routePattern of routePatterns) {
      const match = routePattern.pattern.exec(code);
      if (match?.[1]) {
        return {
          type: routePattern.type,
          identifier: match[1]
        };
      }
    }

    const assetScanMatch = /\/scan\/([^/?#]+)/i.exec(code);
    if (assetScanMatch?.[1]) {
      return {
        type: "ASSET",
        identifier: assetScanMatch[1]
      };
    }

    return null;
  }

  private isObjectId(value: string): boolean {
    return /^[a-f\d]{24}$/i.test(value.trim());
  }

  private humanize(value: string): string {
    return value
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}