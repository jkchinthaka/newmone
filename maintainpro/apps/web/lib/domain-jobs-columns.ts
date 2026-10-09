import type { JobDomain } from "./job-domain";
import type { WorkOrderQueueFilters } from "./work-order-queues-api";

/** Columns for one operational jobs table. Extra columns hide below xl (1280px). */
export type DomainJobsColumn = {
  key: string;
  label: string;
  /** Hidden until the xl breakpoint. Primary scan columns stay visible. */
  hideUntilXl?: boolean;
};

export type DomainJobListRow = {
  title?: string | null;
  type?: string | null;
  typeNameSnapshot?: string | null;
  primaryAssigneeName?: string | null;
  asset?: { name?: string | null; assetTag?: string | null } | null;
  vehicle?: {
    registrationNo?: string | null;
    make?: string | null;
    vehicleModel?: string | null;
    currentMileage?: number | null;
  } | null;
  functionalLocation?: { name?: string | null; code?: string | null } | null;
  site?: { name?: string | null } | null;
  vendorSupplier?: { name?: string | null } | null;
};

const SHARED_TAIL: DomainJobsColumn[] = [
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "assignee", label: "Assignee" },
  { key: "due", label: "Due" },
  { key: "nextAction", label: "Next action" },
  { key: "actions", label: "Open" }
];

export function domainJobsColumns(domain?: string | null): DomainJobsColumn[] {
  if (domain === "MACHINERY") {
    return [{ key: "wo", label: "WO" }, { key: "work", label: "Work / Machine Asset" }, ...SHARED_TAIL];
  }
  if (domain === "SERVICE") {
    return [
      { key: "wo", label: "WO" },
      { key: "work", label: "Work / Service Location" },
      { key: "serviceType", label: "Service Type", hideUntilXl: true },
      ...SHARED_TAIL.map((column) =>
        column.key === "assignee" ? { ...column, label: "Assignee / Vendor" } : column
      )
    ];
  }
  if (domain === "VEHICLE") {
    return [
      { key: "wo", label: "WO" },
      { key: "work", label: "Work / Vehicle" },
      { key: "registration", label: "Registration", hideUntilXl: true },
      ...SHARED_TAIL.map((column) =>
        column.key === "nextAction" ? { ...column, label: "Odometer / Next action" } : column
      )
    ];
  }
  return [{ key: "wo", label: "WO" }, { key: "work", label: "Work / Asset" }, ...SHARED_TAIL];
}

export function domainJobPaths(): Record<JobDomain, string> {
  return {
    MACHINERY: "/maintenance/jobs/machinery",
    SERVICE: "/maintenance/jobs/service",
    VEHICLE: "/maintenance/jobs/vehicle"
  };
}

/** Domain pages keep their lane even when a filter patch tries to clear it. */
export function withLockedJobDomain(
  filters: Partial<WorkOrderQueueFilters>,
  domain?: string | null
): Partial<WorkOrderQueueFilters> {
  if (!domain) return filters;
  return { ...filters, jobDomain: domain };
}

function clean(value?: string | null): string {
  return value?.trim() ?? "";
}

export function machineAssetLine(row: DomainJobListRow): string {
  const tag = clean(row.asset?.assetTag);
  const name = clean(row.asset?.name);
  if (tag && name) return `${tag} • ${name}`;
  return tag || name || "—";
}

export function serviceLocationLine(row: DomainJobListRow): string {
  const code = clean(row.functionalLocation?.code);
  const name = clean(row.functionalLocation?.name) || clean(row.site?.name);
  if (code && name) return `${code} • ${name}`;
  const location = name || code;
  if (location) return location;
  const asset = machineAssetLine(row);
  return asset !== "—" ? asset : "—";
}

export function serviceTypeLine(row: DomainJobListRow): string {
  return clean(row.typeNameSnapshot) || clean(row.type) || "—";
}

export function vehicleWorkLine(row: DomainJobListRow): string {
  const make = clean(row.vehicle?.make);
  const model = clean(row.vehicle?.vehicleModel);
  const label = [make, model].filter(Boolean).join(" ");
  return label || clean(row.vehicle?.registrationNo) || "—";
}

export function registrationLine(row: DomainJobListRow): string {
  return clean(row.vehicle?.registrationNo) || "—";
}

export function odometerLine(row: DomainJobListRow): string {
  const mileage = row.vehicle?.currentMileage;
  if (typeof mileage !== "number" || !Number.isFinite(mileage) || mileage <= 0) return "";
  return `${new Intl.NumberFormat("en-US").format(mileage)} km`;
}

export function assigneeLine(row: DomainJobListRow, domain?: string | null, fallback = "Unassigned"): string {
  const assignee = clean(row.primaryAssigneeName) || fallback;
  if (domain !== "SERVICE") return assignee;
  const vendor = clean(row.vendorSupplier?.name);
  if (!vendor) return assignee;
  if (!clean(row.primaryAssigneeName)) return vendor;
  return `${assignee} · ${vendor}`;
}

export function workSubtitle(row: DomainJobListRow, domain?: string | null): string {
  if (domain === "MACHINERY") return machineAssetLine(row);
  if (domain === "SERVICE") return serviceLocationLine(row);
  if (domain === "VEHICLE") return vehicleWorkLine(row);
  const asset = machineAssetLine(row);
  if (asset !== "—") return asset;
  return registrationLine(row);
}
