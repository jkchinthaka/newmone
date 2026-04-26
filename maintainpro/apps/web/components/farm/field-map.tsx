"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

import "leaflet/dist/leaflet.css";

const MapContainer: any = dynamic(async () => (await import("react-leaflet")).MapContainer, { ssr: false });
const TileLayer: any = dynamic(async () => (await import("react-leaflet")).TileLayer, { ssr: false });
const Popup: any = dynamic(async () => (await import("react-leaflet")).Popup, { ssr: false });
const Polygon: any = dynamic(async () => (await import("react-leaflet")).Polygon, { ssr: false });

export type FieldGeo = {
  id: string;
  name: string;
  areaHectares?: number | null;
  gpsPolygon?: unknown;
};

const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718];

function extractPolygon(value: unknown): Array<[number, number]> | null {
  if (!Array.isArray(value)) return null;
  const points = value
    .map((p) => {
      if (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number") {
        return [p[0], p[1]] as [number, number];
      }
      if (p && typeof p === "object" && "lat" in p && "lng" in p) {
        const ll = p as { lat: number; lng: number };
        return [ll.lat, ll.lng] as [number, number];
      }
      return null;
    })
    .filter((x): x is [number, number] => Array.isArray(x));
  return points.length >= 3 ? points : null;
}

export function FieldMap({ fields }: { fields: FieldGeo[] }) {
  const polygons = useMemo(
    () =>
      fields
        .map((f) => ({ field: f, points: extractPolygon(f.gpsPolygon) }))
        .filter((x): x is { field: FieldGeo; points: Array<[number, number]> } => x.points !== null),
    [fields]
  );

  const center = useMemo<[number, number]>(() => {
    if (polygons.length === 0) return SRI_LANKA_CENTER;
    const all = polygons.flatMap((p) => p.points);
    const sum = all.reduce((acc, [lat, lng]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }), { lat: 0, lng: 0 });
    return [sum.lat / all.length, sum.lng / all.length];
  }, [polygons]);

  return (
    <MapContainer center={center} zoom={9} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {polygons.map(({ field, points }) => (
        <Polygon key={field.id} positions={points} pathOptions={{ color: "#15803d", fillColor: "#bbf7d0" }}>
          <Popup>
            <strong>{field.name}</strong>
            <br />
            {field.areaHectares ? `${field.areaHectares} ha` : ""}
          </Popup>
        </Polygon>
      ))}
    </MapContainer>
  );
}
