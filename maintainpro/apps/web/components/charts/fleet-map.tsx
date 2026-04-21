"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const MapContainer: any = dynamic(async () => (await import("react-leaflet")).MapContainer, { ssr: false });
const Marker: any = dynamic(async () => (await import("react-leaflet")).Marker, { ssr: false });
const Popup: any = dynamic(async () => (await import("react-leaflet")).Popup, { ssr: false });
const TileLayer: any = dynamic(async () => (await import("react-leaflet")).TileLayer, { ssr: false });

const markers = [
  { id: "V1", lat: 19.076, lng: 72.8777, label: "MH-01-AB-101" },
  { id: "V2", lat: 19.102, lng: 72.874, label: "MH-01-AB-102" },
  { id: "V3", lat: 19.051, lng: 72.89, label: "MH-01-AB-103" }
];

export function FleetMap() {
  return (
    <div className="h-[460px] overflow-hidden rounded-xl border border-slate-200">
      <MapContainer center={[19.076, 72.8777]} zoom={11} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {markers.map((marker) => (
          <Marker key={marker.id} position={[marker.lat, marker.lng]}>
            <Popup>{marker.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
