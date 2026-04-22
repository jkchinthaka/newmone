import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../database/prisma.service";
import {
  type FleetAlertSeverity,
  type FleetAlertType,
  FleetGateway,
  type FleetSocketAlert
} from "./fleet.gateway";

const STREET_VIEW_HOST = "google-map-places.p.rapidapi.com";
const STREET_VIEW_ENDPOINT = `https://${STREET_VIEW_HOST}/maps/api/streetview`;
const DEFAULT_STREET_VIEW_SIZE = "600x320";

const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000;
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const OVERSPEED_THRESHOLD_KPH = 90;
const HARSH_DELTA_KPH = 35;
const HARSH_WINDOW_MS = 25_000;
const OFFLINE_SWEEP_MS = 30_000;
const MAX_ALERTS = 300;

type StreetViewQuery = {
  lat: string;
  lng: string;
  heading?: string;
  pitch?: string;
  fov?: string;
  size?: string;
};

export type FleetGeofenceType = "DEPOT" | "RESTRICTED" | "CUSTOMER";
export type FleetGeofenceShape = "CIRCLE" | "POLYGON";

export interface FleetGeofencePoint {
  lat: number;
  lng: number;
}

export interface FleetGeofence {
  id: string;
  name: string;
  type: FleetGeofenceType;
  shape: FleetGeofenceShape;
  center?: FleetGeofencePoint;
  radiusMeters?: number;
  points?: FleetGeofencePoint[];
  createdAt: string;
  updatedAt: string;
}

export interface FleetGeofenceCreateInput {
  name: string;
  type: FleetGeofenceType;
  shape: FleetGeofenceShape;
  center?: FleetGeofencePoint;
  radiusMeters?: number;
  points?: FleetGeofencePoint[];
}

type TelemetryInput = {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  engineStatus?: boolean | "ON" | "OFF";
  fuelLevel?: number;
  batteryVoltage?: number;
};

interface VehicleRuntimeState {
  vehicleId: string;
  registrationNo: string;
  driverName: string;
  lastLat: number;
  lastLng: number;
  lastSpeedKph: number | null;
  lastHeading: number | null;
  lastUpdateAt: string;
  engineStatus: boolean;
  ignitionOnTime: string | null;
  idleSince: string | null;
  idleStatus: boolean;
  fuelLevel: number | null;
  batteryVoltage: number | null;
  geofenceIds: Set<string>;
  offlineAlertRaised: boolean;
}

interface VehicleMeta {
  registrationNo: string;
  driverName: string;
}

@Injectable()
export class FleetService implements OnModuleDestroy {
  private readonly runtimeStateByVehicle = new Map<string, VehicleRuntimeState>();
  private readonly alerts: FleetSocketAlert[] = [];
  private readonly geofences = new Map<string, FleetGeofence>();
  private readonly offlineSweepHandle: NodeJS.Timeout;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(FleetGateway)
    private readonly fleetGateway: FleetGateway,
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {
    this.offlineSweepHandle = setInterval(() => {
      this.runOfflineSweep();
    }, OFFLINE_SWEEP_MS);
  }

  onModuleDestroy() {
    clearInterval(this.offlineSweepHandle);
  }

  async updateGps(vehicleId: string, data: TelemetryInput) {
    this.validateCoordinate(data.latitude, -90, 90, "latitude");
    this.validateCoordinate(data.longitude, -180, 180, "longitude");

    const saved = await this.prisma.gpsLocation.create({
      data: {
        vehicleId,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.heading
      }
    });

    const vehicleMeta = await this.fetchVehicleMeta(vehicleId);
    const previousState = this.runtimeStateByVehicle.get(vehicleId);

    const nextState = this.upsertRuntimeState({
      vehicleId,
      vehicleMeta,
      data,
      timestamp: saved.timestamp.toISOString(),
      previousState
    });

    this.emitBehaviorAlerts(previousState, nextState);
    this.emitGeofenceTransitionAlerts(previousState, nextState);

    const socketPayload = {
      ...saved,
      vehicle: {
        registrationNo: vehicleMeta.registrationNo,
        driver: {
          user: this.toDriverUser(vehicleMeta.driverName)
        }
      },
      intelligence: this.toLiveIntelligence(nextState, false)
    };

    this.fleetGateway.broadcastLocationUpdate(socketPayload);

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

    return latestByVehicle.map((location) => {
      const runtime = this.runtimeStateByVehicle.get(location.vehicleId);
      const lastSeenIso = runtime?.lastUpdateAt ?? location.timestamp.toISOString();
      const offline = this.isOffline(lastSeenIso);

      return {
        ...location,
        intelligence: this.toLiveIntelligence(runtime, offline)
      };
    });
  }

  listAlerts(limitRaw?: number) {
    const limit = this.toPositiveInt(limitRaw, 50, 1, 200);
    return this.alerts.slice(0, limit);
  }

  listGeofences() {
    return Array.from(this.geofences.values()).sort((left, right) =>
      left.createdAt < right.createdAt ? 1 : -1
    );
  }

  createGeofence(input: FleetGeofenceCreateInput) {
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException("Geofence name is required");
    }

    if (!["DEPOT", "RESTRICTED", "CUSTOMER"].includes(input.type)) {
      throw new BadRequestException("Invalid geofence type");
    }

    if (!["CIRCLE", "POLYGON"].includes(input.shape)) {
      throw new BadRequestException("Invalid geofence shape");
    }

    const nowIso = new Date().toISOString();
    const zone: FleetGeofence = {
      id: `gf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: input.type,
      shape: input.shape,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (input.shape === "CIRCLE") {
      if (!input.center) {
        throw new BadRequestException("Circle geofence center is required");
      }

      this.validateCoordinate(input.center.lat, -90, 90, "center.lat");
      this.validateCoordinate(input.center.lng, -180, 180, "center.lng");
      const radiusMeters = this.toPositiveInt(input.radiusMeters, 250, 25, 100_000);

      zone.center = {
        lat: input.center.lat,
        lng: input.center.lng
      };
      zone.radiusMeters = radiusMeters;
    }

    if (input.shape === "POLYGON") {
      if (!Array.isArray(input.points) || input.points.length < 3) {
        throw new BadRequestException("Polygon geofence requires at least 3 points");
      }

      const normalizedPoints = input.points.map((point, index) => {
        this.validateCoordinate(point.lat, -90, 90, `points[${index}].lat`);
        this.validateCoordinate(point.lng, -180, 180, `points[${index}].lng`);

        return {
          lat: point.lat,
          lng: point.lng
        };
      });

      zone.points = normalizedPoints;
    }

    this.geofences.set(zone.id, zone);

    return zone;
  }

  removeGeofence(id: string) {
    const existing = this.geofences.get(id);
    if (!existing) {
      throw new NotFoundException("Geofence not found");
    }

    this.geofences.delete(id);

    return {
      deleted: true,
      id
    };
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

  private upsertRuntimeState(input: {
    vehicleId: string;
    vehicleMeta: VehicleMeta;
    data: TelemetryInput;
    timestamp: string;
    previousState: VehicleRuntimeState | undefined;
  }) {
    const previous = input.previousState;
    const speedKph = this.toOptionalFiniteNumber(input.data.speed);
    const heading = this.toOptionalFiniteNumber(input.data.heading);

    const inferredEngineOn = this.parseEngineStatus(
      input.data.engineStatus,
      speedKph,
      previous?.engineStatus ?? false
    );

    let ignitionOnTime = previous?.ignitionOnTime ?? null;
    if (inferredEngineOn && !previous?.engineStatus) {
      ignitionOnTime = input.timestamp;
    }
    if (!inferredEngineOn) {
      ignitionOnTime = null;
    }

    const stationary = (speedKph ?? 0) <= 0.5;
    let idleSince = previous?.idleSince ?? null;

    if (inferredEngineOn && stationary) {
      if (!previous?.idleSince || !previous.engineStatus || (previous.lastSpeedKph ?? 0) > 0.5) {
        idleSince = input.timestamp;
      }
    } else {
      idleSince = null;
    }

    const idleStatus = idleSince ? this.diffMs(idleSince, input.timestamp) >= IDLE_THRESHOLD_MS : false;

    const fuelLevel = this.toOptionalFiniteNumber(input.data.fuelLevel);
    const batteryVoltage = this.toOptionalFiniteNumber(input.data.batteryVoltage);

    const nextState: VehicleRuntimeState = {
      vehicleId: input.vehicleId,
      registrationNo: input.vehicleMeta.registrationNo,
      driverName: input.vehicleMeta.driverName,
      lastLat: input.data.latitude,
      lastLng: input.data.longitude,
      lastSpeedKph: speedKph,
      lastHeading: heading,
      lastUpdateAt: input.timestamp,
      engineStatus: inferredEngineOn,
      ignitionOnTime,
      idleSince,
      idleStatus,
      fuelLevel: fuelLevel ?? previous?.fuelLevel ?? null,
      batteryVoltage: batteryVoltage ?? previous?.batteryVoltage ?? null,
      geofenceIds: previous?.geofenceIds ?? new Set<string>(),
      offlineAlertRaised: false
    };

    this.runtimeStateByVehicle.set(input.vehicleId, nextState);

    return nextState;
  }

  private emitBehaviorAlerts(previous: VehicleRuntimeState | undefined, next: VehicleRuntimeState) {
    if ((next.lastSpeedKph ?? 0) >= OVERSPEED_THRESHOLD_KPH) {
      this.pushAlert(
        {
          type: "OVERSPEED",
          severity: next.lastSpeedKph !== null && next.lastSpeedKph >= 120 ? "CRITICAL" : "WARNING",
          vehicleId: next.vehicleId,
          registrationNo: next.registrationNo,
          message: `${next.registrationNo} exceeded speed threshold at ${(next.lastSpeedKph ?? 0).toFixed(1)} km/h.`,
          metadata: {
            speedKph: next.lastSpeedKph,
            thresholdKph: OVERSPEED_THRESHOLD_KPH
          }
        },
        120_000
      );
    }

    if (next.idleStatus && !previous?.idleStatus) {
      this.pushAlert(
        {
          type: "IDLE_TOO_LONG",
          severity: "WARNING",
          vehicleId: next.vehicleId,
          registrationNo: next.registrationNo,
          message: `${next.registrationNo} has been idling for more than 5 minutes.`,
          metadata: {
            idleSince: next.idleSince
          }
        },
        180_000
      );
    }

    if (
      previous?.lastSpeedKph !== null &&
      previous?.lastSpeedKph !== undefined &&
      next.lastSpeedKph !== null
    ) {
      const elapsedMs = this.diffMs(previous.lastUpdateAt, next.lastUpdateAt);
      const delta = Math.abs(next.lastSpeedKph - previous.lastSpeedKph);

      if (elapsedMs <= HARSH_WINDOW_MS && delta >= HARSH_DELTA_KPH) {
        this.pushAlert(
          {
            type: "HARSH_DRIVING",
            severity: delta >= 50 ? "CRITICAL" : "WARNING",
            vehicleId: next.vehicleId,
            registrationNo: next.registrationNo,
            message: `${next.registrationNo} detected a harsh speed change (${delta.toFixed(1)} km/h).`,
            metadata: {
              previousSpeedKph: previous.lastSpeedKph,
              currentSpeedKph: next.lastSpeedKph,
              deltaKph: delta,
              elapsedMs
            }
          },
          120_000
        );
      }
    }
  }

  private emitGeofenceTransitionAlerts(previous: VehicleRuntimeState | undefined, next: VehicleRuntimeState) {
    if (this.geofences.size === 0) {
      next.geofenceIds = new Set<string>();
      return;
    }

    const point = {
      lat: next.lastLat,
      lng: next.lastLng
    };

    const previouslyInside = previous?.geofenceIds ?? new Set<string>();
    const currentlyInside = new Set<string>();

    for (const zone of this.geofences.values()) {
      if (this.isPointInsideGeofence(point, zone)) {
        currentlyInside.add(zone.id);
      }
    }

    for (const zoneId of currentlyInside) {
      if (previouslyInside.has(zoneId)) {
        continue;
      }

      const zone = this.geofences.get(zoneId);
      if (!zone) {
        continue;
      }

      this.pushAlert(
        {
          type: "GEOFENCE_ENTER",
          severity: zone.type === "RESTRICTED" ? "CRITICAL" : "INFO",
          vehicleId: next.vehicleId,
          registrationNo: next.registrationNo,
          message: `${next.registrationNo} entered ${zone.name}.`,
          metadata: {
            geofenceId: zone.id,
            geofenceName: zone.name,
            geofenceType: zone.type
          }
        },
        15_000
      );
    }

    for (const zoneId of previouslyInside) {
      if (currentlyInside.has(zoneId)) {
        continue;
      }

      const zone = this.geofences.get(zoneId);
      if (!zone) {
        continue;
      }

      this.pushAlert(
        {
          type: "GEOFENCE_EXIT",
          severity: zone.type === "RESTRICTED" ? "WARNING" : "INFO",
          vehicleId: next.vehicleId,
          registrationNo: next.registrationNo,
          message: `${next.registrationNo} exited ${zone.name}.`,
          metadata: {
            geofenceId: zone.id,
            geofenceName: zone.name,
            geofenceType: zone.type
          }
        },
        15_000
      );
    }

    next.geofenceIds = currentlyInside;
    this.runtimeStateByVehicle.set(next.vehicleId, next);
  }

  private runOfflineSweep() {
    const nowIso = new Date().toISOString();

    for (const [vehicleId, state] of this.runtimeStateByVehicle.entries()) {
      if (!this.isOffline(state.lastUpdateAt)) {
        continue;
      }

      if (state.offlineAlertRaised) {
        continue;
      }

      const nextState: VehicleRuntimeState = {
        ...state,
        engineStatus: false,
        idleStatus: false,
        idleSince: null,
        offlineAlertRaised: true
      };

      this.runtimeStateByVehicle.set(vehicleId, nextState);

      this.pushAlert(
        {
          type: "DEVICE_OFFLINE",
          severity: "CRITICAL",
          vehicleId,
          registrationNo: state.registrationNo,
          message: `${state.registrationNo} is offline (last update ${state.lastUpdateAt}).`,
          metadata: {
            lastUpdateAt: state.lastUpdateAt,
            detectedAt: nowIso
          }
        },
        120_000
      );
    }
  }

  private toLiveIntelligence(state: VehicleRuntimeState | undefined, offline: boolean) {
    const engineOn = !offline && Boolean(state?.engineStatus);

    return {
      engineStatus: engineOn ? "ON" : "OFF",
      ignitionOnTime: engineOn ? state?.ignitionOnTime ?? null : null,
      idleStatus: !offline && Boolean(state?.idleStatus),
      fuelLevel: state?.fuelLevel ?? null,
      batteryVoltage: state?.batteryVoltage ?? null,
      offlineStatus: offline,
      lastUpdateAt: state?.lastUpdateAt ?? null,
      driverName: state?.driverName ?? "Unknown Driver"
    };
  }

  private pushAlert(
    alertInput: {
      type: FleetAlertType;
      severity: FleetAlertSeverity;
      vehicleId: string;
      registrationNo: string;
      message: string;
      metadata?: Record<string, unknown>;
    },
    throttleMs: number
  ) {
    const recent = this.alerts.find(
      (alert) =>
        alert.vehicleId === alertInput.vehicleId &&
        alert.type === alertInput.type &&
        this.diffMs(alert.createdAt, new Date().toISOString()) < throttleMs
    );

    if (recent) {
      return;
    }

    const alert: FleetSocketAlert = {
      id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: alertInput.type,
      severity: alertInput.severity,
      vehicleId: alertInput.vehicleId,
      registrationNo: alertInput.registrationNo,
      message: alertInput.message,
      createdAt: new Date().toISOString(),
      metadata: alertInput.metadata
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > MAX_ALERTS) {
      this.alerts.splice(MAX_ALERTS);
    }

    this.fleetGateway.broadcastAlertCreated(alert);
  }

  private async fetchVehicleMeta(vehicleId: string): Promise<VehicleMeta> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        registrationNo: true,
        driver: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!vehicle) {
      return {
        registrationNo: vehicleId,
        driverName: "Unknown Driver"
      };
    }

    const firstName = vehicle.driver?.user?.firstName?.trim() ?? "";
    const lastName = vehicle.driver?.user?.lastName?.trim() ?? "";

    return {
      registrationNo: vehicle.registrationNo,
      driverName: `${firstName} ${lastName}`.trim() || "Unknown Driver"
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

  private isOffline(lastUpdateAt: string) {
    return this.diffMs(lastUpdateAt, new Date().toISOString()) > OFFLINE_THRESHOLD_MS;
  }

  private toPositiveInt(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }

  private toOptionalFiniteNumber(value: number | undefined) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseEngineStatus(
    value: boolean | "ON" | "OFF" | undefined,
    speedKph: number | null,
    previousEngineStatus: boolean
  ) {
    if (typeof value === "boolean") {
      return value;
    }

    if (value === "ON") {
      return true;
    }

    if (value === "OFF") {
      return false;
    }

    if (speedKph !== null && speedKph > 0.5) {
      return true;
    }

    return previousEngineStatus;
  }

  private validateCoordinate(value: number, min: number, max: number, label: string) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new BadRequestException(`Invalid ${label}`);
    }
  }

  private diffMs(fromIso: string, toIso: string) {
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();

    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return Number.MAX_SAFE_INTEGER;
    }

    return Math.max(0, to - from);
  }

  private toDriverUser(driverName: string) {
    const normalized = driverName.trim();
    if (!normalized || normalized === "Unknown Driver") {
      return {
        firstName: "Unknown",
        lastName: "Driver"
      };
    }

    const segments = normalized.split(/\s+/);
    return {
      firstName: segments[0],
      lastName: segments.slice(1).join(" ") || "Driver"
    };
  }

  private isPointInsideGeofence(point: FleetGeofencePoint, geofence: FleetGeofence) {
    if (geofence.shape === "CIRCLE" && geofence.center && geofence.radiusMeters) {
      return this.distanceMeters(point, geofence.center) <= geofence.radiusMeters;
    }

    if (geofence.shape === "POLYGON" && geofence.points && geofence.points.length >= 3) {
      return this.isPointInPolygon(point, geofence.points);
    }

    return false;
  }

  private distanceMeters(from: FleetGeofencePoint, to: FleetGeofencePoint) {
    const rad = Math.PI / 180;
    const dLat = (to.lat - from.lat) * rad;
    const dLng = (to.lng - from.lng) * rad;
    const lat1 = from.lat * rad;
    const lat2 = to.lat * rad;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return 6_371_000 * c;
  }

  private isPointInPolygon(point: FleetGeofencePoint, vertices: FleetGeofencePoint[]) {
    let inside = false;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].lng;
      const yi = vertices[i].lat;
      const xj = vertices[j].lng;
      const yj = vertices[j].lat;

      const intersect =
        yi > point.lat !== yj > point.lat &&
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }
}
