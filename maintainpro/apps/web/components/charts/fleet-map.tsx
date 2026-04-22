"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { DivIcon, Map as LeafletMap } from "leaflet";
import {
  AlertTriangle,
  Bell,
  Car,
  Circle,
  CircleDot,
  Clock3,
  Crosshair,
  Fuel,
  Gauge,
  Layers,
  LocateFixed,
  Navigation,
  Pause,
  Play,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  X
} from "lucide-react";

import { useFleetSocket } from "@/hooks/use-fleet-socket";
import { apiClient } from "@/lib/api-client";

import "leaflet/dist/leaflet.css";

const MapContainer: any = dynamic(async () => (await import("react-leaflet")).MapContainer, { ssr: false });
const Marker: any = dynamic(async () => (await import("react-leaflet")).Marker, { ssr: false });
const Popup: any = dynamic(async () => (await import("react-leaflet")).Popup, { ssr: false });
const TileLayer: any = dynamic(async () => (await import("react-leaflet")).TileLayer, { ssr: false });
const Polyline: any = dynamic(async () => (await import("react-leaflet")).Polyline, { ssr: false });
const CircleMarker: any = dynamic(async () => (await import("react-leaflet")).Circle, { ssr: false });
const Polygon: any = dynamic(async () => (await import("react-leaflet")).Polygon, { ssr: false });

type GeoPoint = {
  lat: number;
  lng: number;
};

type NearbyCategory = "fuel" | "garage";
type SidebarTab = "vehicles" | "drivers" | "alerts" | "nearby";
type VehicleFilter = "ALL" | "MOVING" | "IDLE" | "OFFLINE";
type OperationalState = "MOVING" | "IDLE" | "OFFLINE";
type GeofenceType = "DEPOT" | "RESTRICTED" | "CUSTOMER";
type GeofenceShape = "CIRCLE" | "POLYGON";
type DrawingMode = "NONE" | "CIRCLE" | "POLYGON";
type FleetAlertType =
  | "OVERSPEED"
  | "IDLE_TOO_LONG"
  | "GEOFENCE_ENTER"
  | "GEOFENCE_EXIT"
  | "DEVICE_OFFLINE"
  | "HARSH_DRIVING";
type FleetAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

type NearbyPlace = {
  id: string;
  category: NearbyCategory;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  openingHours?: string;
  rating?: number;
  isNearest?: boolean;
};

type MarkerIcons = {
  user: DivIcon;
  fuel: DivIcon;
  nearestFuel: DivIcon;
  garage: DivIcon;
  moving: DivIcon;
  idle: DivIcon;
  offline: DivIcon;
  critical: DivIcon;
  playback: DivIcon;
};

type FleetVehicleIntelligence = {
  engineStatus: "ON" | "OFF";
  ignitionOnTime: string | null;
  idleStatus: boolean;
  fuelLevel: number | null;
  batteryVoltage: number | null;
  offlineStatus: boolean;
  lastUpdateAt: string | null;
  driverName?: string | null;
};

type FleetVehicle = {
  markerId: string;
  vehicleId: string;
  registrationNo: string;
  lat: number;
  lng: number;
  headingDegrees: number | null;
  speedKph: number | null;
  lastUpdated: string;
  driverName: string;
  intelligence: FleetVehicleIntelligence;
};

type FleetApiVehicle = {
  registrationNo?: string;
  driver?: {
    user?: {
      firstName?: string;
      lastName?: string;
    };
  };
};

type FleetApiLocation = {
  id?: string;
  vehicleId?: string;
  latitude?: number | string;
  longitude?: number | string;
  heading?: number | string | null;
  speed?: number | string | null;
  timestamp?: string;
  vehicle?: FleetApiVehicle;
  intelligence?: Partial<FleetVehicleIntelligence>;
};

type FleetAlert = {
  id: string;
  type: FleetAlertType;
  severity: FleetAlertSeverity;
  vehicleId: string;
  registrationNo: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type FleetGeofence = {
  id: string;
  name: string;
  type: GeofenceType;
  shape: GeofenceShape;
  center?: GeoPoint;
  radiusMeters?: number;
  points?: GeoPoint[];
  createdAt: string;
  updatedAt: string;
};

type OverpassTags = Record<string, string>;

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: OverpassTags;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

type HistoryPoint = {
  id: string;
  lat: number;
  lng: number;
  speedKph: number | null;
  headingDegrees: number | null;
  timestamp: string;
};

type RouteLine = {
  id: string;
  label: string;
  color: string;
  points: [number, number][];
  distanceKm: number;
  durationMin: number;
};

type VehicleCluster = {
  key: string;
  lat: number;
  lng: number;
  vehicles: FleetVehicle[];
  hasCritical: boolean;
};

const COLOMBO: GeoPoint = { lat: 6.9271, lng: 79.8612 };
const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [
  [5.65, 79.35],
  [10.05, 82.15]
];
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000;
const LOCAL_OFFLINE_ALERT_THROTTLE_MS = 4 * 60 * 1000;

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const toOptionalNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isWithinSriLanka = (point: GeoPoint): boolean =>
  point.lat >= 5.65 && point.lat <= 10.05 && point.lng >= 79.35 && point.lng <= 82.15;

const haversineDistanceKm = (from: GeoPoint, to: GeoPoint): number => {
  const degToRad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * degToRad;
  const dLon = (to.lng - from.lng) * degToRad;
  const lat1 = from.lat * degToRad;
  const lat2 = to.lat * degToRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const formatDistance = (distanceKm: number): string => `${distanceKm.toFixed(2)} km`;

const formatTimestamp = (timestamp: string): string => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleString();
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
};

const formatVoltage = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}V`;
};

const normalizeAlertSeverity = (value: unknown): FleetAlertSeverity => {
  if (value === "CRITICAL" || value === "WARNING" || value === "INFO") {
    return value;
  }

  return "INFO";
};

const normalizeAlertType = (value: unknown): FleetAlertType => {
  const fallback: FleetAlertType = "HARSH_DRIVING";

  if (
    value === "OVERSPEED" ||
    value === "IDLE_TOO_LONG" ||
    value === "GEOFENCE_ENTER" ||
    value === "GEOFENCE_EXIT" ||
    value === "DEVICE_OFFLINE" ||
    value === "HARSH_DRIVING"
  ) {
    return value;
  }

  return fallback;
};

const getOverpassCoordinates = (element: OverpassElement): GeoPoint | null => {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lng: element.lon };
  }

  if (element.center && typeof element.center.lat === "number" && typeof element.center.lon === "number") {
    return { lat: element.center.lat, lng: element.center.lon };
  }

  return null;
};

const buildAddress = (tags: OverpassTags): string => {
  const line = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
    tags["addr:postcode"]
  ]
    .filter(Boolean)
    .join(", ");

  if (line) {
    return line;
  }

  return tags["addr:full"] ?? tags.name ?? "Address unavailable";
};

const toAlert = (payload: unknown): FleetAlert | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const row = payload as Partial<FleetAlert>;
  if (!row.id || !row.vehicleId || !row.registrationNo || !row.message || !row.createdAt) {
    return null;
  }

  return {
    id: String(row.id),
    type: normalizeAlertType(row.type),
    severity: normalizeAlertSeverity(row.severity),
    vehicleId: String(row.vehicleId),
    registrationNo: String(row.registrationNo),
    message: String(row.message),
    createdAt: String(row.createdAt),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : undefined
  };
};

const toFleetVehicle = (payload: FleetApiLocation): FleetVehicle | null => {
  const vehicleId = payload.vehicleId ?? "";
  const lat = toFiniteNumber(payload.latitude);
  const lng = toFiniteNumber(payload.longitude);

  if (!vehicleId || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const speedValue = toOptionalNumber(payload.speed);
  const headingValue = toOptionalNumber(payload.heading);
  const firstName = payload.vehicle?.driver?.user?.firstName?.trim() ?? "";
  const lastName = payload.vehicle?.driver?.user?.lastName?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const intelligence = payload.intelligence ?? {};

  const engineStatus = intelligence.engineStatus === "ON" ? "ON" : "OFF";
  const idleStatus = Boolean(intelligence.idleStatus);

  return {
    markerId: payload.id ?? vehicleId,
    vehicleId,
    registrationNo: payload.vehicle?.registrationNo ?? vehicleId,
    lat,
    lng,
    headingDegrees: headingValue,
    speedKph: speedValue,
    lastUpdated: payload.timestamp ?? intelligence.lastUpdateAt ?? new Date().toISOString(),
    driverName: (intelligence.driverName ?? fullName) || "Unknown Driver",
    intelligence: {
      engineStatus,
      ignitionOnTime: intelligence.ignitionOnTime ?? null,
      idleStatus,
      fuelLevel: toOptionalNumber(intelligence.fuelLevel),
      batteryVoltage: toOptionalNumber(intelligence.batteryVoltage),
      offlineStatus: Boolean(intelligence.offlineStatus),
      lastUpdateAt: intelligence.lastUpdateAt ?? payload.timestamp ?? null
    }
  };
};

const mergeVehicle = (existing: FleetVehicle | undefined, incoming: FleetVehicle): FleetVehicle => {
  if (!existing) {
    return incoming;
  }

  return {
    ...existing,
    ...incoming,
    registrationNo: incoming.registrationNo === incoming.vehicleId ? existing.registrationNo : incoming.registrationNo,
    driverName: incoming.driverName === "Unknown Driver" ? existing.driverName : incoming.driverName,
    intelligence: {
      ...existing.intelligence,
      ...incoming.intelligence
    }
  };
};

const isSameVehicleSnapshot = (left: FleetVehicle, right: FleetVehicle) =>
  left.lat === right.lat &&
  left.lng === right.lng &&
  left.speedKph === right.speedKph &&
  left.headingDegrees === right.headingDegrees &&
  left.lastUpdated === right.lastUpdated &&
  left.intelligence.engineStatus === right.intelligence.engineStatus &&
  left.intelligence.idleStatus === right.intelligence.idleStatus &&
  left.intelligence.offlineStatus === right.intelligence.offlineStatus &&
  left.intelligence.fuelLevel === right.intelligence.fuelLevel &&
  left.intelligence.batteryVoltage === right.intelligence.batteryVoltage;

const operationalStateForVehicle = (vehicle: FleetVehicle, nowMs: number): OperationalState => {
  const lastSeen = vehicle.intelligence.lastUpdateAt ?? vehicle.lastUpdated;
  const lastSeenMs = new Date(lastSeen).getTime();
  const stale = !Number.isFinite(lastSeenMs) || nowMs - lastSeenMs > OFFLINE_THRESHOLD_MS;
  if (vehicle.intelligence.offlineStatus || stale) {
    return "OFFLINE";
  }

  if (vehicle.intelligence.idleStatus || (vehicle.intelligence.engineStatus === "ON" && (vehicle.speedKph ?? 0) <= 0.5)) {
    return "IDLE";
  }

  return "MOVING";
};

const toFilterState = (state: OperationalState): VehicleFilter => state;

const clusterVehicles = (
  vehicles: FleetVehicle[],
  zoom: number,
  criticalVehicleIds: Set<string>,
  nowMs: number
): VehicleCluster[] => {
  if (vehicles.length === 0) {
    return [];
  }

  if (zoom >= 13) {
    return vehicles.map((vehicle) => ({
      key: `single-${vehicle.vehicleId}`,
      lat: vehicle.lat,
      lng: vehicle.lng,
      vehicles: [vehicle],
      hasCritical: criticalVehicleIds.has(vehicle.vehicleId)
    }));
  }

  const cellSize = zoom <= 7 ? 0.5 : zoom <= 9 ? 0.24 : zoom <= 11 ? 0.12 : 0.08;

  const groups = new Map<string, FleetVehicle[]>();
  for (const vehicle of vehicles) {
    const row = Math.floor(vehicle.lat / cellSize);
    const col = Math.floor(vehicle.lng / cellSize);
    const key = `${row}:${col}`;
    const existing = groups.get(key) ?? [];
    existing.push(vehicle);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const totalLat = group.reduce((sum, item) => sum + item.lat, 0);
    const totalLng = group.reduce((sum, item) => sum + item.lng, 0);
    const hasCritical = group.some((item) => criticalVehicleIds.has(item.vehicleId));

    group.sort((left, right) => {
      const leftState = operationalStateForVehicle(left, nowMs);
      const rightState = operationalStateForVehicle(right, nowMs);
      return leftState.localeCompare(rightState);
    });

    return {
      key,
      lat: totalLat / group.length,
      lng: totalLng / group.length,
      vehicles: group,
      hasCritical
    };
  });
};

const sortedUniqueAlerts = (current: FleetAlert[], incoming: FleetAlert[]) => {
  const map = new Map<string, FleetAlert>();
  for (const item of [...incoming, ...current]) {
    map.set(item.id, item);
  }

  return Array.from(map.values()).sort((left, right) =>
    left.createdAt < right.createdAt ? 1 : -1
  );
};

function StreetViewPreview({
  lat,
  lng,
  heading,
  label
}: {
  lat: number;
  lng: number;
  heading?: number | null;
  label: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    setImageUrl(null);

    let active = true;
    let objectUrl: string | null = null;

    const load = async () => {
      try {
        const response = await apiClient.get("/fleet/street-view", {
          params: {
            lat: lat.toString(),
            lng: lng.toString(),
            size: "600x320",
            heading: typeof heading === "number" ? heading.toString() : undefined
          },
          responseType: "blob"
        });

        if (!active) {
          return;
        }

        objectUrl = URL.createObjectURL(response.data as Blob);
        setImageUrl(objectUrl);
      } catch {
        if (active) {
          setHasError(true);
        }
      }
    };

    void load();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [heading, lat, lng]);

  if (hasError) {
    return <p className="fleet-street-view-fallback">Street View preview unavailable.</p>;
  }

  if (!imageUrl) {
    return <p className="fleet-street-view-fallback">Loading Street View preview...</p>;
  }

  return (
    <div className="fleet-street-view-shell">
      <img
        src={imageUrl}
        alt={label}
        loading="lazy"
        className="fleet-street-view-image"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

const FleetVehicleMarker = memo(function FleetVehicleMarker({
  marker,
  icon,
  onSelect,
  onHover,
  onHoverOut,
  onRouteUser,
  onRouteFuel,
  state,
  isCritical
}: {
  marker: FleetVehicle;
  icon: DivIcon;
  onSelect: (vehicleId: string) => void;
  onHover: (vehicleId: string) => void;
  onHoverOut: () => void;
  onRouteUser: (vehicle: FleetVehicle) => void;
  onRouteFuel: (vehicle: FleetVehicle) => void;
  state: OperationalState;
  isCritical: boolean;
}) {
  return (
    <Marker
      position={[marker.lat, marker.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(marker.vehicleId),
        mouseover: () => onHover(marker.vehicleId),
        mouseout: () => onHoverOut()
      }}
    >
      <Popup>
        <div className="fleet-popup-card">
          <div className="fleet-popup-header">
            <p className="fleet-popup-title">{marker.registrationNo}</p>
            <span
              className={`fleet-status-pill ${
                state === "MOVING" ? "fleet-state-moving" : state === "IDLE" ? "fleet-state-idle" : "fleet-state-offline"
              }`}
            >
              {state}
            </span>
          </div>

          <StreetViewPreview
            lat={marker.lat}
            lng={marker.lng}
            heading={marker.headingDegrees}
            label={`${marker.registrationNo} street view`}
          />

          <p className="fleet-popup-row">Driver: {marker.driverName}</p>
          <p className="fleet-popup-row">
            Speed: {marker.speedKph === null ? "N/A" : `${marker.speedKph.toFixed(1)} km/h`}
          </p>
          <p className="fleet-popup-row">Engine: {marker.intelligence.engineStatus}</p>
          <p className="fleet-popup-row">Idle: {marker.intelligence.idleStatus ? "Yes" : "No"}</p>
          <p className="fleet-popup-row">Fuel Level: {formatPercent(marker.intelligence.fuelLevel)}</p>
          <p className="fleet-popup-row">Battery: {formatVoltage(marker.intelligence.batteryVoltage)}</p>
          <p className="fleet-popup-row">Ignition On: {marker.intelligence.ignitionOnTime ? formatTimestamp(marker.intelligence.ignitionOnTime) : "N/A"}</p>
          <p className="fleet-popup-row">Last Updated: {formatTimestamp(marker.lastUpdated)}</p>
          {isCritical ? <p className="fleet-alert-critical">Critical alert active</p> : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onRouteUser(marker)}
              className="fleet-directions-btn"
            >
              Route User to Vehicle
            </button>
            <button
              type="button"
              onClick={() => onRouteFuel(marker)}
              className="fleet-directions-btn"
            >
              Route to Fuel
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

export function FleetMap() {
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const hasCenteredRef = useRef(false);
  const offlineAlertTrackerRef = useRef(new Map<string, number>());

  const [markerIcons, setMarkerIcons] = useState<MarkerIcons | null>(null);
  const [mapZoom, setMapZoom] = useState(8);
  const [clockTick, setClockTick] = useState(Date.now());

  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>("Detecting your location...");
  const [isLocating, setIsLocating] = useState(false);

  const [showFuelStations, setShowFuelStations] = useState(true);
  const [showGarages, setShowGarages] = useState(true);
  const [showFleetVehicles, setShowFleetVehicles] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [radiusKm, setRadiusKm] = useState(10);

  const [activeTab, setActiveTab] = useState<SidebarTab>("vehicles");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>("ALL");

  const [alertsOpen, setAlertsOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const [fuelStations, setFuelStations] = useState<NearbyPlace[]>([]);
  const [garages, setGarages] = useState<NearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [vehiclesById, setVehiclesById] = useState<Record<string, FleetVehicle>>({});

  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [geofences, setGeofences] = useState<FleetGeofence[]>([]);
  const [geofenceBusy, setGeofenceBusy] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("NONE");
  const [draftCircle, setDraftCircle] = useState<{ center: GeoPoint; radiusMeters: number } | null>(null);
  const [draftPolygon, setDraftPolygon] = useState<GeoPoint[]>([]);
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(250);
  const [geofenceName, setGeofenceName] = useState("");
  const [geofenceType, setGeofenceType] = useState<GeofenceType>("DEPOT");

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [hoveredVehicleId, setHoveredVehicleId] = useState<string | null>(null);
  const [followSelectedVehicle, setFollowSelectedVehicle] = useState(false);

  const [historyVehicleId, setHistoryVehicleId] = useState<string>("");
  const [historyFrom, setHistoryFrom] = useState(() =>
    new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [historyTo, setHistoryTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [routeLines, setRouteLines] = useState<RouteLine[]>([]);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const sortedPlaces = useMemo(
    () => [...fuelStations, ...garages].sort((left, right) => left.distanceKm - right.distanceKm),
    [fuelStations, garages]
  );

  const vehicles = useMemo(() => Object.values(vehiclesById), [vehiclesById]);

  const selectedVehicle = useMemo(
    () => (selectedVehicleId ? vehiclesById[selectedVehicleId] ?? null : null),
    [selectedVehicleId, vehiclesById]
  );

  const hoveredVehicle = useMemo(
    () => (hoveredVehicleId ? vehiclesById[hoveredVehicleId] ?? null : null),
    [hoveredVehicleId, vehiclesById]
  );

  const criticalVehicleIds = useMemo(() => {
    const cutOffMs = clockTick - 15 * 60 * 1000;
    const result = new Set<string>();

    for (const alert of alerts) {
      if (alert.severity !== "CRITICAL") {
        continue;
      }

      const createdMs = new Date(alert.createdAt).getTime();
      if (Number.isFinite(createdMs) && createdMs >= cutOffMs) {
        result.add(alert.vehicleId);
      }
    }

    return result;
  }, [alerts, clockTick]);

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const state = operationalStateForVehicle(vehicle, clockTick);
      const stateMatches = vehicleFilter === "ALL" ? true : toFilterState(state) === vehicleFilter;
      const searchMatches =
        normalizedSearch.length === 0
          ? true
          : vehicle.registrationNo.toLowerCase().includes(normalizedSearch) ||
            vehicle.driverName.toLowerCase().includes(normalizedSearch);

      return stateMatches && searchMatches;
    });
  }, [vehicles, clockTick, searchTerm, vehicleFilter]);

  const fleetStats = useMemo(() => {
    let moving = 0;
    let idle = 0;
    let offline = 0;

    for (const vehicle of vehicles) {
      const state = operationalStateForVehicle(vehicle, clockTick);
      if (state === "MOVING") {
        moving += 1;
      } else if (state === "IDLE") {
        idle += 1;
      } else {
        offline += 1;
      }
    }

    return {
      moving,
      idle,
      offline,
      total: vehicles.length
    };
  }, [vehicles, clockTick]);

  const driverStats = useMemo(() => {
    const index = new Map<string, { name: string; count: number; moving: number; idle: number; offline: number }>();

    for (const vehicle of vehicles) {
      const key = vehicle.driverName || "Unknown Driver";
      const previous =
        index.get(key) ??
        ({ name: key, count: 0, moving: 0, idle: 0, offline: 0 } as const);

      const state = operationalStateForVehicle(vehicle, clockTick);
      const next = {
        ...previous,
        count: previous.count + 1,
        moving: previous.moving + (state === "MOVING" ? 1 : 0),
        idle: previous.idle + (state === "IDLE" ? 1 : 0),
        offline: previous.offline + (state === "OFFLINE" ? 1 : 0)
      };

      index.set(key, next);
    }

    return Array.from(index.values()).sort((left, right) => right.count - left.count);
  }, [vehicles, clockTick]);

  const clusters = useMemo(
    () => clusterVehicles(filteredVehicles, mapZoom, criticalVehicleIds, clockTick),
    [filteredVehicles, mapZoom, criticalVehicleIds, clockTick]
  );

  const playbackPoint = useMemo(() => {
    if (historyPoints.length === 0) {
      return null;
    }

    const safeIndex = Math.min(playbackIndex, historyPoints.length - 1);
    return historyPoints[safeIndex] ?? null;
  }, [historyPoints, playbackIndex]);

  const nearestFuelForSelected = useMemo(() => {
    if (!selectedVehicle || fuelStations.length === 0) {
      return null;
    }

    const sorted = [...fuelStations].sort(
      (left, right) =>
        haversineDistanceKm({ lat: selectedVehicle.lat, lng: selectedVehicle.lng }, { lat: left.lat, lng: left.lng }) -
        haversineDistanceKm({ lat: selectedVehicle.lat, lng: selectedVehicle.lng }, { lat: right.lat, lng: right.lng })
    );

    return sorted[0] ?? null;
  }, [selectedVehicle, fuelStations]);

  const buildDivIcon = useCallback((html: string, size: [number, number], anchor: [number, number]) => {
    if (!leafletRef.current) {
      return null;
    }

    return leafletRef.current.divIcon({
      className: "fleet-custom-marker",
      html,
      iconSize: size,
      iconAnchor: anchor,
      popupAnchor: [0, -14]
    });
  }, []);

  const buildClusterIcon = useCallback(
    (count: number, hasCritical: boolean) => {
      const html = `<div class="fleet-cluster ${hasCritical ? "fleet-cluster-critical" : ""}">${count}</div>`;
      return buildDivIcon(html, [38, 38], [19, 19]);
    },
    [buildDivIcon]
  );

  const locateUser = useCallback(
    (recenterMap: boolean) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        setGeoStatus("Geolocation unavailable. Centered on Colombo.");
        setUserLocation(COLOMBO);
        if (mapRef.current && recenterMap) {
          mapRef.current.flyTo([COLOMBO.lat, COLOMBO.lng], 11, { duration: 1.1 });
        }
        return;
      }

      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          let next: GeoPoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          if (!isWithinSriLanka(next)) {
            next = COLOMBO;
            setGeoStatus("Location outside Sri Lanka detected. Centered on Colombo.");
          } else {
            setGeoStatus("Using your live location.");
          }

          setUserLocation(next);

          if (mapRef.current && recenterMap) {
            mapRef.current.flyTo([next.lat, next.lng], 12, { duration: 1.1 });
          }

          setIsLocating(false);
        },
        () => {
          setGeoStatus("Location permission denied. Centered on Colombo.");
          setUserLocation(COLOMBO);

          if (mapRef.current && recenterMap) {
            mapRef.current.flyTo([COLOMBO.lat, COLOMBO.lng], 11, { duration: 1.1 });
          }

          setIsLocating(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 0
        }
      );
    },
    []
  );

  const fetchFleetVehicles = useCallback(async () => {
    setFleetLoading(true);

    try {
      const response = await apiClient.get("/fleet/live-map");
      const rows = Array.isArray(response?.data?.data)
        ? (response.data.data as FleetApiLocation[])
        : [];

      const mapped = rows
        .map((row) => toFleetVehicle(row))
        .filter((row): row is FleetVehicle => Boolean(row));

      const nextIndex: Record<string, FleetVehicle> = {};
      mapped.forEach((vehicle) => {
        nextIndex[vehicle.vehicleId] = vehicle;
      });

      setVehiclesById(nextIndex);
      setFleetError(null);
    } catch {
      setFleetError("Unable to load fleet vehicles.");
    } finally {
      setFleetLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);

    try {
      const response = await apiClient.get("/fleet/alerts", { params: { limit: 100 } });
      const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
      const mapped = rows.map((row: unknown) => toAlert(row)).filter((row: FleetAlert | null): row is FleetAlert => Boolean(row));
      setAlerts(mapped);
    } catch {
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const fetchGeofences = useCallback(async () => {
    try {
      const response = await apiClient.get("/fleet/geofences");
      const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
      setGeofences(rows as FleetGeofence[]);
    } catch {
      setGeofences([]);
    }
  }, []);

  const fetchNearbyPlaces = useCallback(async (origin: GeoPoint, radius: number, signal: AbortSignal) => {
    setPlacesLoading(true);
    setPlacesError(null);

    const radiusMeters = Math.round(radius * 1000);
    const overpassQuery = `
[out:json][timeout:25];
(
  node["amenity"="fuel"](around:${radiusMeters},${origin.lat},${origin.lng});
  way["amenity"="fuel"](around:${radiusMeters},${origin.lat},${origin.lng});
  relation["amenity"="fuel"](around:${radiusMeters},${origin.lat},${origin.lng});
  node["shop"="car_repair"](around:${radiusMeters},${origin.lat},${origin.lng});
  way["shop"="car_repair"](around:${radiusMeters},${origin.lat},${origin.lng});
  relation["shop"="car_repair"](around:${radiusMeters},${origin.lat},${origin.lng});
  node["amenity"="car_repair"](around:${radiusMeters},${origin.lat},${origin.lng});
  way["amenity"="car_repair"](around:${radiusMeters},${origin.lat},${origin.lng});
  relation["amenity"="car_repair"](around:${radiusMeters},${origin.lat},${origin.lng});
);
out center tags;
`;

    try {
      const response = await fetch(OVERPASS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8"
        },
        body: overpassQuery,
        signal
      });

      if (!response.ok) {
        throw new Error("Failed to fetch nearby places");
      }

      const data = (await response.json()) as OverpassResponse;
      const unique = new Set<string>();
      const parsedPlaces: NearbyPlace[] = [];

      for (const element of data.elements ?? []) {
        const tags = element.tags ?? {};
        const isFuel = tags.amenity === "fuel";
        const isGarage = tags.shop === "car_repair" || tags.amenity === "car_repair";

        if (!isFuel && !isGarage) {
          continue;
        }

        const coords = getOverpassCoordinates(element);
        if (!coords || !isWithinSriLanka(coords)) {
          continue;
        }

        const category: NearbyCategory = isFuel ? "fuel" : "garage";
        const id = `${element.type}-${element.id}-${category}`;
        if (unique.has(id)) {
          continue;
        }

        unique.add(id);
        const distanceKm = haversineDistanceKm(origin, coords);
        const ratingCandidate = toOptionalNumber(tags.rating ?? tags.stars);

        parsedPlaces.push({
          id,
          category,
          name: tags.name ?? (category === "fuel" ? "Fuel Station" : "Auto Repair Shop"),
          address: buildAddress(tags),
          lat: coords.lat,
          lng: coords.lng,
          distanceKm,
          openingHours: tags.opening_hours,
          rating: ratingCandidate ?? undefined
        });
      }

      const sortedFuel = parsedPlaces
        .filter((item) => item.category === "fuel")
        .sort((left, right) => left.distanceKm - right.distanceKm);

      const nearestIds = new Set(sortedFuel.slice(0, 3).map((item) => item.id));
      const annotatedFuel = sortedFuel.map((station) => ({
        ...station,
        isNearest: nearestIds.has(station.id)
      }));

      const sortedGarages = parsedPlaces
        .filter((item) => item.category === "garage")
        .sort((left, right) => left.distanceKm - right.distanceKm);

      setFuelStations(annotatedFuel);
      setGarages(sortedGarages);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setPlacesError("Unable to load nearby fuel stations and garages.");
      }
    } finally {
      setPlacesLoading(false);
    }
  }, []);

  const handleSocketLocationUpdated = useCallback((payload: unknown) => {
    const mapped = toFleetVehicle(payload as FleetApiLocation);
    if (!mapped) {
      return;
    }

    setVehiclesById((current) => {
      const existing = current[mapped.vehicleId];
      const merged = mergeVehicle(existing, mapped);

      if (existing && isSameVehicleSnapshot(existing, merged)) {
        return current;
      }

      return {
        ...current,
        [mapped.vehicleId]: merged
      };
    });
  }, []);

  const handleSocketAlertCreated = useCallback((payload: unknown) => {
    const mapped = toAlert(payload);
    if (!mapped) {
      return;
    }

    setAlerts((current) => sortedUniqueAlerts(current, [mapped]));
    setUnreadAlerts((current) => current + 1);
  }, []);

  useFleetSocket({
    onLocationUpdated: handleSocketLocationUpdated,
    onAlertCreated: handleSocketAlertCreated
  });

  const resolveVehicleIcon = useCallback(
    (vehicle: FleetVehicle) => {
      if (!markerIcons) {
        return null;
      }

      const state = operationalStateForVehicle(vehicle, clockTick);
      const isCritical = criticalVehicleIds.has(vehicle.vehicleId);

      if (isCritical) {
        return markerIcons.critical;
      }

      if (state === "OFFLINE") {
        return markerIcons.offline;
      }

      if (state === "IDLE") {
        return markerIcons.idle;
      }

      return markerIcons.moving;
    },
    [markerIcons, criticalVehicleIds, clockTick]
  );

  const requestRoute = useCallback(
    async (input: {
      id: string;
      label: string;
      color: string;
      from: GeoPoint;
      to: GeoPoint;
      replaceGroup: "user-vehicle" | "vehicle-fuel";
    }) => {
      setRouteBusy(true);
      setRouteError(null);

      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${input.from.lng},${input.from.lat};${input.to.lng},${input.to.lat}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch route");
        }

        const data = await response.json();
        const route = Array.isArray(data.routes) ? data.routes[0] : null;
        if (!route || !route.geometry || !Array.isArray(route.geometry.coordinates)) {
          throw new Error("No route available");
        }

        const points = route.geometry.coordinates
          .map((item: [number, number]) => [item[1], item[0]] as [number, number]);

        const next: RouteLine = {
          id: input.id,
          label: input.label,
          color: input.color,
          points,
          distanceKm: Number(route.distance ?? 0) / 1000,
          durationMin: Number(route.duration ?? 0) / 60
        };

        setRouteLines((current) => {
          const filtered = current.filter((line) => !line.id.startsWith(input.replaceGroup));
          return [...filtered, next];
        });

        if (mapRef.current && points.length > 1) {
          mapRef.current.fitBounds(points, {
            padding: [40, 40]
          });
        }
      } catch {
        setRouteError("Unable to fetch route directions.");
      } finally {
        setRouteBusy(false);
      }
    },
    []
  );

  const handleRouteUserToVehicle = useCallback(
    (vehicle: FleetVehicle) => {
      if (!userLocation) {
        setRouteError("User location is required for this route.");
        return;
      }

      void requestRoute({
        id: `user-vehicle-${vehicle.vehicleId}`,
        label: `You -> ${vehicle.registrationNo}`,
        color: "#0ea5e9",
        from: userLocation,
        to: { lat: vehicle.lat, lng: vehicle.lng },
        replaceGroup: "user-vehicle"
      });
    },
    [requestRoute, userLocation]
  );

  const handleRouteVehicleToFuel = useCallback(
    (vehicle: FleetVehicle) => {
      const nearestFuel = [...fuelStations].sort(
        (left, right) =>
          haversineDistanceKm({ lat: vehicle.lat, lng: vehicle.lng }, { lat: left.lat, lng: left.lng }) -
          haversineDistanceKm({ lat: vehicle.lat, lng: vehicle.lng }, { lat: right.lat, lng: right.lng })
      )[0];

      if (!nearestFuel) {
        setRouteError("No nearby fuel station available for routing.");
        return;
      }

      void requestRoute({
        id: `vehicle-fuel-${vehicle.vehicleId}`,
        label: `${vehicle.registrationNo} -> ${nearestFuel.name}`,
        color: "#10b981",
        from: { lat: vehicle.lat, lng: vehicle.lng },
        to: { lat: nearestFuel.lat, lng: nearestFuel.lng },
        replaceGroup: "vehicle-fuel"
      });
    },
    [fuelStations, requestRoute]
  );

  const handleMapClickForDrawing = useCallback((lat: number, lng: number) => {
    if (drawingMode === "NONE") {
      return;
    }

    if (drawingMode === "CIRCLE") {
      setDraftCircle({
        center: { lat, lng },
        radiusMeters: geofenceRadiusMeters
      });
      return;
    }

    setDraftPolygon((current) => [...current, { lat, lng }]);
  }, [drawingMode, geofenceRadiusMeters]);

  const handleMapReady = useCallback((event: { target: LeafletMap }) => {
    mapRef.current = event.target;
    mapRef.current.fitBounds(SRI_LANKA_BOUNDS, {
      padding: [24, 24]
    });

    setMapZoom(mapRef.current.getZoom());

    mapRef.current.on("zoomend", () => {
      if (mapRef.current) {
        setMapZoom(mapRef.current.getZoom());
      }
    });

    mapRef.current.on("click", (leafletEvent: any) => {
      if (!leafletEvent?.latlng) {
        return;
      }

      handleMapClickForDrawing(leafletEvent.latlng.lat, leafletEvent.latlng.lng);
    });
  }, [handleMapClickForDrawing]);

  const saveDraftGeofence = useCallback(async () => {
    if (drawingMode === "NONE") {
      return;
    }

    if (!geofenceName.trim()) {
      return;
    }

    setGeofenceBusy(true);

    try {
      if (drawingMode === "CIRCLE") {
        if (!draftCircle?.center) {
          return;
        }

        await apiClient.post("/fleet/geofences", {
          name: geofenceName.trim(),
          type: geofenceType,
          shape: "CIRCLE",
          center: draftCircle.center,
          radiusMeters: geofenceRadiusMeters
        });
      }

      if (drawingMode === "POLYGON") {
        if (draftPolygon.length < 3) {
          return;
        }

        await apiClient.post("/fleet/geofences", {
          name: geofenceName.trim(),
          type: geofenceType,
          shape: "POLYGON",
          points: draftPolygon
        });
      }

      await fetchGeofences();
      setDrawingMode("NONE");
      setDraftCircle(null);
      setDraftPolygon([]);
      setGeofenceName("");
    } finally {
      setGeofenceBusy(false);
    }
  }, [draftCircle, draftPolygon, drawingMode, fetchGeofences, geofenceName, geofenceRadiusMeters, geofenceType]);

  const removeGeofence = useCallback(async (id: string) => {
    setGeofenceBusy(true);
    try {
      await apiClient.delete(`/fleet/geofences/${id}`);
      await fetchGeofences();
    } finally {
      setGeofenceBusy(false);
    }
  }, [fetchGeofences]);

  const fetchHistory = useCallback(async () => {
    if (!historyVehicleId) {
      setHistoryPoints([]);
      return;
    }

    setHistoryLoading(true);
    setIsPlayingHistory(false);

    try {
      const response = await apiClient.get(`/vehicles/${historyVehicleId}/history`, {
        params: {
          from: historyFrom ? new Date(historyFrom).toISOString() : undefined,
          to: historyTo ? new Date(historyTo).toISOString() : undefined,
          limit: 4000
        }
      });

      const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
      const points = rows
        .map((row: any): HistoryPoint | null => {
          const lat = toFiniteNumber(row.latitude);
          const lng = toFiniteNumber(row.longitude);
          if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return null;
          }

          return {
            id: String(row.id ?? `${row.timestamp ?? ""}-${lat}-${lng}`),
            lat,
            lng,
            speedKph: toOptionalNumber(row.speed),
            headingDegrees: toOptionalNumber(row.heading),
            timestamp: String(row.timestamp ?? new Date().toISOString())
          };
        })
        .filter((item: HistoryPoint | null): item is HistoryPoint => Boolean(item));

      setHistoryPoints(points);
      setPlaybackIndex(0);

      if (mapRef.current && points.length > 1) {
        mapRef.current.fitBounds(
          points.map((point: HistoryPoint) => [point.lat, point.lng] as [number, number]),
          { padding: [35, 35] }
        );
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [historyVehicleId, historyFrom, historyTo]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    import("leaflet")
      .then((leaflet) => {
        if (!active) {
          return;
        }

        leafletRef.current = leaflet;

        const user = buildDivIcon(
          '<div class="fleet-user-dot"><span class="fleet-user-pulse"></span><span class="fleet-user-core"></span></div>',
          [24, 24],
          [12, 12]
        );
        const fuel = buildDivIcon('<div class="fleet-dot fleet-dot-fuel"></div>', [24, 24], [12, 12]);
        const nearestFuel = buildDivIcon('<div class="fleet-dot fleet-dot-nearest">N</div>', [24, 24], [12, 12]);
        const garage = buildDivIcon('<div class="fleet-dot fleet-dot-garage"></div>', [24, 24], [12, 12]);
        const moving = buildDivIcon('<div class="fleet-dot fleet-dot-moving"></div>', [26, 26], [13, 13]);
        const idle = buildDivIcon('<div class="fleet-dot fleet-dot-idle"></div>', [26, 26], [13, 13]);
        const offline = buildDivIcon('<div class="fleet-dot fleet-dot-offline"></div>', [26, 26], [13, 13]);
        const critical = buildDivIcon('<div class="fleet-dot fleet-dot-critical"><span class="fleet-marker-pulse"></span></div>', [30, 30], [15, 15]);
        const playback = buildDivIcon('<div class="fleet-dot fleet-dot-playback"></div>', [24, 24], [12, 12]);

        if (!user || !fuel || !nearestFuel || !garage || !moving || !idle || !offline || !critical || !playback) {
          setMarkerIcons(null);
          return;
        }

        setMarkerIcons({
          user,
          fuel,
          nearestFuel,
          garage,
          moving,
          idle,
          offline,
          critical,
          playback
        });
      })
      .catch(() => {
        setMarkerIcons(null);
      });

    return () => {
      active = false;
    };
  }, [buildDivIcon]);

  useEffect(() => {
    locateUser(false);
    void Promise.all([fetchFleetVehicles(), fetchAlerts(), fetchGeofences()]);
  }, [locateUser, fetchFleetVehicles, fetchAlerts, fetchGeofences]);

  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      const first = vehicles[0];
      setSelectedVehicleId(first.vehicleId);
      setHistoryVehicleId(first.vehicleId);
    }
  }, [vehicles, selectedVehicleId]);

  useEffect(() => {
    if (!userLocation) {
      return;
    }

    if (mapRef.current && !hasCenteredRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 11);
      hasCenteredRef.current = true;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchNearbyPlaces(userLocation, radiusKm, controller.signal);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [userLocation, radiusKm, fetchNearbyPlaces]);

  useEffect(() => {
    if (!followSelectedVehicle || !selectedVehicle || !mapRef.current) {
      return;
    }

    mapRef.current.flyTo([selectedVehicle.lat, selectedVehicle.lng], Math.max(12, mapRef.current.getZoom()), {
      duration: 0.65
    });
  }, [followSelectedVehicle, selectedVehicle]);

  useEffect(() => {
    if (!isPlayingHistory || historyPoints.length < 2) {
      return;
    }

    const interval = window.setInterval(() => {
      setPlaybackIndex((current) => {
        if (current >= historyPoints.length - 1) {
          setIsPlayingHistory(false);
          return current;
        }

        return Math.min(historyPoints.length - 1, current + 1);
      });
    }, Math.max(120, Math.floor(1000 / playbackRate)));

    return () => {
      window.clearInterval(interval);
    };
  }, [historyPoints.length, isPlayingHistory, playbackRate]);

  useEffect(() => {
    if (!isPlayingHistory || !playbackPoint || !mapRef.current) {
      return;
    }

    mapRef.current.panTo([playbackPoint.lat, playbackPoint.lng], {
      animate: true,
      duration: 0.6
    });
  }, [isPlayingHistory, playbackPoint]);

  useEffect(() => {
    const newOfflineAlerts: FleetAlert[] = [];

    for (const vehicle of vehicles) {
      const state = operationalStateForVehicle(vehicle, clockTick);
      if (state !== "OFFLINE") {
        continue;
      }

      const lastRaised = offlineAlertTrackerRef.current.get(vehicle.vehicleId) ?? 0;
      if (clockTick - lastRaised < LOCAL_OFFLINE_ALERT_THROTTLE_MS) {
        continue;
      }

      offlineAlertTrackerRef.current.set(vehicle.vehicleId, clockTick);

      newOfflineAlerts.push({
        id: `local-offline-${vehicle.vehicleId}-${clockTick}`,
        type: "DEVICE_OFFLINE",
        severity: "CRITICAL",
        vehicleId: vehicle.vehicleId,
        registrationNo: vehicle.registrationNo,
        message: `${vehicle.registrationNo} appears offline on the client monitor.`,
        createdAt: new Date(clockTick).toISOString()
      });
    }

    if (newOfflineAlerts.length > 0) {
      setAlerts((current) => sortedUniqueAlerts(current, newOfflineAlerts));
      setUnreadAlerts((current) => current + newOfflineAlerts.length);
    }
  }, [vehicles, clockTick]);

  const desktopSidebarContent = (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <p className="text-sm font-semibold text-slate-900">Fleet Operations</p>
        <button
          type="button"
          onClick={() => setAlertsOpen(false)}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          <X size={12} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 px-2 py-2">
        <button
          type="button"
          onClick={() => setActiveTab("vehicles")}
          className={`fleet-tab-btn ${activeTab === "vehicles" ? "fleet-tab-btn-active" : ""}`}
        >
          <Car size={14} /> Vehicles
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("drivers")}
          className={`fleet-tab-btn ${activeTab === "drivers" ? "fleet-tab-btn-active" : ""}`}
        >
          <Users size={14} /> Drivers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`fleet-tab-btn ${activeTab === "alerts" ? "fleet-tab-btn-active" : ""}`}
        >
          <Bell size={14} /> Alerts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("nearby")}
          className={`fleet-tab-btn ${activeTab === "nearby" ? "fleet-tab-btn-active" : ""}`}
        >
          <Layers size={14} /> Nearby
        </button>
      </div>

      {activeTab === "vehicles" ? (
        <div className="space-y-3 px-2 pb-3">
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search registration / driver"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2 text-xs outline-none focus:border-sky-400"
            />
          </label>

          <div className="grid grid-cols-4 gap-1">
            {(["ALL", "MOVING", "IDLE", "OFFLINE"] as VehicleFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setVehicleFilter(filter)}
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                  vehicleFilter === filter
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {filteredVehicles.length === 0 ? (
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
                No vehicles match current filters.
              </li>
            ) : (
              filteredVehicles.map((vehicle) => {
                const state = operationalStateForVehicle(vehicle, clockTick);
                const stateClass =
                  state === "MOVING"
                    ? "bg-emerald-100 text-emerald-700"
                    : state === "IDLE"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-200 text-slate-700";

                return (
                  <li
                    key={vehicle.vehicleId}
                    className={`group rounded-lg border p-2 transition ${
                      selectedVehicleId === vehicle.vehicleId
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicleId(vehicle.vehicleId);
                        setHistoryVehicleId(vehicle.vehicleId);
                        if (mapRef.current) {
                          mapRef.current.flyTo([vehicle.lat, vehicle.lng], Math.max(12, mapRef.current.getZoom()), {
                            duration: 0.65
                          });
                        }
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-slate-900">{vehicle.registrationNo}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateClass}`}>{state}</span>
                      </div>
                      <p className="truncate text-[11px] text-slate-500">{vehicle.driverName}</p>
                      <p className="text-[11px] text-slate-500">
                        Speed: {vehicle.speedKph === null ? "N/A" : `${vehicle.speedKph.toFixed(1)} km/h`}
                      </p>
                    </button>

                    <div className="mt-2 hidden rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-600 group-hover:block">
                      <p>Engine: {vehicle.intelligence.engineStatus}</p>
                      <p>Fuel: {formatPercent(vehicle.intelligence.fuelLevel)}</p>
                      <p>Battery: {formatVoltage(vehicle.intelligence.batteryVoltage)}</p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}

      {activeTab === "drivers" ? (
        <div className="space-y-2 px-2 pb-3">
          {driverStats.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
              Driver stats are unavailable.
            </p>
          ) : (
            driverStats.map((driver) => (
              <div key={driver.name} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
                <p className="truncate font-semibold text-slate-900">{driver.name}</p>
                <p className="text-slate-500">Vehicles: {driver.count}</p>
                <p className="text-emerald-600">Moving: {driver.moving}</p>
                <p className="text-amber-600">Idle: {driver.idle}</p>
                <p className="text-slate-600">Offline: {driver.offline}</p>
              </div>
            ))
          )}
        </div>
      ) : null}

      {activeTab === "alerts" ? (
        <div className="space-y-2 px-2 pb-3">
          {alertsLoading ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">No active alerts.</p>
          ) : (
            alerts.slice(0, 60).map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border px-2 py-2 text-xs ${
                  alert.severity === "CRITICAL"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : alert.severity === "WARNING"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-sky-200 bg-sky-50 text-sky-700"
                }`}
              >
                <p className="font-semibold">{alert.type.replaceAll("_", " ")}</p>
                <p>{alert.message}</p>
                <p className="mt-1 text-[10px] opacity-80">{formatTimestamp(alert.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      ) : null}

      {activeTab === "nearby" ? (
        <div className="space-y-2 px-2 pb-3">
          {sortedPlaces.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
              No nearby fuel stations or garages in this radius.
            </p>
          ) : (
            sortedPlaces.map((place) => (
              <div key={place.id} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-slate-900">{place.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      place.category === "fuel" ? "bg-orange-100 text-orange-700" : "bg-violet-100 text-violet-700"
                    }`}
                  >
                    {place.category === "fuel" ? "Fuel" : "Garage"}
                  </span>
                </div>
                <p className="truncate text-slate-500">{place.address}</p>
                <p className="text-slate-600">{formatDistance(place.distanceKm)}</p>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="relative h-[calc(100vh-8.5rem)] min-h-[620px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
      <MapContainer
        center={[COLOMBO.lat, COLOMBO.lng]}
        zoom={8}
        className="fleet-live-map h-full w-full"
        maxBounds={SRI_LANKA_BOUNDS}
        maxBoundsViscosity={1}
        whenReady={handleMapReady}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routeLines.map((route) => (
          <Polyline
            key={route.id}
            positions={route.points}
            pathOptions={{ color: route.color, weight: 4, opacity: 0.86 }}
          />
        ))}

        {historyPoints.length > 1 ? (
          <Polyline
            positions={historyPoints.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: "#1d4ed8", weight: 4, opacity: 0.55, dashArray: "8 8" }}
          />
        ) : null}

        {markerIcons && playbackPoint ? (
          <Marker
            position={[playbackPoint.lat, playbackPoint.lng]}
            icon={markerIcons.playback}
          >
            <Popup>
              <div className="fleet-popup-card">
                <p className="fleet-popup-title">Route Playback</p>
                <p className="fleet-popup-row">Timestamp: {formatTimestamp(playbackPoint.timestamp)}</p>
                <p className="fleet-popup-row">
                  Speed: {playbackPoint.speedKph === null ? "N/A" : `${playbackPoint.speedKph.toFixed(1)} km/h`}
                </p>
              </div>
            </Popup>
          </Marker>
        ) : null}

        {showGeofences
          ? geofences.map((zone) => {
              if (zone.shape === "CIRCLE" && zone.center && zone.radiusMeters) {
                return (
                  <CircleMarker
                    key={zone.id}
                    center={[zone.center.lat, zone.center.lng]}
                    radius={zone.radiusMeters}
                    pathOptions={{
                      color: zone.type === "RESTRICTED" ? "#ef4444" : zone.type === "DEPOT" ? "#0ea5e9" : "#14b8a6",
                      fillOpacity: 0.12,
                      weight: 2
                    }}
                  >
                    <Popup>
                      <div className="fleet-popup-card">
                        <p className="fleet-popup-title">{zone.name}</p>
                        <p className="fleet-popup-row">Type: {zone.type}</p>
                        <p className="fleet-popup-row">Shape: Circle</p>
                        <p className="fleet-popup-row">Radius: {zone.radiusMeters}m</p>
                        <button
                          type="button"
                          onClick={() => void removeGeofence(zone.id)}
                          className="fleet-danger-btn"
                        >
                          <Trash2 size={12} /> Remove Zone
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              }

              if (zone.shape === "POLYGON" && zone.points && zone.points.length >= 3) {
                return (
                  <Polygon
                    key={zone.id}
                    positions={zone.points.map((point) => [point.lat, point.lng])}
                    pathOptions={{
                      color: zone.type === "RESTRICTED" ? "#ef4444" : zone.type === "DEPOT" ? "#0ea5e9" : "#14b8a6",
                      fillOpacity: 0.14,
                      weight: 2
                    }}
                  >
                    <Popup>
                      <div className="fleet-popup-card">
                        <p className="fleet-popup-title">{zone.name}</p>
                        <p className="fleet-popup-row">Type: {zone.type}</p>
                        <p className="fleet-popup-row">Shape: Polygon ({zone.points.length} points)</p>
                        <button
                          type="button"
                          onClick={() => void removeGeofence(zone.id)}
                          className="fleet-danger-btn"
                        >
                          <Trash2 size={12} /> Remove Zone
                        </button>
                      </div>
                    </Popup>
                  </Polygon>
                );
              }

              return null;
            })
          : null}

        {drawingMode === "CIRCLE" && draftCircle ? (
          <CircleMarker
            center={[draftCircle.center.lat, draftCircle.center.lng]}
            radius={draftCircle.radiusMeters}
            pathOptions={{ color: "#6366f1", fillOpacity: 0.12, weight: 2, dashArray: "6 6" }}
          />
        ) : null}

        {drawingMode === "POLYGON" && draftPolygon.length >= 2 ? (
          <Polygon
            positions={draftPolygon.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: "#6366f1", fillOpacity: 0.08, weight: 2, dashArray: "6 6" }}
          />
        ) : null}

        {markerIcons && userLocation ? (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={markerIcons.user}>
            <Popup>
              <div className="fleet-popup-card">
                <p className="fleet-popup-title">Your Location</p>
                <p className="fleet-popup-row">
                  {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                </p>
                <p className="fleet-popup-row">{geoStatus}</p>
              </div>
            </Popup>
          </Marker>
        ) : null}

        {markerIcons && showFuelStations
          ? fuelStations.map((station) => (
              <Marker
                key={station.id}
                position={[station.lat, station.lng]}
                icon={station.isNearest ? markerIcons.nearestFuel : markerIcons.fuel}
              >
                <Popup>
                  <div className="fleet-popup-card">
                    <div className="fleet-popup-header">
                      <p className="fleet-popup-title">{station.name}</p>
                      {station.isNearest ? <span className="fleet-badge">Nearest</span> : null}
                    </div>
                    <StreetViewPreview lat={station.lat} lng={station.lng} label={`${station.name} street view`} />
                    <p className="fleet-popup-row">{station.address}</p>
                    <p className="fleet-popup-row">Distance: {formatDistance(station.distanceKm)}</p>
                  </div>
                </Popup>
              </Marker>
            ))
          : null}

        {markerIcons && showGarages
          ? garages.map((garage) => (
              <Marker key={garage.id} position={[garage.lat, garage.lng]} icon={markerIcons.garage}>
                <Popup>
                  <div className="fleet-popup-card">
                    <p className="fleet-popup-title">{garage.name}</p>
                    <StreetViewPreview lat={garage.lat} lng={garage.lng} label={`${garage.name} street view`} />
                    <p className="fleet-popup-row">{garage.address}</p>
                    <p className="fleet-popup-row">Distance: {formatDistance(garage.distanceKm)}</p>
                    <p className="fleet-popup-row">Rating: {garage.rating ? garage.rating.toFixed(1) : "Not listed"}</p>
                    {userLocation ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${garage.lat},${garage.lng}&travelmode=driving`}
                        target="_blank"
                        rel="noreferrer"
                        className="fleet-directions-btn"
                      >
                        Get Directions
                      </a>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            ))
          : null}

        {markerIcons && showFleetVehicles
          ? clusters.map((cluster) => {
              if (cluster.vehicles.length === 1) {
                const vehicle = cluster.vehicles[0];
                const icon = resolveVehicleIcon(vehicle);
                if (!icon) {
                  return null;
                }

                return (
                  <FleetVehicleMarker
                    key={`vehicle-${vehicle.vehicleId}`}
                    marker={vehicle}
                    icon={icon}
                    onSelect={(vehicleId) => {
                      setSelectedVehicleId(vehicleId);
                      setHistoryVehicleId(vehicleId);
                    }}
                    onHover={setHoveredVehicleId}
                    onHoverOut={() => setHoveredVehicleId(null)}
                    onRouteUser={handleRouteUserToVehicle}
                    onRouteFuel={handleRouteVehicleToFuel}
                    state={operationalStateForVehicle(vehicle, clockTick)}
                    isCritical={criticalVehicleIds.has(vehicle.vehicleId)}
                  />
                );
              }

              const clusterIcon = buildClusterIcon(cluster.vehicles.length, cluster.hasCritical);
              if (!clusterIcon) {
                return null;
              }

              return (
                <Marker
                  key={`cluster-${cluster.key}`}
                  position={[cluster.lat, cluster.lng]}
                  icon={clusterIcon}
                  eventHandlers={{
                    click: () => {
                      if (mapRef.current) {
                        mapRef.current.flyTo(
                          [cluster.lat, cluster.lng],
                          Math.min(15, (mapRef.current.getZoom() ?? 8) + 2),
                          { duration: 0.55 }
                        );
                      }
                    }
                  }}
                >
                  <Popup>
                    <div className="fleet-popup-card">
                      <p className="fleet-popup-title">{cluster.vehicles.length} vehicles in this area</p>
                      <ul className="max-h-36 overflow-y-auto pr-1 text-xs text-slate-600">
                        {cluster.vehicles.slice(0, 12).map((vehicle) => (
                          <li key={vehicle.vehicleId} className="flex items-center justify-between gap-2 py-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVehicleId(vehicle.vehicleId);
                                setHistoryVehicleId(vehicle.vehicleId);
                                if (mapRef.current) {
                                  mapRef.current.flyTo([vehicle.lat, vehicle.lng], Math.max(12, mapRef.current.getZoom()), {
                                    duration: 0.6
                                  });
                                }
                              }}
                              className="truncate text-left text-xs font-medium text-sky-700 hover:underline"
                            >
                              {vehicle.registrationNo}
                            </button>
                            <span className="text-[10px] text-slate-500">
                              {operationalStateForVehicle(vehicle, clockTick)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Popup>
                </Marker>
              );
            })
          : null}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[850] flex justify-center">
        <div className="pointer-events-auto rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
          {geoStatus}
          {placesLoading ? " | Searching nearby places..." : ""}
          {fleetLoading ? " | Loading fleet markers..." : ""}
          {historyLoading ? " | Loading route history..." : ""}
          {placesError ? ` | ${placesError}` : ""}
          {fleetError ? ` | ${fleetError}` : ""}
          {routeError ? ` | ${routeError}` : ""}
        </div>
      </div>

      <div className="absolute left-3 top-16 z-[900] hidden h-[calc(100%-5rem)] w-[360px] rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur lg:block">
        {desktopSidebarContent}
      </div>

      <div className="absolute bottom-3 left-3 right-3 z-[900] lg:hidden">
        <div className="rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileSheetOpen((current) => !current)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-slate-800"
          >
            <span>Fleet Controls</span>
            <span>{mobileSheetOpen ? "Hide" : "Show"}</span>
          </button>
          {mobileSheetOpen ? <div className="max-h-[58vh] overflow-y-auto">{desktopSidebarContent}</div> : null}
        </div>
      </div>

      <div className="absolute right-3 top-16 z-[900] w-[340px] max-w-[calc(100%-1.5rem)] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Fleet Controls</h3>
          <button
            type="button"
            onClick={() => locateUser(true)}
            disabled={isLocating}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LocateFixed size={12} />
            {isLocating ? "Locating" : "Locate"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <label className="fleet-check-row">
            <input
              type="checkbox"
              checked={showFuelStations}
              onChange={(event) => setShowFuelStations(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Fuel Stations
          </label>
          <label className="fleet-check-row">
            <input
              type="checkbox"
              checked={showGarages}
              onChange={(event) => setShowGarages(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Garages
          </label>
          <label className="fleet-check-row">
            <input
              type="checkbox"
              checked={showFleetVehicles}
              onChange={(event) => setShowFleetVehicles(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Fleet Vehicles
          </label>
          <label className="fleet-check-row">
            <input
              type="checkbox"
              checked={showGeofences}
              onChange={(event) => setShowGeofences(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Geofences
          </label>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
            <span>Nearby Radius</span>
            <span className="font-semibold text-slate-900">{radiusKm} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value))}
            className="w-full accent-sky-500"
          />
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <p className="font-semibold text-slate-800">Auto-follow</p>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={followSelectedVehicle}
                onChange={(event) => setFollowSelectedVehicle(event.target.checked)}
              />
              Follow selected
            </label>
          </div>
          <p className="text-slate-600">
            Selected: {selectedVehicle ? selectedVehicle.registrationNo : "None"}
          </p>
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-slate-800">Route Playback</p>
            <button
              type="button"
              onClick={() => {
                setHistoryPoints([]);
                setIsPlayingHistory(false);
                setPlaybackIndex(0);
              }}
              className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
            >
              Clear
            </button>
          </div>

          <select
            value={historyVehicleId}
            onChange={(event) => setHistoryVehicleId(event.target.value)}
            className="mb-2 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          >
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
                {vehicle.registrationNo}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={historyFrom}
              onChange={(event) => setHistoryFrom(event.target.value)}
              className="rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
            />
            <input
              type="datetime-local"
              value={historyTo}
              onChange={(event) => setHistoryTo(event.target.value)}
              className="rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchHistory()}
              disabled={historyLoading || !historyVehicleId}
              className="rounded bg-slate-900 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Load Route
            </button>
            <button
              type="button"
              onClick={() => setIsPlayingHistory((current) => !current)}
              disabled={historyPoints.length < 2}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 disabled:opacity-60"
            >
              {isPlayingHistory ? <Pause size={12} /> : <Play size={12} />}
              {isPlayingHistory ? "Pause" : "Play"}
            </button>

            <select
              value={playbackRate}
              onChange={(event) => setPlaybackRate(Number(event.target.value))}
              className="rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
            </select>
          </div>

          {historyPoints.length > 0 ? (
            <div className="mt-2 space-y-1">
              <input
                type="range"
                min={0}
                max={Math.max(0, historyPoints.length - 1)}
                value={Math.min(playbackIndex, historyPoints.length - 1)}
                onChange={(event) => {
                  setPlaybackIndex(Number(event.target.value));
                  setIsPlayingHistory(false);
                }}
                className="w-full accent-sky-500"
              />
              <p className="text-[11px] text-slate-600">
                Point {Math.min(playbackIndex + 1, historyPoints.length)} / {historyPoints.length}
              </p>
              {playbackPoint ? (
                <p className="text-[11px] text-slate-600">
                  Speed: {playbackPoint.speedKph === null ? "N/A" : `${playbackPoint.speedKph.toFixed(1)} km/h`}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-slate-800">Geofencing</p>
            <button
              type="button"
              onClick={() => {
                setDrawingMode("NONE");
                setDraftCircle(null);
                setDraftPolygon([]);
              }}
              className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
            >
              Cancel Draft
            </button>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDrawingMode("CIRCLE")}
              className={`rounded border px-2 py-1.5 text-xs ${
                drawingMode === "CIRCLE"
                  ? "border-sky-300 bg-sky-50 text-sky-700"
                  : "border-slate-200 text-slate-700"
              }`}
            >
              <Circle size={12} className="mr-1 inline" /> Circle
            </button>
            <button
              type="button"
              onClick={() => setDrawingMode("POLYGON")}
              className={`rounded border px-2 py-1.5 text-xs ${
                drawingMode === "POLYGON"
                  ? "border-sky-300 bg-sky-50 text-sky-700"
                  : "border-slate-200 text-slate-700"
              }`}
            >
              <Plus size={12} className="mr-1 inline" /> Polygon
            </button>
          </div>

          <input
            value={geofenceName}
            onChange={(event) => setGeofenceName(event.target.value)}
            placeholder="Zone name"
            className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
          />

          <select
            value={geofenceType}
            onChange={(event) => setGeofenceType(event.target.value as GeofenceType)}
            className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
          >
            <option value="DEPOT">Depot</option>
            <option value="RESTRICTED">Restricted</option>
            <option value="CUSTOMER">Customer</option>
          </select>

          {drawingMode === "CIRCLE" ? (
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                <span>Radius</span>
                <span>{geofenceRadiusMeters}m</span>
              </div>
              <input
                type="range"
                min={50}
                max={3000}
                step={25}
                value={geofenceRadiusMeters}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setGeofenceRadiusMeters(next);
                  setDraftCircle((current) =>
                    current
                      ? {
                          ...current,
                          radiusMeters: next
                        }
                      : current
                  );
                }}
                className="w-full accent-indigo-500"
              />
            </div>
          ) : null}

          {drawingMode === "POLYGON" ? (
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
              <span>{draftPolygon.length} point(s)</span>
              <button
                type="button"
                onClick={() => setDraftPolygon((current) => current.slice(0, -1))}
                disabled={draftPolygon.length === 0}
                className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 disabled:opacity-50"
              >
                Undo Point
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void saveDraftGeofence()}
            disabled={
              geofenceBusy ||
              drawingMode === "NONE" ||
              !geofenceName.trim() ||
              (drawingMode === "CIRCLE" && !draftCircle) ||
              (drawingMode === "POLYGON" && draftPolygon.length < 3)
            }
            className="w-full rounded bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            Save Geofence
          </button>
        </div>
      </div>

      <div className="absolute right-3 top-3 z-[910] flex items-center gap-2">
        <div className="rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-xs text-slate-700 shadow-sm backdrop-blur">
          <span className="font-semibold">Moving:</span> {fleetStats.moving}
          <span className="mx-2">|</span>
          <span className="font-semibold">Idle:</span> {fleetStats.idle}
          <span className="mx-2">|</span>
          <span className="font-semibold">Offline:</span> {fleetStats.offline}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setAlertsOpen((current) => !current);
              if (!alertsOpen) {
                setUnreadAlerts(0);
              }
            }}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur hover:bg-slate-50"
          >
            <Bell size={16} />
            {unreadAlerts > 0 ? <span className="fleet-unread-dot" /> : null}
          </button>

          {alertsOpen ? (
            <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="mb-1 flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-slate-900">Live Alerts</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{alerts.length}</span>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto px-1 pb-1">
                {alerts.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
                    No alerts yet.
                  </p>
                ) : (
                  alerts.slice(0, 80).map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-lg border px-2 py-2 text-xs ${
                        alert.severity === "CRITICAL"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : alert.severity === "WARNING"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-sky-200 bg-sky-50 text-sky-700"
                      }`}
                    >
                      <p className="font-semibold">{alert.type.replaceAll("_", " ")}</p>
                      <p>{alert.message}</p>
                      <p className="mt-1 text-[10px] opacity-80">{formatTimestamp(alert.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute bottom-3 left-[376px] z-[900] hidden max-w-[460px] rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur lg:block">
        <p className="mb-1 text-xs font-semibold text-slate-900">Map Legend</p>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
          <LegendItem colorClass="fleet-dot-moving" label="Moving vehicle" />
          <LegendItem colorClass="fleet-dot-idle" label="Idle vehicle" />
          <LegendItem colorClass="fleet-dot-offline" label="Offline vehicle" />
          <LegendItem colorClass="fleet-dot-critical" label="Critical alert marker" />
          <LegendItem colorClass="fleet-dot-fuel" label="Fuel station" />
          <LegendItem colorClass="fleet-dot-garage" label="Garage" />
        </div>
      </div>

      {hoveredVehicle ? (
        <div className="absolute bottom-3 right-3 z-[920] max-w-xs rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <p className="text-xs font-semibold text-slate-900">{hoveredVehicle.registrationNo}</p>
          <p className="text-xs text-slate-500">{hoveredVehicle.driverName}</p>
          <p className="mt-1 text-xs text-slate-600">
            State: {operationalStateForVehicle(hoveredVehicle, clockTick)}
          </p>
          <p className="text-xs text-slate-600">
            Speed: {hoveredVehicle.speedKph === null ? "N/A" : `${hoveredVehicle.speedKph.toFixed(1)} km/h`}
          </p>
          <p className="text-xs text-slate-600">Updated: {formatTimestamp(hoveredVehicle.lastUpdated)}</p>
        </div>
      ) : null}

      <style jsx global>{`
        .fleet-live-map {
          z-index: 1;
        }

        .fleet-live-map .leaflet-popup-content-wrapper {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
          background: #ffffff;
        }

        .fleet-live-map .leaflet-popup-content {
          margin: 10px;
          min-width: 215px;
        }

        .fleet-popup-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: #0f172a;
        }

        .fleet-street-view-shell {
          overflow: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: linear-gradient(135deg, #dbeafe, #f8fafc);
        }

        .fleet-street-view-image {
          display: block;
          width: 100%;
          height: 110px;
          object-fit: cover;
          background: #e2e8f0;
        }

        .fleet-street-view-fallback {
          margin: 0;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          padding: 10px;
          font-size: 12px;
          color: #64748b;
          background: #f8fafc;
        }

        .fleet-popup-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.2;
          margin: 0;
        }

        .fleet-popup-row {
          margin: 0;
          font-size: 12px;
          color: #334155;
          line-height: 1.35;
        }

        .fleet-popup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .fleet-status-pill {
          border-radius: 9999px;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 700;
        }

        .fleet-state-moving {
          background: #dcfce7;
          color: #166534;
        }

        .fleet-state-idle {
          background: #fef3c7;
          color: #92400e;
        }

        .fleet-state-offline {
          background: #e2e8f0;
          color: #334155;
        }

        .fleet-alert-critical {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          color: #b91c1c;
        }

        .fleet-badge {
          border-radius: 9999px;
          border: 1px solid #86efac;
          background: #ecfdf3;
          color: #166534;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          white-space: nowrap;
        }

        .fleet-directions-btn {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #0f172a;
          text-decoration: none;
          background: white;
        }

        .fleet-directions-btn:hover {
          background: #f8fafc;
        }

        .fleet-danger-btn {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          border: 1px solid #fecaca;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #b91c1c;
          background: #fff1f2;
        }

        .fleet-custom-marker {
          background: transparent;
          border: 0;
        }

        .fleet-dot {
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          border: 2px solid #ffffff;
          box-shadow: 0 3px 8px rgba(15, 23, 42, 0.3);
          display: grid;
          place-items: center;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          transition: transform 0.24s ease-out;
        }

        .fleet-dot-fuel {
          background: #f97316;
        }

        .fleet-dot-nearest {
          background: #10b981;
        }

        .fleet-dot-garage {
          background: #8b5cf6;
        }

        .fleet-dot-moving {
          background: #16a34a;
        }

        .fleet-dot-idle {
          background: #f59e0b;
        }

        .fleet-dot-offline {
          background: #64748b;
        }

        .fleet-dot-critical {
          position: relative;
          background: #dc2626;
        }

        .fleet-dot-playback {
          background: #1d4ed8;
        }

        .fleet-marker-pulse {
          position: absolute;
          inset: -8px;
          border-radius: 9999px;
          border: 2px solid rgba(220, 38, 38, 0.45);
          animation: fleetAlertPulse 1.35s ease-out infinite;
        }

        .fleet-cluster {
          width: 38px;
          height: 38px;
          border-radius: 9999px;
          border: 2px solid #ffffff;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.35);
          background: #2563eb;
          color: #ffffff;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 700;
        }

        .fleet-cluster-critical {
          background: #dc2626;
        }

        .fleet-user-dot {
          position: relative;
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
        }

        .fleet-user-core {
          width: 13px;
          height: 13px;
          border-radius: 9999px;
          background: #2563eb;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.25);
          z-index: 2;
        }

        .fleet-user-pulse {
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          background: rgba(37, 99, 235, 0.28);
          animation: fleetPulse 1.8s ease-out infinite;
        }

        .fleet-tab-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #475569;
        }

        .fleet-tab-btn-active {
          border-color: #7dd3fc;
          background: #e0f2fe;
          color: #0c4a6e;
        }

        .fleet-check-row {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 7px;
          color: #334155;
        }

        .fleet-unread-dot {
          position: absolute;
          right: 6px;
          top: 6px;
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          border: 2px solid #ffffff;
          background: #ef4444;
        }

        @keyframes fleetPulse {
          0% {
            transform: scale(0.4);
            opacity: 0.95;
          }

          80% {
            transform: scale(1.45);
            opacity: 0;
          }

          100% {
            transform: scale(1.45);
            opacity: 0;
          }
        }

        @keyframes fleetAlertPulse {
          0% {
            transform: scale(0.85);
            opacity: 0.95;
          }
          100% {
            transform: scale(1.25);
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
}

function LegendItem({
  colorClass,
  label
}: {
  colorClass: string;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`fleet-dot h-3 w-3 ${colorClass}`} />
      <span>{label}</span>
    </div>
  );
}
