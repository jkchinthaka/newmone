/**
 * Nelna FG Digital Recording — external application link (separate login required).
 * URL from FG_DIGITAL_RECORDING_URL (mapped to NEXT_PUBLIC_* at build/runtime).
 */

import type { NavigationItem } from "./navigation";

export const FG_DIGITAL_RECORDING_NAV_ID = "fg-digital-recording";

const FG_DIGITAL_RECORDING_ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "MAINTENANCE_SUPERVISOR",
  "SUPERVISOR",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR",
  "COMPLIANCE_MANAGER",
  "CLEANER",
  "VIEWER",
  "AUDITOR"
] as const;

/** Resolve configured FG base URL; rejects credentials and query parameters. */
export function getFgDigitalRecordingUrl(): string | null {
  const raw = (
    process.env.NEXT_PUBLIC_FG_DIGITAL_RECORDING_URL ??
    process.env.FG_DIGITAL_RECORDING_URL ??
    ""
  ).trim();

  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (url.username || url.password || url.search || url.hash) {
      return null;
    }
    const normalized = `${url.origin}${url.pathname}`.replace(/\/+$/, "");
    return normalized || url.origin;
  } catch {
    return null;
  }
}

export function buildFgDigitalRecordingNavItem(): NavigationItem | null {
  const href = getFgDigitalRecordingUrl();
  if (!href) {
    return null;
  }

  return {
    id: FG_DIGITAL_RECORDING_NAV_ID,
    label: "FG Digital Recording",
    href,
    icon: "ClipboardCheck",
    external: true,
    allowedRoles: FG_DIGITAL_RECORDING_ALLOWED_ROLES,
    category: "compliance",
    description:
      "Open Nelna Finished Goods digital recording in a separate application (FG login required)",
    mobilePriority: true
  };
}

export function isExternalNavigationHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
