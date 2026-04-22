import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../database/prisma.service";
import { FleetGateway } from "./fleet.gateway";

const STREET_VIEW_HOST = "google-map-places.p.rapidapi.com";
const STREET_VIEW_ENDPOINT = `https://${STREET_VIEW_HOST}/maps/api/streetview`;
const DEFAULT_STREET_VIEW_SIZE = "600x320";

type StreetViewQuery = {
  lat: string;
  lng: string;
  heading?: string;
  pitch?: string;
  fov?: string;
  size?: string;
};

@Injectable()
export class FleetService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(FleetGateway)
    private readonly fleetGateway: FleetGateway,
    @Inject(ConfigService)
    private readonly configService: ConfigService
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

  async getStreetViewPreview(query: StreetViewQuery) {
    const rapidApiKey = this.configService.get<string>("RAPIDAPI_GOOGLE_MAP_PLACES_KEY")?.trim();

    if (!rapidApiKey) {
      throw new ServiceUnavailableException("Street View is not configured");
    }

    const latitude = this.parseCoordinate(query.lat, -90, 90, "lat");
    const longitude = this.parseCoordinate(query.lng, -180, 180, "lng");
    const heading = this.parseOptionalNumber(query.heading, 0, 360, "heading");
    const pitch = this.parseOptionalNumber(query.pitch, -90, 90, "pitch");
    const fov = this.parseOptionalNumber(query.fov, 10, 120, "fov");

    const upstreamUrl = new URL(STREET_VIEW_ENDPOINT);
    upstreamUrl.searchParams.set("size", this.normalizeSize(query.size));
    upstreamUrl.searchParams.set("source", "default");
    upstreamUrl.searchParams.set("return_error_code", "true");
    upstreamUrl.searchParams.set("location", `${latitude},${longitude}`);

    if (heading !== null) {
      upstreamUrl.searchParams.set("heading", heading.toString());
    }

    if (pitch !== null) {
      upstreamUrl.searchParams.set("pitch", pitch.toString());
    }

    if (fov !== null) {
      upstreamUrl.searchParams.set("fov", fov.toString());
    }

    const response = await fetch(upstreamUrl, {
      headers: {
        "x-rapidapi-key": rapidApiKey,
        "x-rapidapi-host": STREET_VIEW_HOST
      }
    });

    if (!response.ok) {
      throw new BadRequestException("Street View unavailable for the requested location");
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "image/jpeg",
      cacheControl: "public, max-age=3600, stale-while-revalidate=86400"
    };
  }

  private parseCoordinate(value: string, min: number, max: number, label: string) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`Valid ${label} query parameter is required`);
    }

    return parsed;
  }

  private parseOptionalNumber(value: string | undefined, min: number, max: number, label: string) {
    if (!value?.trim()) {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`Invalid ${label} query parameter`);
    }

    return parsed;
  }

  private normalizeSize(value: string | undefined) {
    if (!value?.trim()) {
      return DEFAULT_STREET_VIEW_SIZE;
    }

    const match = /^(\d{2,4})x(\d{2,4})$/i.exec(value.trim());
    if (!match) {
      return DEFAULT_STREET_VIEW_SIZE;
    }

    const width = Number(match[1]);
    const height = Number(match[2]);
    const clampedWidth = Math.min(Math.max(width, 120), 1280);
    const clampedHeight = Math.min(Math.max(height, 120), 1280);

    return `${clampedWidth}x${clampedHeight}`;
  }
}
