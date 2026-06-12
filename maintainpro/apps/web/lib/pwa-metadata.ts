import { PRODUCT_NAME, PRODUCT_TAGLINE } from "./branding";

export const PWA_NAME = PRODUCT_NAME;
export const PWA_SHORT_NAME = PRODUCT_NAME;
export const PWA_DESCRIPTION = PRODUCT_TAGLINE;
export const PWA_THEME_COLOR = "#0f172a";
export const PWA_BACKGROUND_COLOR = "#f1f5f9";
export const PWA_START_URL = "/splash";
export const PWA_SCOPE = "/";
export const PWA_DISPLAY = "standalone" as const;
export const PWA_ORIENTATION = "portrait" as const;

export const PWA_ICON_PATHS = {
  icon192: "/pwa-192x192.svg",
  icon512: "/pwa-512x512.svg",
  favicon: "/favicon.svg"
} as const;

export const LEGACY_PWA_BRAND_MARKERS = [
  "Maintenance Job",
  "FMS Dashboard",
  "Fleet Management System"
] as const;
