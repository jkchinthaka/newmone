import { PRODUCT_NAME, PRODUCT_TAGLINE } from "./branding";

export const PWA_NAME = PRODUCT_NAME;
export const PWA_SHORT_NAME = PRODUCT_NAME;
export const PWA_DESCRIPTION = PRODUCT_TAGLINE;
export const PWA_THEME_COLOR = "#0f172a";
export const PWA_BACKGROUND_COLOR = "#f1f5f9";
export const PWA_START_URL = "/";
export const PWA_SCOPE = "/";
export const PWA_DISPLAY = "standalone" as const;
export const PWA_ORIENTATION = "any" as const;

export const PWA_ICON_PATHS = {
  icon192: "/pwa-192x192.png",
  icon512: "/pwa-512x512.png",
  maskable512: "/pwa-maskable-512x512.png",
  favicon: "/favicon.ico",
  favicon32: "/favicon-32x32.png",
  apple: "/apple-touch-icon.png"
} as const;

export const LEGACY_PWA_BRAND_MARKERS = [
  "Maintenance job",
  "FMS Dashboard",
  "Fleet Management System"
] as const;
