import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { FleetGateway } from "./fleet.gateway";

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
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
      include: { vehicle: true }
    });

    return latestByVehicle;
  }
}
