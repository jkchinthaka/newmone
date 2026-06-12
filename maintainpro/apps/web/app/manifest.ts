import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MaintainPro",
    short_name: "MaintainPro",
    description:
      "Enterprise Maintenance & Facility Operations Platform for maintenance, facility, fleet, and operations teams.",
    start_url: "/splash",
    scope: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#0f172a",
    orientation: "portrait",
    icons: [
      {
        src: "/pwa-192x192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable"
      },
      {
        src: "/pwa-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}