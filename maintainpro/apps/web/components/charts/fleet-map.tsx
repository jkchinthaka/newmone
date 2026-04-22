"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { DivIcon, Map as LeafletMap } from "leaflet";

import { useFleetSocket } from "@/hooks/use-fleet-socket";
import { apiClient } from "@/lib/api-client";

import "leaflet/dist/leaflet.css";

const MapContainer: any = dynamic(async () => (await import("react-leaflet")).MapContainer, { ssr: false });
const Marker: any = dynamic(async () => (await import("react-leaflet")).Marker, { ssr: false });
const Popup: any = dynamic(async () => (await import("react-leaflet")).Popup, { ssr: false });
const TileLayer: any = dynamic(async () => (await import("react-leaflet")).TileLayer, { ssr: false });

type GeoPoint = {
  lat: number;
  lng: number;
};

type NearbyCategory = "fuel" | "garage";

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
  vehicle: DivIcon;
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

const COLOMBO: GeoPoint = { lat: 6.9271, lng: 79.8612 };
const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [[5.65, 79.35], [10.05, 82.15]];
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const isWithinSriLanka = (point: GeoPoint): boolean => point.lat >= 5.65 && point.lat <= 10.05 && point.lng >= 79.35 && point.lng <= 82.15;

const haversineDistanceKm = (from: GeoPoint, to: GeoPoint): number => {
  const degToRad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * degToRad;
  const dLon = (to.lng - from.lng) * degToRad;
  const lat1 = from.lat * degToRad;
  const lat2 = to.lat * degToRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return 6371 * c;
};

const formatDistance = (distanceKm: number): string => `${distanceKm.toFixed(2)} km`;

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

const buildStreetViewPreviewParams = (params: {
  lat: number;
  lng: number;
  heading?: number | null;
}) => {
  const query: Record<string, string> = {
    lat: params.lat.toString(),
    lng: params.lng.toString(),
    size: "600x320"
  };

  if (typeof params.heading === "number" && Number.isFinite(params.heading)) {
    query.heading = params.heading.toString();
  }

  return query;
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

  return tags["addr:full"] ?? tags["name"] ?? "Address unavailable";
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

const toFleetVehicle = (payload: FleetApiLocation): FleetVehicle | null => {
  const vehicleId = payload.vehicleId ?? "";
  const lat = toFiniteNumber(payload.latitude);
  const lng = toFiniteNumber(payload.longitude);

  if (!vehicleId || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const speedValue = toFiniteNumber(payload.speed);
  const headingValue = toFiniteNumber(payload.heading);
  const firstName = payload.vehicle?.driver?.user?.firstName?.trim() ?? "";
  const lastName = payload.vehicle?.driver?.user?.lastName?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    markerId: payload.id ?? vehicleId,
    vehicleId,
    registrationNo: payload.vehicle?.registrationNo ?? vehicleId,
    lat,
    lng,
    headingDegrees: Number.isNaN(headingValue) ? null : headingValue,
    speedKph: Number.isNaN(speedValue) ? null : speedValue,
    lastUpdated: payload.timestamp ?? new Date().toISOString(),
    driverName: fullName || "Unknown Driver"
  };
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

    let isActive = true;
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      try {
        const response = await apiClient.get("/fleet/street-view", {
          params: buildStreetViewPreviewParams({ lat, lng, heading }),
          responseType: "blob"
        });

        if (!isActive) {
          return;
        }

        objectUrl = URL.createObjectURL(response.data as Blob);
        setImageUrl(objectUrl);
      } catch {
        if (isActive) {
          setHasError(true);
        }
      }
    };

    void loadPreview();

    return () => {
      isActive = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [lat, lng, heading]);

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

export function FleetMap() {
  const mapRef = useRef<LeafletMap | null>(null);
  const hasCenteredRef = useRef(false);

  const [markerIcons, setMarkerIcons] = useState<MarkerIcons | null>(null);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>("Detecting your location...");
  const [isLocating, setIsLocating] = useState(false);

  const [showFuelStations, setShowFuelStations] = useState(true);
  const [showGarages, setShowGarages] = useState(true);
  const [showFleetVehicles, setShowFleetVehicles] = useState(true);
  const [radiusKm, setRadiusKm] = useState(10);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [fuelStations, setFuelStations] = useState<NearbyPlace[]>([]);
  const [garages, setGarages] = useState<NearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);

  const sortedPlaces = useMemo(
    () => [...fuelStations, ...garages].sort((a, b) => a.distanceKm - b.distanceKm),
    [fuelStations, garages]
  );

  const locateUser = useCallback(
    (recenterMap: boolean) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        setGeoStatus("Geolocation not available. Centered on Colombo.");
        setUserLocation(COLOMBO);
        if (recenterMap && mapRef.current) {
          mapRef.current.flyTo([COLOMBO.lat, COLOMBO.lng], 11, { duration: 1.1 });
        }
        return;
      }

      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          let nextLocation: GeoPoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          if (!isWithinSriLanka(nextLocation)) {
            nextLocation = COLOMBO;
            setGeoStatus("Location outside Sri Lanka detected. Centered on Colombo.");
          } else {
            setGeoStatus("Using your live location.");
          }

          setUserLocation(nextLocation);

          if (mapRef.current && recenterMap) {
            mapRef.current.flyTo([nextLocation.lat, nextLocation.lng], 12, { duration: 1.1 });
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
      const rows = Array.isArray(response?.data?.data) ? (response.data.data as FleetApiLocation[]) : [];
      const mapped = rows
        .map((row) => toFleetVehicle(row))
        .filter((row): row is FleetVehicle => Boolean(row));

      setFleetVehicles(mapped);
      setFleetError(null);
    } catch {
      setFleetError("Unable to load fleet vehicles.");
    } finally {
      setFleetLoading(false);
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
        const ratingCandidate = toFiniteNumber(tags.rating ?? tags.stars);

        parsedPlaces.push({
          id,
          category,
          name: tags.name ?? (category === "fuel" ? "Fuel Station" : "Auto Repair Shop"),
          address: buildAddress(tags),
          lat: coords.lat,
          lng: coords.lng,
          distanceKm,
          openingHours: tags.opening_hours,
          rating: Number.isNaN(ratingCandidate) ? undefined : ratingCandidate
        });
      }

      const sortedFuel = parsedPlaces
        .filter((item) => item.category === "fuel")
        .sort((a, b) => a.distanceKm - b.distanceKm);
      const nearestFuelIds = new Set(sortedFuel.slice(0, 3).map((station) => station.id));
      const annotatedFuel = sortedFuel.map((station) => ({
        ...station,
        isNearest: nearestFuelIds.has(station.id)
      }));

      const sortedGarages = parsedPlaces
        .filter((item) => item.category === "garage")
        .sort((a, b) => a.distanceKm - b.distanceKm);

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

  const handleSocketUpdate = useCallback((payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const mapped = toFleetVehicle(payload as FleetApiLocation);
    if (!mapped) {
      return;
    }

    setFleetVehicles((current) => {
      const existingIndex = current.findIndex((item) => item.vehicleId === mapped.vehicleId);

      if (existingIndex === -1) {
        return [...current, mapped];
      }

      const existing = current[existingIndex];
      const next = [...current];
      next[existingIndex] = {
        ...existing,
        ...mapped,
        headingDegrees: mapped.headingDegrees ?? existing.headingDegrees,
        registrationNo: mapped.registrationNo === mapped.vehicleId ? existing.registrationNo : mapped.registrationNo,
        driverName: mapped.driverName === "Unknown Driver" ? existing.driverName : mapped.driverName
      };

      return next;
    });
  }, []);

  useFleetSocket(handleSocketUpdate);

  useEffect(() => {
    let active = true;

    import("leaflet")
      .then((leaflet) => {
        if (!active) {
          return;
        }

        const createIcon = (html: string) =>
          leaflet.divIcon({
            className: "fleet-custom-marker",
            html,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
          });

        setMarkerIcons({
          user: createIcon('<div class="fleet-user-dot"><span class="fleet-user-pulse"></span><span class="fleet-user-core"></span></div>'),
          fuel: createIcon('<div class="fleet-dot fleet-dot-fuel"></div>'),
          nearestFuel: createIcon('<div class="fleet-dot fleet-dot-nearest" title="Nearest fuel station">N</div>'),
          garage: createIcon('<div class="fleet-dot fleet-dot-garage"></div>'),
          vehicle: createIcon('<div class="fleet-dot fleet-dot-vehicle"></div>')
        });
      })
      .catch(() => {
        setMarkerIcons(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    locateUser(false);
    void fetchFleetVehicles();
  }, [locateUser, fetchFleetVehicles]);

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

  const handleMapReady = useCallback((event: { target: LeafletMap }) => {
    mapRef.current = event.target;
    mapRef.current.fitBounds(SRI_LANKA_BOUNDS, {
      padding: [24, 24]
    });
  }, []);

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

        {markerIcons && userLocation ? (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={markerIcons.user}>
            <Popup>
              <div className="fleet-popup-card">
                <p className="fleet-popup-title">Your Location</p>
                <p className="fleet-popup-row">{userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}</p>
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
                    <p className="fleet-popup-row">Opening Hours: {station.openingHours ?? "Not listed"}</p>
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
          ? fleetVehicles.map((vehicle) => (
              <Marker key={vehicle.markerId} position={[vehicle.lat, vehicle.lng]} icon={markerIcons.vehicle}>
                <Popup>
                  <div className="fleet-popup-card">
                    <p className="fleet-popup-title">{vehicle.registrationNo}</p>
                    <StreetViewPreview
                      lat={vehicle.lat}
                      lng={vehicle.lng}
                      heading={vehicle.headingDegrees}
                      label={`${vehicle.registrationNo} street view`}
                    />
                    <p className="fleet-popup-row">Vehicle ID: {vehicle.vehicleId}</p>
                    <p className="fleet-popup-row">Driver: {vehicle.driverName}</p>
                    <p className="fleet-popup-row">Speed: {vehicle.speedKph === null ? "N/A" : `${vehicle.speedKph.toFixed(1)} km/h`}</p>
                    <p className="fleet-popup-row">Last Updated: {formatTimestamp(vehicle.lastUpdated)}</p>
                  </div>
                </Popup>
              </Marker>
            ))
          : null}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[850] flex justify-center">
        <div className="pointer-events-auto rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
          {geoStatus}
          {placesLoading ? " | Searching nearby places..." : ""}
          {fleetLoading ? " | Loading fleet markers..." : ""}
          {placesError ? ` | ${placesError}` : ""}
          {fleetError ? ` | ${fleetError}` : ""}
        </div>
      </div>

      <aside
        className={`absolute left-3 top-16 z-[900] max-h-[calc(100%-5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur transition-all duration-300 ${
          isSidebarOpen ? "w-80" : "w-16"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          {isSidebarOpen ? <h3 className="text-sm font-semibold text-slate-800">Nearby Places</h3> : null}
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {isSidebarOpen ? "Hide" : "List"}
          </button>
        </div>

        {isSidebarOpen ? (
          <div className="max-h-[calc(100%-45px)] overflow-y-auto px-2 py-2">
            {sortedPlaces.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-500">No fuel stations or garages found in this radius.</p>
            ) : (
              <ul className="space-y-2">
                {sortedPlaces.map((place) => (
                  <li key={place.id} className="rounded-lg border border-slate-200 bg-white p-2">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          place.category === "fuel"
                            ? place.isNearest
                              ? "bg-emerald-500"
                              : "bg-orange-500"
                            : "bg-violet-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{place.name}</p>
                        <p className="truncate text-xs text-slate-500">{formatDistance(place.distanceKm)}</p>
                        {place.isNearest ? <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Nearest</span> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </aside>

      <div className="absolute right-3 top-16 z-[900] w-[320px] max-w-[calc(100%-1.5rem)] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur max-sm:w-[calc(100%-1.5rem)]">
        <div className="flex items-start justify-between gap-2 max-sm:flex-col">
          <h3 className="text-sm font-semibold text-slate-900">Map Controls</h3>
          <button
            type="button"
            onClick={() => locateUser(true)}
            disabled={isLocating}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLocating ? "Locating..." : "Locate Me"}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showFuelStations}
              onChange={(event) => setShowFuelStations(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
            />
            Show Fuel Stations
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showGarages}
              onChange={(event) => setShowGarages(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-violet-500 focus:ring-violet-400"
            />
            Show Garages
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showFleetVehicles}
              onChange={(event) => setShowFleetVehicles(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
            />
            Show Fleet Vehicles
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
            <span>Search Radius</span>
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
      </div>

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
          min-width: 210px;
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

        .fleet-popup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
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
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
          text-decoration: none;
        }

        .fleet-directions-btn:hover {
          background: #f8fafc;
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

        .fleet-dot-vehicle {
          background: #0ea5e9;
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
      `}</style>
    </section>
  );
}
