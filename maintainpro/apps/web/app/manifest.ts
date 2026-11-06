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

/** `form_factor` and `label` are valid manifest members that Next 14's type does not list yet. */
const PWA_SCREENSHOTS = [
  { src: "/screenshots/login-narrow.png", sizes: "540x960", type: "image/png", form_factor: "narrow", label: "Sign in to Nelna CMMS on your phone" },
  { src: "/screenshots/login-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Nelna CMMS on a computer" }
] as unknown as MetadataRoute.Manifest["screenshots"];

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: PWA_NAME,
    short_name: PWA_SHORT_NAME,
    description: PWA_DESCRIPTION,
    start_url: PWA_START_URL,
    scope: PWA_SCOPE,
    display: PWA_DISPLAY,
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    orientation: PWA_ORIENTATION,
    lang: "en-LK",
    dir: "ltr",
    categories: ["business", "productivity", "utilities"],
    screenshots: PWA_SCREENSHOTS,
    shortcuts: [
      { name: "My jobs", short_name: "My jobs", url: "/work-orders/my", icons: [{ src: PWA_ICON_PATHS.icon192, sizes: "192x192", type: "image/png" }] },
      { name: "Report a problem", short_name: "New request", url: "/requests/new", icons: [{ src: PWA_ICON_PATHS.icon192, sizes: "192x192", type: "image/png" }] }
    ],
    icons: [
      { src: PWA_ICON_PATHS.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: PWA_ICON_PATHS.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: PWA_ICON_PATHS.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
