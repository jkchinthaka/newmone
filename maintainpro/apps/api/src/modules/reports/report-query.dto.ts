import { BadRequestException } from "@nestjs/common";

import { MAX_EXPORT_ROWS, MAX_REPORT_RANGE_DAYS } from "./report-currency.util";
import { resolveBusinessDateRange } from "./report-timezone.util";
import type { ReportExportFormat, ReportModuleKey, ReportQuery } from "./reports.service";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const SORT_DIRECTIONS = new Set(["asc", "desc"]);
const EXPORT_FORMATS = new Set(["csv", "xlsx", "pdf"]);
const MODULES = new Set([
  "operations",
  "financials",
  "user-activity",
  "assets",
  "inventory",
  "performance",
  "system-logs",
  "driver-intelligence",
  "fuel-analytics",
  "vehicle-cost-analytics"
]);

const SORT_ALLOWLIST = new Set([
  "createdAt",
  "updatedAt",
  "status",
  "title",
  "amount",
  "date",
  "name",
  "quantity",
  "cost",
  "woNumber",
  "poNumber"
]);

function optionalObjectId(value: unknown, field: string): string | undefined {
  if (value == null || value === "") return undefined;
  const raw = String(value).trim();
  if (!OBJECT_ID.test(raw)) {
    throw new BadRequestException(`${field} must be a valid ObjectId.`);
  }
  return raw;
}

function parseDepartmentIds(raw: unknown, single?: unknown): string[] {
  const values = [single, raw]
    .flatMap((value) => (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : []))
    .map((value) => String(value).trim())
    .filter(Boolean);
  const unique = Array.from(new Set(values));
  if (unique.length > 50) {
    throw new BadRequestException("departmentIds cannot exceed 50 values.");
  }
  for (const id of unique) {
    if (!OBJECT_ID.test(id)) {
      throw new BadRequestException("departmentIds must contain valid ObjectId values.");
    }
  }
  return unique;
}

export function parseValidatedReportQuery(query: ReportQuery = {}): ReportQuery & {
  page: number;
  pageSize: number;
  sortDirection?: "asc" | "desc";
} {
  if (query.startDate != null && String(query.startDate).trim() !== "") {
    resolveBusinessDateRange({ startDate: String(query.startDate), endDate: query.endDate });
  } else if (query.endDate != null && String(query.endDate).trim() !== "") {
    resolveBusinessDateRange({ endDate: String(query.endDate) });
  } else {
    resolveBusinessDateRange({});
  }

  const departmentIds = parseDepartmentIds(query.departmentIds, query.departmentId);
  const page = Math.max(1, Math.floor(Number(query.page ?? 1)) || 1);
  const pageSizeRaw = Math.floor(Number(query.pageSize ?? 15)) || 15;
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

  if (query.search != null && String(query.search).length > 200) {
    throw new BadRequestException("search cannot exceed 200 characters.");
  }
  if (query.category != null && String(query.category).length > 80) {
    throw new BadRequestException("category cannot exceed 80 characters.");
  }
  if (query.status != null && String(query.status).length > 64) {
    throw new BadRequestException("status cannot exceed 64 characters.");
  }
  if (query.sortBy != null && String(query.sortBy).trim() !== "" && !SORT_ALLOWLIST.has(String(query.sortBy))) {
    throw new BadRequestException("sortBy is not allowed.");
  }
  if (query.sortDirection != null && !SORT_DIRECTIONS.has(String(query.sortDirection))) {
    throw new BadRequestException("sortDirection must be asc or desc.");
  }

  return {
    ...query,
    startDate: query.startDate ? String(query.startDate).trim() : undefined,
    endDate: query.endDate ? String(query.endDate).trim() : undefined,
    departmentIds,
    departmentId: departmentIds[0] ?? optionalObjectId(query.departmentId, "departmentId"),
    userId: optionalObjectId(query.userId, "userId"),
    driverId: optionalObjectId(query.driverId, "driverId"),
    assetId: optionalObjectId(query.assetId, "assetId"),
    vehicleId: optionalObjectId(query.vehicleId, "vehicleId"),
    supplierId: optionalObjectId(query.supplierId, "supplierId"),
    page,
    pageSize,
    sortBy: query.sortBy ? String(query.sortBy) : undefined,
    sortDirection: query.sortDirection as "asc" | "desc" | undefined,
    search: query.search ? String(query.search).trim() : undefined,
    category: query.category ? String(query.category).trim() : undefined,
    status: query.status ? String(query.status).trim() : undefined
  };
}

export function parseExportFormat(formatRaw?: string): ReportExportFormat {
  const format = (formatRaw || "csv").toLowerCase();
  if (!EXPORT_FORMATS.has(format)) {
    throw new BadRequestException("format must be csv, xlsx, or pdf.");
  }
  return format as ReportExportFormat;
}

export function assertReportModuleKey(module: string): asserts module is ReportModuleKey {
  if (!MODULES.has(module)) {
    throw new BadRequestException(`Unsupported report module: ${module}`);
  }
}

export const REPORT_QUERY_LIMITS = {
  maxRangeDays: MAX_REPORT_RANGE_DAYS,
  maxExportRows: MAX_EXPORT_ROWS,
  maxPageSize: 100
};
