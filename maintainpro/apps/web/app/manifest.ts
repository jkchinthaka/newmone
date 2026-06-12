import type { MetadataRoute } from "next";

import {
  PWA_BACKGROUND_COLOR,
  PWA_DESCRIPTION,
  PWA_DISPLAY,
  PWA_ICON_PATHS,
  PWA_NAME,
  PWA_ORIENTATION,
  PWA_SCOPE,
  PWA_SHORT_NAME,
  PWA_START_URL,
  PWA_THEME_COLOR
} from "@/lib/pwa-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PWA_NAME,
    short_name: PWA_SHORT_NAME,
    description: PWA_DESCRIPTION,
    start_url: PWA_START_URL,
    scope: PWA_SCOPE,
    display: PWA_DISPLAY,
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    orientation: PWA_ORIENTATION,
    icons: [
      {
        src: PWA_ICON_PATHS.icon192,
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable"
      },
      {
        src: PWA_ICON_PATHS.icon512,
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
