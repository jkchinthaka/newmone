import {
  CarFront,
  CircleCheck,
  CircleHelp,
  CircleOff,
  CircleSlash,
  Wrench,
  type LucideIcon
} from "lucide-react";

export type VehicleStatus =
  | "AVAILABLE"
  | "IN_USE"
  | "UNDER_MAINTENANCE"
  | "OUT_OF_SERVICE"
  | "DISPOSED";

export type VehicleStatusMeta = {
  label: string;
  badgeClass: string;
  icon: LucideIcon;
};

export const VEHICLE_STATUSES: VehicleStatus[] = [
  "AVAILABLE",
  "IN_USE",
  "UNDER_MAINTENANCE",
  "OUT_OF_SERVICE",
  "DISPOSED"
];

export const VEHICLE_STATUS_META: Record<VehicleStatus, VehicleStatusMeta> = {
  AVAILABLE: {
    label: "Available",
    badgeClass: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    icon: CircleCheck
  },
  IN_USE: {
    label: "In Use",
    badgeClass: "bg-sky-100 text-sky-700 ring-sky-200",
    icon: CarFront
  },
  UNDER_MAINTENANCE: {
    label: "Under Maintenance",
    badgeClass: "bg-amber-100 text-amber-800 ring-amber-200",
    icon: Wrench
  },
  OUT_OF_SERVICE: {
    label: "Out of Service",
    badgeClass: "bg-rose-100 text-rose-700 ring-rose-200",
    icon: CircleOff
  },
  DISPOSED: {
    label: "Disposed",
    badgeClass: "bg-slate-200 text-slate-700 ring-slate-300",
    icon: CircleSlash
  }
};

/**
 * `Vehicle.status` is `String @default("")` in prisma/schema.prisma (the SQL Server
 * schema has no enum), so records created before the status was set — or carrying a
 * legacy value — reach the UI with a value that is not in VEHICLE_STATUS_META.
 * Indexing the map directly for those rows yields `undefined` and crashes the page,
 * so every lookup goes through resolveVehicleStatusMeta().
 *
 * DATA QUALITY: blank `Vehicle.status` (`""`) is a data defect, not a valid business
 * state. Do NOT silently coerce blank → AVAILABLE. Operators should set an explicit
 * status; a forward data cleanup may backfill only after product confirms the intended
 * default for legacy rows (do not guess).
 */
export const UNKNOWN_VEHICLE_STATUS_META: VehicleStatusMeta = {
  label: "Status not set",
  badgeClass: "bg-slate-100 text-slate-600 ring-slate-200",
  icon: CircleHelp
};

export function isVehicleStatus(value: unknown): value is VehicleStatus {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(VEHICLE_STATUS_META, value)
  );
}

export function resolveVehicleStatusMeta(
  status: string | null | undefined
): VehicleStatusMeta {
  return isVehicleStatus(status) ? VEHICLE_STATUS_META[status] : UNKNOWN_VEHICLE_STATUS_META;
}

/** Label-only helper for places that render the status as plain text. */
export function formatVehicleStatus(status: string | null | undefined): string {
  return resolveVehicleStatusMeta(status).label;
}
