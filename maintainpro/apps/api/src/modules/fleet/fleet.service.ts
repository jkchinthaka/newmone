import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { FleetGateway } from "./fleet.gateway";

@Injectable()
export class FleetService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(FleetGateway)
    private readonly fleetGateway: FleetGateway
  ) {}

  async updateGps(vehicleId: string, data: { latitude: number; longitude: number; speed?: number; heading?: number }) {
    const saved = await this.prisma.gpsLocation.create({
      data: {
        vehicleId,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.heading
      }
    });

    this.fleetGateway.broadcastLocationUpdate(saved);

    return saved;
  }

  async liveMap() {
    const latestByVehicle = await this.prisma.gpsLocation.findMany({
      distinct: ["vehicleId"],
      orderBy: [{ vehicleId: "asc" }, { timestamp: "desc" }],
      include: {
        vehicle: {
          include: {
            driver: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return latestByVehicle;
  }
}
