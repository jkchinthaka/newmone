"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Wrench,
  X
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { USER_KEY } from "@/lib/auth-storage";
import {
  hasActiveFilters,
  useAssetPageStore,
  type AssetCategoryFilter,
  type AssetColumnKey,
  type AssetSortField,
  type AssetStatusFilter
} from "./use-asset-page-store";

type AssetCategory = "MACHINE" | "TOOL" | "INFRASTRUCTURE" | "EQUIPMENT" | "VEHICLE" | "OTHER";
type AssetStatus = "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "DISPOSED" | "RETIRED";
type AssetCondition = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL";

type RoleTier = "viewer" | "operator" | "manager" | "admin";
type DrawerTab = "overview" | "history" | "documents" | "workOrders" | "activity";
type ExportFormat = "csv" | "xlsx" | "pdf";

type ImportPreviewRow = {
  rowNumber: number;
  values: Record<string, string>;
  payload: Record<string, unknown> | null;
  errors: string[];
};

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AssetDocument {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
  externalUrl?: string;
  downloadUrl?: string;
}

interface AssetListItem {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  location?: string | null;
  description?: string | null;
  condition: AssetCondition;
  lastServiceDate?: string | null;
  nextServiceDate?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  supplier?: string | null;
  department?: string | null;
  ownerName?: string | null;
  meterReading?: string | number | null;
  qrCodeUrl?: string | null;
  isArchived: boolean;
  workOrderCount: number;
  openWorkOrderCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceHistoryItem {
  id: string;
  description: string;
  performedBy: string;
  performedAt: string;
  cost?: string | number | null;
  notes?: string | null;
}

interface WorkOrderSummary {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt: string;
}

interface AssetActivityEvent {
  id: string;
  action: string;
  createdAt: string;
  actorName: string;
  beforeData?: unknown;
  afterData?: unknown;
}

interface AssetDetail extends AssetListItem {
  maintenanceLogs: MaintenanceHistoryItem[];
  workOrders: WorkOrderSummary[];
  activity: AssetActivityEvent[];
  openWorkOrders: number;
  documents: AssetDocument[];
  purchasePrice?: string | null;
  currentValue?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  disposalDate?: string | null;
  disposalReason?: string | null;
}

interface AssetListResponse {
  items: AssetListItem[];
  meta: PaginationMeta;
}

interface StoredUserInfo {
  id: string | null;
  roleName: string;
}

interface AssetFormValues {
  assetTag: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  location: string;
  description: string;
  condition: AssetCondition;
  purchaseDate: string;
  warrantyExpiry: string;
  supplier: string;
  department: string;
  ownerName: string;
  lastServiceDate: string;
  nextServiceDate: string;
  meterReading: string;
}

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: AssetStatusFilter }> = [
  { label: "All", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Under Maintenance", value: "UNDER_MAINTENANCE" },
  { label: "Retired", value: "RETIRED" },
  { label: "Disposed", value: "DISPOSED" }
];

const CATEGORY_FILTER_OPTIONS: Array<{ label: string; value: AssetCategoryFilter }> = [
  { label: "All", value: "" },
  { label: "Machine", value: "MACHINE" },
  { label: "Equipment", value: "EQUIPMENT" },
  { label: "Vehicle", value: "VEHICLE" },
  { label: "Facility", value: "INFRASTRUCTURE" },
  { label: "Other", value: "OTHER" }
];

const CATEGORY_FORM_OPTIONS: Array<{ label: string; value: AssetCategory }> = [
  { label: "Machine", value: "MACHINE" },
  { label: "Equipment", value: "EQUIPMENT" },
  { label: "Vehicle", value: "VEHICLE" },
  { label: "Facility", value: "INFRASTRUCTURE" },
  { label: "Tool", value: "TOOL" },
  { label: "Other", value: "OTHER" }
];

const STATUS_FORM_OPTIONS: Array<{ label: string; value: AssetStatus }> = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Under Maintenance", value: "UNDER_MAINTENANCE" },
  { label: "Retired", value: "RETIRED" },
  { label: "Disposed", value: "DISPOSED" }
];

const QUICK_STATUS_OPTIONS: Array<{ label: string; value: AssetStatus }> = [
  { label: "Active", value: "ACTIVE" },
  { label: "Under Maintenance", value: "UNDER_MAINTENANCE" },
  { label: "Retired", value: "RETIRED" },
  { label: "Disposed", value: "DISPOSED" }
];

const CONDITION_OPTIONS: Array<{ label: string; value: AssetCondition }> = [
  { label: "Good", value: "GOOD" },
  { label: "Fair", value: "FAIR" },
  { label: "Poor", value: "POOR" },
  { label: "Critical", value: "CRITICAL" }
];

const SORT_OPTIONS: Array<{ label: string; value: AssetSortField }> = [
  { label: "Asset Tag", value: "assetTag" },
  { label: "Name", value: "name" },
  { label: "Category", value: "category" },
  { label: "Status", value: "status" },
  { label: "Created Date", value: "createdAt" },
  { label: "Location", value: "location" }
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const STATUS_STYLES: Record<AssetStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-slate-200 text-slate-700",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-800",
  RETIRED: "bg-slate-300 text-slate-700",
  DISPOSED: "bg-rose-100 text-rose-700"
};

const CONDITION_STYLES: Record<AssetCondition, string> = {
  EXCELLENT: "bg-sky-100 text-sky-700",
  GOOD: "bg-emerald-100 text-emerald-700",
  FAIR: "bg-amber-100 text-amber-800",
  POOR: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-rose-100 text-rose-700"
};

const COLUMN_OPTIONS: Array<{ key: AssetColumnKey; label: string }> = [
  { key: "assetTag", label: "Asset Tag" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "location", label: "Location" },
  { key: "condition", label: "Condition" },
  { key: "lastServiceDate", label: "Last Service" },
  { key: "qr", label: "QR" },
  { key: "actions", label: "Actions" }
];

const formSchema = z.object({
  assetTag: z
    .string()
    .trim()
    .min(1, "Asset tag is required")
    .regex(/^AST-[A-Z0-9]{4,}$/i, "Asset tag must match AST-XXXX format"),
  name: z.string().trim().min(2, "Name is required"),
  category: z.enum(["MACHINE", "TOOL", "INFRASTRUCTURE", "EQUIPMENT", "VEHICLE", "OTHER"]),
  status: z.enum(["ACTIVE", "INACTIVE", "UNDER_MAINTENANCE", "DISPOSED", "RETIRED"]),
  location: z.string().trim().min(1, "Location is required"),
  description: z.string().max(1000).optional().default(""),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"]),
  purchaseDate: z.string().optional().default(""),
  warrantyExpiry: z.string().optional().default(""),
  supplier: z.string().optional().default(""),
  department: z.string().optional().default(""),
  ownerName: z.string().optional().default(""),
  lastServiceDate: z.string().optional().default(""),
  nextServiceDate: z.string().optional().default(""),
  meterReading: z.string().optional().default("")
});

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function formatEnumLabel(value?: string | null) {
  if (!value) return "-";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function getErrorMessage(error: unknown) {
  const message =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? (error as { response: { data: { message: string } } }).response.data.message
      : undefined;

  if (message) return message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

function getStoredUserInfo(): StoredUserInfo {
  if (typeof window === "undefined") {
    return { id: null, roleName: "VIEWER" };
  }

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    return { id: null, roleName: "VIEWER" };
  }

  try {
    const parsed = JSON.parse(raw) as {
      id?: string;
      role?: string | { name?: string | null } | null;
    };

    const roleName =
      typeof parsed.role === "string"
        ? parsed.role
        : parsed.role && typeof parsed.role === "object"
          ? parsed.role.name ?? "VIEWER"
          : "VIEWER";

    return {
      id: parsed.id ?? null,
      roleName
    };
  } catch {
    return { id: null, roleName: "VIEWER" };
  }
}

function mapRoleTier(roleName: string): RoleTier {
  const normalized = roleName.toUpperCase();

  if (normalized === "ADMIN" || normalized === "SUPER_ADMIN") {
    return "admin";
  }
  if (normalized === "MANAGER" || normalized === "ASSET_MANAGER") {
    return "manager";
  }
  if (normalized === "SUPERVISOR" || normalized === "MECHANIC" || normalized === "TECHNICIAN") {
    return "operator";
  }
  return "viewer";
}

function toQueryParams(filters: ReturnType<typeof useAssetPageStore.getState>["filters"]) {
  const params: Record<string, string | number> = {
    page: filters.page,
    limit: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  };

  if (filters.search.trim()) {
    params.search = filters.search.trim();
  }
  if (filters.status) {
    params.status = filters.status;
  }
  if (filters.category) {
    params.category = filters.category;
  }
  if (filters.location) {
    params.location = filters.location;
  }

  return params;
}

function buildPageNumbers(page: number, totalPages: number) {
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const normalizedStart = Math.max(1, end - 4);
  const pages: number[] = [];
  for (let current = normalizedStart; current <= end; current += 1) {
    pages.push(current);
  }
  return pages;
}

async function downloadBlob(url: string, fallbackName: string, params?: Record<string, unknown>) {
  const response = await apiClient.get(url, {
    params,
    responseType: "blob"
  });

  const blob = new Blob([response.data]);
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function emptyFormValues(): AssetFormValues {
  return {
    assetTag: `AST-${Date.now().toString().slice(-6)}`,
    name: "",
    category: "MACHINE",
    status: "ACTIVE",
    location: "",
    description: "",
    condition: "GOOD",
    purchaseDate: "",
    warrantyExpiry: "",
    supplier: "",
    department: "",
    ownerName: "",
    lastServiceDate: "",
    nextServiceDate: "",
    meterReading: ""
  };
}

function mapAssetToForm(asset: AssetListItem | AssetDetail): AssetFormValues {
  return {
    assetTag: asset.assetTag,
    name: asset.name,
    category: asset.category,
    status: asset.status,
    location: asset.location ?? "",
    description: asset.description ?? "",
    condition: asset.condition,
    purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : "",
    warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().slice(0, 10) : "",
    supplier: asset.supplier ?? "",
    department: asset.department ?? "",
    ownerName: asset.ownerName ?? "",
    lastServiceDate: asset.lastServiceDate ? new Date(asset.lastServiceDate).toISOString().slice(0, 10) : "",
    nextServiceDate: asset.nextServiceDate ? new Date(asset.nextServiceDate).toISOString().slice(0, 10) : "",
    meterReading: asset.meterReading == null ? "" : String(asset.meterReading)
  };
}

function toAssetPayload(values: AssetFormValues) {
  const payload: Record<string, unknown> = {
    assetTag: values.assetTag.trim().toUpperCase(),
    name: values.name.trim(),
    category: values.category,
    status: values.status,
    location: values.location.trim(),
    condition: values.condition
  };

  const optionalTextFields: Array<keyof Pick<AssetFormValues, "description" | "supplier" | "department" | "ownerName">> = [
    "description",
    "supplier",
    "department",
    "ownerName"
  ];

  optionalTextFields.forEach((field) => {
    const value = values[field].trim();
    if (value) payload[field] = value;
  });

  const optionalDateFields: Array<keyof Pick<AssetFormValues, "purchaseDate" | "warrantyExpiry" | "lastServiceDate" | "nextServiceDate">> = [
    "purchaseDate",
    "warrantyExpiry",
    "lastServiceDate",
    "nextServiceDate"
  ];

  optionalDateFields.forEach((field) => {
    const value = values[field].trim();
    if (value) payload[field] = value;
  });

  if (values.meterReading.trim()) {
    const reading = Number(values.meterReading);
    if (!Number.isNaN(reading)) {
      payload.meterReading = reading;
    }
  }

  return payload;
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeStatusToken(value: string): AssetStatus | null {
  const token = value.trim().replace(/[\s-]+/g, "_").toUpperCase();
  if (["ACTIVE", "INACTIVE", "UNDER_MAINTENANCE", "RETIRED", "DISPOSED"].includes(token)) {
    return token as AssetStatus;
  }
  return null;
}

function normalizeCategoryToken(value: string): AssetCategory | null {
  const token = value.trim().toLowerCase();
  if (!token) return null;
  if (token === "facility") return "INFRASTRUCTURE";

  const normalized = token.replace(/[\s-]+/g, "_").toUpperCase();
  if (["MACHINE", "EQUIPMENT", "VEHICLE", "INFRASTRUCTURE", "OTHER", "TOOL"].includes(normalized)) {
    return normalized as AssetCategory;
  }
  return null;
}

function normalizeConditionToken(value: string): AssetCondition | null {
  const normalized = value.trim().replace(/[\s-]+/g, "_").toUpperCase();
  if (["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"].includes(normalized)) {
    return normalized as AssetCondition;
  }
  return null;
}

function parseImportRows(records: Array<Record<string, unknown>>): ImportPreviewRow[] {
  return records.map((record, index) => {
    const rowNumber = index + 2;
    const normalized = Object.fromEntries(
      Object.entries(record).map(([key, value]) => [normalizeHeader(key), String(value ?? "").trim()])
    );

    const errors: string[] = [];
    const assetTag = String(normalized.assettag ?? "").toUpperCase();
    const name = String(normalized.name ?? "");
    const category = normalizeCategoryToken(String(normalized.category ?? ""));
    const status = normalizeStatusToken(String(normalized.status ?? "ACTIVE")) ?? "ACTIVE";
    const condition = normalizeConditionToken(String(normalized.condition ?? "GOOD")) ?? "GOOD";

    if (!assetTag) {
      errors.push("Asset tag is required.");
    }
    if (!/^AST-[A-Z0-9]{4,}$/i.test(assetTag)) {
      errors.push("Asset tag must match AST-XXXX format.");
    }
    if (!name) {
      errors.push("Name is required.");
    }
    if (!category) {
      errors.push("Category is invalid.");
    }

    const payload: Record<string, unknown> = {
      assetTag,
      name,
      category: category ?? "MACHINE",
      status,
      condition,
      location: String(normalized.location ?? "")
    };

    const optionalText = ["description", "supplier", "department", "ownername"] as const;
    optionalText.forEach((field) => {
      const value = String(normalized[field] ?? "").trim();
      if (!value) return;
      if (field === "ownername") {
        payload.ownerName = value;
      } else {
        payload[field] = value;
      }
    });

    const optionalDates: Array<[string, string]> = [
      ["purchasedate", "purchaseDate"],
      ["warrantyexpiry", "warrantyExpiry"],
      ["lastservicedate", "lastServiceDate"],
      ["nextservicedate", "nextServiceDate"]
    ];
    optionalDates.forEach(([source, target]) => {
      const value = String(normalized[source] ?? "").trim();
      if (value) payload[target] = value;
    });

    const reading = String(normalized.meterreading ?? "").trim();
    if (reading) {
      const numericReading = Number(reading);
      if (Number.isNaN(numericReading)) {
        errors.push("Meter reading must be numeric.");
      } else {
        payload.meterReading = numericReading;
      }
    }

    return {
      rowNumber,
      values: Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, String(value)])),
      payload: errors.length === 0 ? payload : null,
      errors
    };
  });
}

async function readImportFile(file: File) {
  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      throw new Error("CSV must include headers and at least one row.");
    }

    const headers = lines[0]
      .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
      .map((header) => header.trim().replace(/^"|"$/g, ""));

    const rows = lines.slice(1).map((line) => {
      const values = line
        .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
        .map((value) => value.trim().replace(/^"|"$/g, ""));
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });

    return parseImportRows(rows);
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Workbook has no sheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) {
    throw new Error("Workbook has no data rows.");
  }

  return parseImportRows(rows);
}

function createTemplateFile(format: "csv" | "xlsx") {
  const headers = [
    "assetTag",
    "name",
    "category",
    "status",
    "location",
    "description",
    "condition",
    "purchaseDate",
    "warrantyExpiry",
    "supplier",
    "department",
    "ownerName",
    "lastServiceDate",
    "nextServiceDate",
    "meterReading"
  ];
  const sample = [
    "AST-100001",
    "Hydraulic Press 01",
    "Machine",
    "Active",
    "Plant A",
    "Main production press",
    "Good",
    "2025-01-01",
    "2028-01-01",
    "Prime Tools Ltd",
    "Production",
    "Mechanical Team",
    "2026-03-10",
    "2026-09-10",
    "12440"
  ];

  if (format === "csv") {
    const csv = `${headers.join(",")}\n${sample.join(",")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "assets-import-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet([headers, sample]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "assets-import-template.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function summarizeFilters(filters: ReturnType<typeof useAssetPageStore.getState>["filters"]) {
  const parts: string[] = [];
  if (filters.search.trim()) parts.push(`search: ${filters.search.trim()}`);
  if (filters.status) parts.push(`status: ${formatEnumLabel(filters.status)}`);
  if (filters.category) {
    parts.push(
      `category: ${filters.category === "INFRASTRUCTURE" ? "Facility" : formatEnumLabel(filters.category)}`
    );
  }
  if (filters.location) parts.push(`location: ${filters.location}`);
  return parts.join(" | ") || "No filters";
}

function collectActivityChanges(event: AssetActivityEvent) {
  const before =
    event.beforeData && typeof event.beforeData === "object"
      ? (event.beforeData as Record<string, unknown>)
      : {};
  const after =
    event.afterData && typeof event.afterData === "object"
      ? (event.afterData as Record<string, unknown>)
      : {};

  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return keys
    .filter((key) => {
      const left = before[key] == null ? "" : String(before[key]);
      const right = after[key] == null ? "" : String(after[key]);
      return left !== right;
    })
    .slice(0, 8)
    .map((key) => ({
      field: key,
      from: before[key] == null ? "-" : String(before[key]),
      to: after[key] == null ? "-" : String(after[key])
    }));
}

export default function AssetsManagementPage() {
  const queryClient = useQueryClient();
  const {
    filters,
    setFilters,
    clearFilters,
    setPage,
    setPageSize,
    selectedIds,
    clearSelection,
    toggleSelection,
    toggleManySelection,
    visibleColumns,
    toggleColumn,
    highlightedRowId,
    setHighlightedRow
  } = useAssetPageStore();

  const [searchDraft, setSearchDraft] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchDraft, 300);
  const [roleTier, setRoleTier] = useState<RoleTier>("viewer");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [detailsAssetId, setDetailsAssetId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetListItem | AssetDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetListItem | null>(null);
  const [qrTarget, setQrTarget] = useState<AssetListItem | AssetDetail | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [statusPrompt, setStatusPrompt] = useState<{
    assetId: string;
    status: AssetStatus;
    reason: string;
  } | null>(null);
  const [bulkStatus, setBulkStatus] = useState<AssetStatus>("ACTIVE");
  const [bulkLocation, setBulkLocation] = useState("");
  const [bulkCategory, setBulkCategory] = useState<AssetCategory>("MACHINE");
  const [hiddenRowIds, setHiddenRowIds] = useState<Set<string>>(new Set());

  const columnPickerRef = useRef<HTMLDivElement | null>(null);

  const canCreate = roleTier !== "viewer";
  const canEditFields = roleTier === "manager" || roleTier === "admin";
  const canChangeStatus = roleTier === "operator" || roleTier === "manager" || roleTier === "admin";
  const canBulkEdit = roleTier === "manager" || roleTier === "admin";
  const canDelete = roleTier === "admin";
  const canImport = roleTier === "manager" || roleTier === "admin";
  const canExport = true;

  useEffect(() => {
    const stored = getStoredUserInfo();
    setRoleTier(mapRoleTier(stored.roleName));
    setCurrentUserId(stored.id);
  }, []);

  useEffect(() => {
    if (filters.search !== debouncedSearch) {
      setFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch, filters.search, setFilters]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const listQuery = useQuery<AssetListResponse>({
    queryKey: ["assets-list", filters],
    queryFn: async () => {
      const response = await apiClient.get("/assets", {
        params: toQueryParams(filters)
      });

      return {
        items: response.data?.data ?? [],
        meta: response.data?.meta ?? {
          page: 1,
          limit: filters.pageSize,
          total: 0,
          totalPages: 1
        }
      };
    },
    placeholderData: (previous) => previous
  });

  const optionsQuery = useQuery<{ locations: string[] }>({
    queryKey: ["assets-filter-options"],
    queryFn: async () => {
      const response = await apiClient.get("/assets/filter-options");
      return response.data?.data ?? { locations: [] };
    }
  });

  const detailsQuery = useQuery<AssetDetail | null>({
    queryKey: ["asset-detail", detailsAssetId],
    enabled: Boolean(detailsAssetId),
    queryFn: async () => {
      const response = await apiClient.get(`/assets/${detailsAssetId}`);
      return (response.data?.data ?? null) as AssetDetail | null;
    }
  });

  const saveAssetMutation = useMutation({
    mutationFn: async (input: { values: AssetFormValues; assetId?: string }) => {
      const payload = toAssetPayload(input.values);

      if (input.assetId) {
        const response = await apiClient.patch(`/assets/${input.assetId}`, payload);
        return response.data?.data as AssetDetail;
      }

      const response = await apiClient.post("/assets", payload);
      return response.data?.data as AssetDetail;
    },
    onMutate: async (input) => {
      if (!input.assetId) return;

      queryClient.setQueriesData(
        { queryKey: ["assets-list"] },
        (previous: AssetListResponse | undefined) => {
          if (!previous) return previous;
          return {
            ...previous,
            items: previous.items.map((asset) =>
              asset.id === input.assetId
                ? {
                    ...asset,
                    ...toAssetPayload(input.values),
                    name: input.values.name,
                    location: input.values.location,
                    category: input.values.category,
                    status: input.values.status,
                    condition: input.values.condition,
                    supplier: input.values.supplier,
                    department: input.values.department,
                    ownerName: input.values.ownerName,
                    lastServiceDate: input.values.lastServiceDate || null,
                    nextServiceDate: input.values.nextServiceDate || null,
                    purchaseDate: input.values.purchaseDate || null,
                    warrantyExpiry: input.values.warrantyExpiry || null,
                    meterReading: input.values.meterReading || null
                  }
                : asset
            )
          };
        }
      );
    },
    onSuccess: (asset, input) => {
      queryClient.invalidateQueries({ queryKey: ["assets-list"] });
      queryClient.invalidateQueries({ queryKey: ["asset-detail", asset.id] });

      if (input.assetId) {
        toast.success("Asset updated");
      } else {
        toast.success("Asset created");
      }

      setShowFormModal(false);
      setEditingAsset(null);
      setDetailsAssetId(asset.id);
      setHighlightedRow(asset.id);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      queryClient.invalidateQueries({ queryKey: ["assets-list"] });
    }
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (asset: AssetListItem) => {
      await apiClient.delete(`/assets/${asset.id}`);
      return asset;
    },
    onMutate: async (asset) => {
      setHiddenRowIds((current) => {
        const next = new Set(current);
        next.add(asset.id);
        return next;
      });
    },
    onSuccess: (asset) => {
      toast.success("Asset deleted");
      setDeleteTarget(null);
      if (detailsAssetId === asset.id) {
        setDetailsAssetId(null);
      }
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["assets-list"] });
    },
    onError: (error, asset) => {
      setHiddenRowIds((current) => {
        const next = new Set(current);
        next.delete(asset.id);
        return next;
      });
      const message = getErrorMessage(error);
      if (message.toLowerCase().includes("open work orders")) {
        toast.error("Cannot delete - asset has open work orders.");
      } else {
        toast.error(message);
      }
    }
  });

  const statusMutation = useMutation({
    mutationFn: async (input: { assetId: string; status: AssetStatus; reason?: string }) => {
      const response = await apiClient.patch(`/assets/${input.assetId}/status`, {
        status: input.status,
        disposalReason: input.reason,
        disposalDate: input.status === "DISPOSED" ? new Date().toISOString().slice(0, 10) : undefined
      });
      return response.data?.data as AssetDetail;
    },
    onSuccess: (asset) => {
      queryClient.setQueriesData(
        { queryKey: ["assets-list"] },
        (previous: AssetListResponse | undefined) => {
          if (!previous) return previous;
          return {
            ...previous,
            items: previous.items.map((row) =>
              row.id === asset.id ? { ...row, status: asset.status } : row
            )
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["asset-detail", asset.id] });
      toast.success("Status changed");
      setStatusPrompt(null);
      setOpenRowMenuId(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const bulkActionMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await apiClient.post("/assets/bulk-action", payload);
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["assets-list"] });
      clearSelection();
      const action = String(payload.action);
      if (action === "UPDATE_STATUS") {
        toast.success("Bulk status updated");
      } else if (action === "ASSIGN_LOCATION") {
        toast.success("Bulk location assigned");
      } else if (action === "ASSIGN_CATEGORY") {
        toast.success("Bulk category assigned");
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (input: { assetId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", input.file);
      await apiClient.post(`/assets/${input.assetId}/documents`, formData);
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ["asset-detail", input.assetId] });
      toast.success("Document uploaded");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const removeDocumentMutation = useMutation({
    mutationFn: async (input: { assetId: string; documentId: string }) => {
      await apiClient.delete(`/assets/${input.assetId}/documents/${input.documentId}`);
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ["asset-detail", input.assetId] });
      toast.success("Document removed");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const regenerateQrMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiClient.post(`/assets/${assetId}/qr-code/regenerate`);
      return response.data?.data as { qrCodeUrl?: string | null };
    },
    onSuccess: (_, assetId) => {
      queryClient.invalidateQueries({ queryKey: ["assets-list"] });
      queryClient.invalidateQueries({ queryKey: ["asset-detail", assetId] });
      toast.success("QR code regenerated");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const importMutation = useMutation({
    mutationFn: async (items: Array<Record<string, unknown>>) => {
      const response = await apiClient.post("/assets/bulk-import", { items });
      return response.data?.data as { createdCount: number; updatedCount: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["assets-list"] });
      const importedCount = (result?.createdCount ?? 0) + (result?.updatedCount ?? 0);
      toast.success(`${importedCount} assets imported, 0 errors`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const meta = listQuery.data?.meta ?? {
    page: 1,
    limit: filters.pageSize,
    total: 0,
    totalPages: 1
  };

  const rows = useMemo(() => {
    const source = listQuery.data?.items ?? [];
    return source.filter((asset) => !hiddenRowIds.has(asset.id));
  }, [listQuery.data?.items, hiddenRowIds]);

  const selectedCount = selectedIds.length;
  const allRowsSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  const summaryCounts = useMemo(() => {
    return rows.reduce(
      (accumulator, asset) => {
        accumulator.total += 1;
        if (asset.status === "ACTIVE") accumulator.active += 1;
        if (asset.status === "UNDER_MAINTENANCE") accumulator.maintenance += 1;
        if (asset.status === "RETIRED") accumulator.retired += 1;
        if (asset.status === "DISPOSED") accumulator.disposed += 1;
        return accumulator;
      },
      {
        total: 0,
        active: 0,
        maintenance: 0,
        retired: 0,
        disposed: 0
      }
    );
  }, [rows]);

  const filterSummary = useMemo(() => summarizeFilters(filters), [filters]);
  const pageNumbers = useMemo(() => buildPageNumbers(meta.page, meta.totalPages), [meta.page, meta.totalPages]);

  const departmentOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach((asset) => {
      if (asset.department) options.add(asset.department);
    });
    return Array.from(options).sort((left, right) => left.localeCompare(right));
  }, [rows]);

  const ownerOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach((asset) => {
      if (asset.ownerName) options.add(asset.ownerName);
    });
    return Array.from(options).sort((left, right) => left.localeCompare(right));
  }, [rows]);

  const locationOptions = optionsQuery.data?.locations ?? [];

  const selectedRowIdsOnPage = rows.map((asset) => asset.id);

  const detailsAsset = detailsQuery.data;

  async function handleExport(format: ExportFormat, ids?: string[]) {
    const exportColumns = Object.entries(visibleColumns)
      .filter(([column, visible]) => visible && column !== "actions" && column !== "qr")
      .map(([column]) => column)
      .join(",");

    const extension = format === "xlsx" ? "xlsx" : format;

    await downloadBlob(
      "/assets/export",
      ids?.length ? `selected-assets.${extension}` : `assets.${extension}`,
      {
        ...toQueryParams(filters),
        format,
        ids: ids?.length ? ids.join(",") : undefined,
        visibleColumns: exportColumns || undefined
      }
    );
  }

  async function handleDownloadDocument(assetId: string, document: AssetDocument) {
    try {
      if (document.externalUrl) {
        window.open(document.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }

      await downloadBlob(`/assets/${assetId}/documents/${document.id}`, document.name);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleCreateWorkOrder(asset: AssetListItem | AssetDetail) {
    if (!currentUserId) {
      toast.error("Unable to identify current user for work order creation.");
      return;
    }

    try {
      await apiClient.post("/work-orders", {
        title: `Work order for ${asset.name}`,
        description: `Generated from asset ${asset.assetTag}`,
        priority: "MEDIUM",
        type: "CORRECTIVE",
        assetId: asset.id,
        createdById: currentUserId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      toast.success("Work order created");
      queryClient.invalidateQueries({ queryKey: ["asset-detail", asset.id] });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleScheduleMaintenance(asset: AssetListItem | AssetDetail) {
    try {
      await apiClient.post("/maintenance/schedules", {
        name: `${asset.name} preventive schedule`,
        description: `Generated from asset ${asset.assetTag}`,
        type: "PREVENTIVE",
        frequency: "MONTHLY",
        assetId: asset.id,
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      toast.success("Maintenance schedule created");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  function openDetails(assetId: string) {
    setDetailsAssetId(assetId);
    setHighlightedRow(assetId);
  }

  function handleDeleteClick(asset: AssetListItem) {
    const openWorkOrderCount = asset.openWorkOrderCount ?? 0;
    if (openWorkOrderCount > 0) {
      toast.error("Cannot delete - asset has open work orders.");
      return;
    }
    setDeleteTarget(asset);
  }

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Assets</h2>
              <p className="mt-1 text-sm text-slate-500">Centralized asset lifecycle and maintenance tracking.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["assets-list"] });
                  if (detailsAssetId) {
                    queryClient.invalidateQueries({ queryKey: ["asset-detail", detailsAssetId] });
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={16} /> Refresh
              </button>

              {canExport && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowExportMenu((current) => !current);
                      setShowColumnPicker(false);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <FileDown size={16} /> Export <ChevronDown size={14} />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 z-20 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
                      <button
                        onClick={async () => {
                          setShowExportMenu(false);
                          try {
                            await handleExport("csv");
                            toast.success("Export downloaded");
                          } catch (error) {
                            toast.error(getErrorMessage(error));
                          }
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      >
                        Export as CSV
                      </button>
                      <button
                        onClick={async () => {
                          setShowExportMenu(false);
                          try {
                            await handleExport("xlsx");
                            toast.success("Export downloaded");
                          } catch (error) {
                            toast.error(getErrorMessage(error));
                          }
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      >
                        Export as Excel
                      </button>
                      <button
                        onClick={async () => {
                          setShowExportMenu(false);
                          try {
                            await handleExport("pdf");
                            toast.success("Export downloaded");
                          } catch (error) {
                            toast.error(getErrorMessage(error));
                          }
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      >
                        Export as PDF
                      </button>
                    </div>
                  )}
                </div>
              )}

              {canImport && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <FileUp size={16} /> Import
                </button>
              )}

              {canCreate && (
                <button
                  onClick={() => {
                    setEditingAsset(null);
                    setShowFormModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Plus size={16} /> Create Asset
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Total assets" value={summaryCounts.total} tone="slate" />
          <MetricCard label="Active" value={summaryCounts.active} tone="green" />
          <MetricCard label="Under maintenance" value={summaryCounts.maintenance} tone="amber" />
          <MetricCard label="Retired" value={summaryCounts.retired} tone="gray" />
          <MetricCard label="Disposed" value={summaryCounts.disposed} tone="red" />
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1.6fr,1fr,1fr,1fr,1fr,1fr,auto]">
            <label className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search by tag, name, category, location"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>

            <select
              value={filters.status}
              onChange={(event) => setFilters({ status: event.target.value as AssetStatusFilter })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "ALL"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.category}
              onChange={(event) => setFilters({ category: event.target.value as AssetCategoryFilter })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              {CATEGORY_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "ALL"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.location}
              onChange={(event) => setFilters({ location: event.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">All locations</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>

            <select
              value={filters.sortBy}
              onChange={(event) => setFilters({ sortBy: event.target.value as AssetSortField })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {filters.sortOrder === "asc" ? "Asc" : "Desc"}
            </button>

            <div className="flex items-center justify-end">
              {hasActiveFilters(filters) ? (
                <button
                  onClick={() => {
                    clearFilters();
                    setSearchDraft("");
                  }}
                  className="text-sm font-medium text-brand-700 underline decoration-brand-300 underline-offset-4"
                >
                  Clear filters
                </button>
              ) : (
                <span className="text-xs text-slate-400">No active filters</span>
              )}
            </div>
          </div>
        </section>

        {selectedCount > 0 && (
          <section className="rounded-[24px] border border-brand-200 bg-brand-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <p className="text-sm font-semibold text-slate-900">{selectedCount} assets selected</p>
              <div className="flex flex-wrap items-center gap-2">
                {canBulkEdit && (
                  <>
                    <select
                      value={bulkStatus}
                      onChange={(event) => setBulkStatus(event.target.value as AssetStatus)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {STATUS_FORM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        bulkActionMutation.mutate({
                          ids: selectedIds,
                          action: "UPDATE_STATUS",
                          status: bulkStatus
                        })
                      }
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                    >
                      Bulk status
                    </button>

                    <select
                      value={bulkLocation}
                      onChange={(event) => setBulkLocation(event.target.value)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <option value="">Assign location...</option>
                      {locationOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        bulkActionMutation.mutate({
                          ids: selectedIds,
                          action: "ASSIGN_LOCATION",
                          location: bulkLocation
                        })
                      }
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                    >
                      Bulk location
                    </button>

                    <select
                      value={bulkCategory}
                      onChange={(event) => setBulkCategory(event.target.value as AssetCategory)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {CATEGORY_FORM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        bulkActionMutation.mutate({
                          ids: selectedIds,
                          action: "ASSIGN_CATEGORY",
                          category: bulkCategory
                        })
                      }
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                    >
                      Bulk category
                    </button>
                  </>
                )}

                <button
                  onClick={async () => {
                    try {
                      await handleExport("csv", selectedIds);
                      toast.success("Export downloaded");
                    } catch (error) {
                      toast.error(getErrorMessage(error));
                    }
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  Export selected
                </button>
                <button
                  onClick={clearSelection}
                  className="rounded-full border border-transparent px-4 py-2 text-sm text-slate-600 transition hover:text-slate-900"
                >
                  Deselect all
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Asset registry</h3>
              <p className="text-sm text-slate-500">Server-side search, filtering, sorting, and pagination.</p>
            </div>
            <div ref={columnPickerRef} className="relative">
              <button
                onClick={() => {
                  setShowColumnPicker((current) => !current);
                  setShowExportMenu(false);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <Filter size={14} /> Columns
              </button>
              {showColumnPicker && (
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  {COLUMN_OPTIONS.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                      <input
                        type="checkbox"
                        checked={visibleColumns[option.key]}
                        onChange={() => toggleColumn(option.key)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allRowsSelected}
                      onChange={(event) => toggleManySelection(selectedRowIdsOnPage, event.target.checked)}
                    />
                  </th>
                  {visibleColumns.assetTag && <th className="px-4 py-3">Asset Tag</th>}
                  {visibleColumns.name && <th className="px-4 py-3">Name</th>}
                  {visibleColumns.category && <th className="px-4 py-3">Category</th>}
                  {visibleColumns.status && <th className="px-4 py-3">Status</th>}
                  {visibleColumns.location && <th className="px-4 py-3">Location</th>}
                  {visibleColumns.condition && <th className="px-4 py-3">Condition</th>}
                  {visibleColumns.lastServiceDate && <th className="px-4 py-3">Last Service</th>}
                  {visibleColumns.qr && <th className="px-4 py-3">QR</th>}
                  {visibleColumns.actions && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>

              <tbody>
                {listQuery.isLoading ? (
                  <TableSkeletonRows columnCount={Object.values(visibleColumns).filter(Boolean).length + 1} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}>
                      <div className="grid place-items-center gap-3 px-6 py-16 text-center">
                        <p className="text-lg font-semibold text-slate-900">No assets matched the current filters</p>
                        <p className="max-w-2xl text-sm text-slate-500">{filterSummary}</p>
                        <button
                          onClick={() => {
                            clearFilters();
                            setSearchDraft("");
                          }}
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence initial={false}>
                    {rows.map((asset) => {
                      const rowIsHighlighted = highlightedRowId === asset.id;
                      const rowIsSelected = selectedIds.includes(asset.id);
                      const deleteAllowed = canDelete && (asset.openWorkOrderCount ?? 0) === 0;
                      const statusPromptForRow = statusPrompt?.assetId === asset.id ? statusPrompt : null;

                      return (
                        <motion.tr
                          key={asset.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8, height: 0 }}
                          className={`border-t border-slate-100 transition hover:bg-slate-50 ${
                            rowIsHighlighted ? "bg-sky-50/70" : ""
                          }`}
                        >
                          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={rowIsSelected}
                              onChange={() => toggleSelection(asset.id)}
                            />
                          </td>

                          {visibleColumns.assetTag && (
                            <td className="cursor-pointer px-4 py-3 font-medium text-slate-900" onClick={() => openDetails(asset.id)}>
                              {asset.assetTag}
                            </td>
                          )}
                          {visibleColumns.name && (
                            <td className="cursor-pointer px-4 py-3 text-slate-800" onClick={() => openDetails(asset.id)}>
                              {asset.name}
                            </td>
                          )}
                          {visibleColumns.category && (
                            <td className="cursor-pointer px-4 py-3 text-slate-600" onClick={() => openDetails(asset.id)}>
                              {asset.category === "INFRASTRUCTURE" ? "Facility" : formatEnumLabel(asset.category)}
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td className="cursor-pointer px-4 py-3" onClick={() => openDetails(asset.id)}>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[asset.status]}`}>
                                {formatEnumLabel(asset.status)}
                              </span>
                            </td>
                          )}
                          {visibleColumns.location && (
                            <td className="cursor-pointer px-4 py-3 text-slate-600" onClick={() => openDetails(asset.id)}>
                              {asset.location || "-"}
                            </td>
                          )}
                          {visibleColumns.condition && (
                            <td className="cursor-pointer px-4 py-3" onClick={() => openDetails(asset.id)}>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONDITION_STYLES[asset.condition]}`}>
                                {formatEnumLabel(asset.condition)}
                              </span>
                            </td>
                          )}
                          {visibleColumns.lastServiceDate && (
                            <td className="cursor-pointer px-4 py-3 text-slate-600" onClick={() => openDetails(asset.id)}>
                              {asset.lastServiceDate ? formatDate(asset.lastServiceDate) : "Never"}
                            </td>
                          )}
                          {visibleColumns.qr && (
                            <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                              <button
                                onClick={() => setQrTarget(asset)}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
                              >
                                <QrCode size={14} /> View
                              </button>
                            </td>
                          )}

                          {visibleColumns.actions && (
                            <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                              <div className="relative inline-flex justify-end">
                                <button
                                  onClick={() => {
                                    setOpenRowMenuId((current) => (current === asset.id ? null : asset.id));
                                    setStatusPrompt(null);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                                  aria-label="Open row actions"
                                >
                                  <Ellipsis size={14} />
                                </button>

                                {openRowMenuId === asset.id && (
                                  <div className="absolute right-0 top-10 z-20 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl">
                                    <button
                                      onClick={() => {
                                        openDetails(asset.id);
                                        setOpenRowMenuId(null);
                                      }}
                                      className="block w-full rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                                    >
                                      View details
                                    </button>

                                    {canEditFields && (
                                      <button
                                        onClick={() => {
                                          setEditingAsset(asset);
                                          setShowFormModal(true);
                                          setOpenRowMenuId(null);
                                        }}
                                        className="block w-full rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {canChangeStatus && (
                                      <div className="rounded-xl px-2 py-2">
                                        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Change status</p>
                                        <div className="space-y-1">
                                          {QUICK_STATUS_OPTIONS.map((option) => (
                                            <button
                                              key={option.value}
                                              onClick={() => {
                                                setStatusPrompt({
                                                  assetId: asset.id,
                                                  status: option.value,
                                                  reason: ""
                                                });
                                              }}
                                              className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                                            >
                                              {option.label}
                                            </button>
                                          ))}
                                        </div>

                                        {statusPromptForRow && (
                                          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                                            <p>Change status to {formatEnumLabel(statusPromptForRow.status)}?</p>
                                            {statusPromptForRow.status === "DISPOSED" && (
                                              <input
                                                value={statusPromptForRow.reason}
                                                onChange={(event) =>
                                                  setStatusPrompt((current) =>
                                                    current
                                                      ? {
                                                          ...current,
                                                          reason: event.target.value
                                                        }
                                                      : current
                                                  )
                                                }
                                                placeholder="Disposal reason"
                                                className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none"
                                              />
                                            )}
                                            <div className="mt-2 flex gap-2">
                                              <button
                                                onClick={() => {
                                                  if (
                                                    statusPromptForRow.status === "DISPOSED" &&
                                                    !statusPromptForRow.reason.trim()
                                                  ) {
                                                    toast.error("Disposal reason is required.");
                                                    return;
                                                  }
                                                  statusMutation.mutate({
                                                    assetId: asset.id,
                                                    status: statusPromptForRow.status,
                                                    reason: statusPromptForRow.reason
                                                  });
                                                }}
                                                className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                                              >
                                                Confirm
                                              </button>
                                              <button
                                                onClick={() => setStatusPrompt(null)}
                                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {canCreate && (
                                      <button
                                        onClick={() => {
                                          void handleCreateWorkOrder(asset);
                                          setOpenRowMenuId(null);
                                        }}
                                        className="block w-full rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                                      >
                                        Create work order
                                      </button>
                                    )}

                                    {canCreate && (
                                      <button
                                        onClick={() => {
                                          void handleScheduleMaintenance(asset);
                                          setOpenRowMenuId(null);
                                        }}
                                        className="block w-full rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                                      >
                                        Schedule maintenance
                                      </button>
                                    )}

                                    <button
                                      onClick={() => {
                                        setQrTarget(asset);
                                        setOpenRowMenuId(null);
                                      }}
                                      className="block w-full rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                                    >
                                      View QR
                                    </button>

                                    {deleteAllowed && (
                                      <button
                                        onClick={() => {
                                          handleDeleteClick(asset);
                                          setOpenRowMenuId(null);
                                        }}
                                        className="block w-full rounded-xl px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>
                Showing {meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1}-{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} assets
              </span>
              <select
                value={filters.pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, meta.page - 1))}
                disabled={meta.page <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>

              {pageNumbers.map((page) => (
                <button
                  key={page}
                  onClick={() => setPage(page)}
                  className={`h-8 min-w-8 rounded-full border px-2 text-sm ${
                    page === meta.page
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setPage(Math.min(meta.totalPages, meta.page + 1))}
                disabled={meta.page >= meta.totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>
      </div>

      <AssetFormModal
        open={showFormModal}
        asset={editingAsset}
        departmentOptions={departmentOptions}
        ownerOptions={ownerOptions}
        busy={saveAssetMutation.isPending}
        onClose={() => {
          if (saveAssetMutation.isPending) return;
          setShowFormModal(false);
          setEditingAsset(null);
        }}
        onSubmit={(values) =>
          saveAssetMutation.mutate({
            values,
            assetId: editingAsset?.id
          })
        }
      />

      <DeleteConfirmationModal
        asset={deleteTarget}
        busy={deleteAssetMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteAssetMutation.mutate(deleteTarget);
        }}
      />

      <QrModal
        asset={qrTarget}
        canRegenerate={canEditFields}
        busy={regenerateQrMutation.isPending}
        onClose={() => setQrTarget(null)}
        onRegenerate={(assetId) => regenerateQrMutation.mutate(assetId)}
      />

      <BulkImportModal
        open={showImportModal}
        busy={importMutation.isPending}
        onClose={() => setShowImportModal(false)}
        onImport={async (items, errorCount) => {
          const result = await importMutation.mutateAsync(items);
          const importedCount = (result.createdCount ?? 0) + (result.updatedCount ?? 0);
          if (errorCount > 0) {
            toast.warning(`${importedCount} assets imported, ${errorCount} errors`);
          } else {
            toast.success(`${importedCount} assets imported, 0 errors`);
          }
          return result;
        }}
      />

      <AnimatePresence>
        {detailsAssetId && (
          <AssetDetailsDrawer
            asset={detailsAsset}
            loading={detailsQuery.isLoading}
            canEdit={canEditFields}
            canDelete={canDelete}
            canCreate={canCreate}
            onClose={() => setDetailsAssetId(null)}
            onEdit={() => {
              if (!detailsAsset) return;
              setEditingAsset(detailsAsset);
              setShowFormModal(true);
            }}
            onCreateWorkOrder={(asset) => void handleCreateWorkOrder(asset)}
            onUploadDocument={(assetId, file) => uploadDocumentMutation.mutate({ assetId, file })}
            onDownloadDocument={handleDownloadDocument}
            onDeleteDocument={(assetId, documentId) => removeDocumentMutation.mutate({ assetId, documentId })}
            onShowQr={(asset) => setQrTarget(asset)}
            onDeleteAsset={(asset) =>
              setDeleteTarget({
                ...asset,
                openWorkOrderCount: asset.openWorkOrders
              })
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "slate" | "green" | "amber" | "gray" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : tone === "gray"
          ? "border-slate-300 bg-slate-100"
          : tone === "red"
            ? "border-rose-200 bg-rose-50"
            : "border-slate-200 bg-slate-50";

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

function TableSkeletonRows({ columnCount }: { columnCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <tr key={`skeleton-${rowIndex}`} className="border-t border-slate-100">
          <td colSpan={columnCount} className="px-4 py-3">
            <div className="h-8 animate-pulse rounded-xl bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  );
}

function DeleteConfirmationModal({
  asset,
  busy,
  onClose,
  onConfirm
}: {
  asset: AssetListItem | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-700">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Delete {asset.assetTag}?</h3>
            <p className="text-sm text-slate-500">This cannot be undone.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function QrModal({
  asset,
  canRegenerate,
  busy,
  onClose,
  onRegenerate
}: {
  asset: AssetListItem | AssetDetail | null;
  canRegenerate: boolean;
  busy: boolean;
  onClose: () => void;
  onRegenerate: (assetId: string) => void;
}) {
  const qrQuery = useQuery({
    queryKey: ["asset-qr", asset?.id],
    enabled: Boolean(asset?.id),
    queryFn: async () => {
      const response = await apiClient.get(`/assets/${asset!.id}/qr-code`);
      return response.data?.data as {
        qrCodeUrl?: string | null;
      };
    }
  });

  if (!asset) return null;

  const qrCodeUrl = qrQuery.data?.qrCodeUrl ?? asset.qrCodeUrl;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[26px] border border-slate-200 bg-white p-6 shadow-2xl">
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            .qr-print-only,
            .qr-print-only * {
              visibility: visible !important;
            }
            .qr-print-only {
              position: absolute;
              inset: 0;
              margin: auto;
              width: fit-content;
              height: fit-content;
            }
          }
        `}</style>

        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Asset QR</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{asset.assetTag}</h3>
            <p className="text-sm text-slate-500">{asset.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
          <div className="qr-print-only inline-block rounded-xl bg-white p-3 shadow-sm">
            {qrCodeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCodeUrl} alt={`QR for ${asset.assetTag}`} className="h-52 w-52" />
            ) : (
              <div className="grid h-52 w-52 place-items-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                QR is missing for this asset.
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">{asset.assetTag} - {asset.name}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={async () => {
              try {
                await downloadBlob(`/assets/${asset.id}/qr-code/download`, `${asset.assetTag}-qr.png`, {
                  format: "png"
                });
                toast.info("QR downloaded");
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <Download size={14} /> PNG
          </button>
          <button
            onClick={async () => {
              try {
                await downloadBlob(`/assets/${asset.id}/qr-code/download`, `${asset.assetTag}-qr.svg`, {
                  format: "svg"
                });
                toast.info("QR downloaded");
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <Download size={14} /> SVG
          </button>

          {canRegenerate ? (
            <button
              onClick={() => onRegenerate(asset.id)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Re-generate
            </button>
          ) : (
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetFormModal({
  open,
  asset,
  departmentOptions,
  ownerOptions,
  busy,
  onClose,
  onSubmit
}: {
  open: boolean;
  asset: AssetListItem | AssetDetail | null;
  departmentOptions: string[];
  ownerOptions: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: AssetFormValues) => void;
}) {
  const isEditing = Boolean(asset);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyFormValues()
  });

  useEffect(() => {
    form.reset(asset ? mapAssetToForm(asset) : emptyFormValues());
  }, [asset, open, form]);

  const watchedTag = form.watch("assetTag");
  const debouncedTag = useDebouncedValue(watchedTag, 400);

  const duplicateTagQuery = useQuery({
    queryKey: ["asset-tag-check", debouncedTag, asset?.id],
    enabled: open && debouncedTag.trim().length > 3,
    queryFn: async () => {
      const response = await apiClient.get("/assets/validate-tag", {
        params: {
          assetTag: debouncedTag,
          excludeId: asset?.id
        }
      });
      return response.data?.data as { exists: boolean };
    }
  });

  const duplicateExists = Boolean(duplicateTagQuery.data?.exists && (!asset || asset.id));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form
        onSubmit={form.handleSubmit((values) => {
          if (duplicateExists && !isEditing) {
            form.setError("assetTag", {
              type: "validate",
              message: "Tag already exists"
            });
            return;
          }
          onSubmit(values);
        })}
        className="mt-8 w-full max-w-4xl rounded-[26px] border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{isEditing ? "Edit Asset" : "Create Asset"}</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{isEditing ? asset?.name : "New asset record"}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[74vh] space-y-5 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Asset Tag *" error={form.formState.errors.assetTag?.message}>
              <input
                {...form.register("assetTag")}
                readOnly={isEditing}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              />
              {duplicateExists && !isEditing && (
                <p className="mt-1 text-xs text-rose-600">Tag already exists</p>
              )}
            </Field>

            <Field label="Name *" error={form.formState.errors.name?.message}>
              <input
                {...form.register("name")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              />
            </Field>

            <Field label="Category *" error={form.formState.errors.category?.message}>
              <select
                {...form.register("category")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              >
                {CATEGORY_FORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status *" error={form.formState.errors.status?.message}>
              <select
                {...form.register("status")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              >
                {STATUS_FORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Location *" error={form.formState.errors.location?.message}>
              <input
                {...form.register("location")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              />
            </Field>

            <Field label="Condition">
              <select
                {...form.register("condition")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              >
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Purchase Date">
              <input
                type="date"
                {...form.register("purchaseDate")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              />
            </Field>

            <Field label="Warranty Expiry">
              <input
                type="date"
                {...form.register("warrantyExpiry")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              />
            </Field>

            <Field label="Supplier / Vendor">
              <input
                {...form.register("supplier")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              />
            </Field>

            <Field label="Department / Owner">
              <select
                {...form.register("department")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              >
                <option value="">Select department</option>
                {departmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Owner">
              <select
                {...form.register("ownerName")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              >
                <option value="">Select owner</option>
                {ownerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Meter Reading">
              <input
                inputMode="decimal"
                {...form.register("meterReading")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              />
            </Field>

            <Field label="Last Service Date">
              <input
                type="date"
                {...form.register("lastServiceDate")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              />
            </Field>

            <Field label="Next Service Due">
              <input
                type="date"
                {...form.register("nextServiceDate")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              {...form.register("description")}
              className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || (!isEditing && duplicateExists)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {isEditing ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-600">
      <span>{label}</span>
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </label>
  );
}

function BulkImportModal({
  open,
  busy,
  onClose,
  onImport
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onImport: (
    items: Array<Record<string, unknown>>,
    errorCount: number
  ) => Promise<{ createdCount: number; updatedCount: number }>;
}) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [result, setResult] = useState<{ createdCount: number; updatedCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setFileName(null);
      setPreviewRows([]);
      setResult(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const invalidRows = previewRows.filter((row) => row.errors.length > 0);
  const validRows = previewRows.filter((row) => row.payload).map((row) => row.payload!) as Array<Record<string, unknown>>;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="mt-8 w-full max-w-4xl rounded-[26px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Bulk Import</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Import assets in four steps</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            {[1, 2, 3, 4].map((value) => (
              <span
                key={value}
                className={`rounded-full px-3 py-1 ${
                  value === step
                    ? "bg-slate-900 text-white"
                    : value < step
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                Step {value}
              </span>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Download a template in CSV or Excel format.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => createTemplateFile("csv")}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
                >
                  <FileSpreadsheet size={16} /> Download CSV template
                </button>
                <button
                  onClick={() => createTemplateFile("xlsx")}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
                >
                  <FileSpreadsheet size={16} /> Download Excel template
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Upload your completed file.</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                <Upload size={16} /> Upload file
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;

                    setError(null);
                    setResult(null);
                    setFileName(file.name);

                    try {
                      const parsedRows = await readImportFile(file);
                      setPreviewRows(parsedRows);
                      setStep(3);
                    } catch (readError) {
                      setError(getErrorMessage(readError));
                    } finally {
                      event.target.value = "";
                    }
                  }}
                />
              </label>
              {fileName && <p className="text-sm text-slate-500">Selected: {fileName}</p>}
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Preview parsed rows. Valid rows: {validRows.length} | Errors: {invalidRows.length}
                </p>
                <button
                  onClick={async () => {
                    if (validRows.length === 0) {
                      setError("No valid rows to import.");
                      return;
                    }

                    setError(null);
                    const importResult = await onImport(validRows, invalidRows.length);
                    setResult(importResult);
                    setStep(4);
                  }}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />} Confirm import
                </button>
              </div>

              <div className="max-h-[320px] overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Asset Tag</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.rowNumber} className={`border-t ${row.errors.length ? "bg-rose-50" : ""}`}>
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.values.assettag || "-"}</td>
                        <td className="px-3 py-2">{row.values.name || "-"}</td>
                        <td className="px-3 py-2">{row.values.category || "-"}</td>
                        <td className="px-3 py-2">{row.values.status || "-"}</td>
                        <td className="px-3 py-2 text-rose-700">{row.errors.join(" ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p>
                  Import complete. Created: {result?.createdCount ?? 0}, Updated: {result?.updatedCount ?? 0}, Errors: {invalidRows.length}
                </p>
              </div>

              {invalidRows.length > 0 && (
                <div className="max-h-[220px] overflow-auto rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {invalidRows.map((row) => (
                    <p key={row.rowNumber}>Row {row.rowNumber}: {row.errors.join(" ")}</p>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetDetailsDrawer({
  asset,
  loading,
  canEdit,
  canDelete,
  canCreate,
  onClose,
  onEdit,
  onCreateWorkOrder,
  onUploadDocument,
  onDownloadDocument,
  onDeleteDocument,
  onShowQr,
  onDeleteAsset
}: {
  asset: AssetDetail | null | undefined;
  loading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCreateWorkOrder: (asset: AssetDetail) => void;
  onUploadDocument: (assetId: string, file: File) => void;
  onDownloadDocument: (assetId: string, document: AssetDocument) => Promise<void>;
  onDeleteDocument: (assetId: string, documentId: string) => void;
  onShowQr: (asset: AssetDetail) => void;
  onDeleteAsset: (asset: AssetDetail) => void;
}) {
  const [tab, setTab] = useState<DrawerTab>("overview");

  useEffect(() => {
    setTab("overview");
  }, [asset?.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex justify-end bg-slate-950/30"
    >
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">{asset?.assetTag || "Asset"}</h3>
              <p className="mt-1 text-sm text-slate-600">{asset?.name || (loading ? "Loading..." : "Unknown asset")}</p>
              {asset && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[asset.status]}`}>
                    {formatEnumLabel(asset.status)}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONDITION_STYLES[asset.condition]}`}>
                    {formatEnumLabel(asset.condition)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {asset && canEdit && (
                <button
                  onClick={onEdit}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading details...
          </div>
        ) : !asset ? (
          <div className="px-5 py-10 text-sm text-slate-500">No asset selected.</div>
        ) : (
          <div className="space-y-5 px-5 py-5">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTab("overview")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  tab === "overview" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setTab("history")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  tab === "history" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                Maintenance History
              </button>
              <button
                onClick={() => setTab("documents")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  tab === "documents" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                Documents
              </button>
              <button
                onClick={() => setTab("workOrders")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  tab === "workOrders" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                Work Orders
              </button>
              <button
                onClick={() => setTab("activity")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  tab === "activity" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                Activity
              </button>
            </div>

            {tab === "overview" && (
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => onShowQr(asset)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <QrCode size={14} /> View QR
                  </button>
                  {canDelete && asset.openWorkOrders === 0 && (
                    <button
                      onClick={() => onDeleteAsset(asset)}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoRow label="Asset Tag" value={asset.assetTag} />
                  <InfoRow label="Name" value={asset.name} />
                  <InfoRow label="Category" value={asset.category === "INFRASTRUCTURE" ? "Facility" : formatEnumLabel(asset.category)} />
                  <InfoRow label="Status" value={formatEnumLabel(asset.status)} />
                  <InfoRow label="Location" value={asset.location || "-"} />
                  <InfoRow label="Description" value={asset.description || "-"} />
                  <InfoRow label="Condition" value={formatEnumLabel(asset.condition)} />
                  <InfoRow label="Purchase Date" value={formatDate(asset.purchaseDate)} />
                  <InfoRow label="Warranty Expiry" value={formatDate(asset.warrantyExpiry)} />
                  <InfoRow label="Supplier" value={asset.supplier || "-"} />
                  <InfoRow label="Department / Owner" value={asset.department || asset.ownerName || "-"} />
                  <InfoRow label="Last Service Date" value={asset.lastServiceDate ? formatDate(asset.lastServiceDate) : "Never"} />
                  <InfoRow label="Next Service Due" value={formatDate(asset.nextServiceDate)} />
                  <InfoRow label="Meter Reading" value={asset.meterReading == null ? "-" : String(asset.meterReading)} />
                </div>
              </section>
            )}

            {tab === "history" && (
              <section className="rounded-2xl border border-slate-200 p-4">
                {asset.maintenanceLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">No maintenance history available.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Technician</th>
                          <th className="px-3 py-2">Duration</th>
                          <th className="px-3 py-2">Cost</th>
                          <th className="px-3 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asset.maintenanceLogs.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-3 py-2">{formatDate(item.performedAt)}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2">{item.performedBy}</td>
                            <td className="px-3 py-2">-</td>
                            <td className="px-3 py-2">{item.cost == null ? "-" : String(item.cost)}</td>
                            <td className="px-3 py-2">{item.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {tab === "documents" && (
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Asset Documents</p>
                  {canEdit && (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                      <Upload size={14} /> Upload
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            onUploadDocument(asset.id, file);
                          }
                          event.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>

                {asset.documents.length === 0 ? (
                  <p className="text-sm text-slate-500">No documents uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {asset.documents.map((document) => (
                      <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{document.name}</p>
                          <p className="text-xs text-slate-500">{document.mimeType || "file"} - {formatDate(document.uploadedAt)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => void onDownloadDocument(asset.id, document)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                          >
                            Download
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => onDeleteDocument(asset.id, document.id)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {tab === "workOrders" && (
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Linked Work Orders</p>
                  {canCreate && (
                    <button
                      onClick={() => onCreateWorkOrder(asset)}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      <Plus size={14} /> Create work order
                    </button>
                  )}
                </div>
                {asset.workOrders.length === 0 ? (
                  <p className="text-sm text-slate-500">No work orders linked.</p>
                ) : (
                  <div className="space-y-2">
                    {asset.workOrders.map((workOrder) => (
                      <div key={workOrder.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{workOrder.title}</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{workOrder.woNumber}</p>
                          </div>
                          <p className="text-xs text-slate-500">{formatEnumLabel(workOrder.status)} - {formatDate(workOrder.dueDate)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {tab === "activity" && (
              <section className="rounded-2xl border border-slate-200 p-4">
                {asset.activity.length === 0 ? (
                  <p className="text-sm text-slate-500">No activity entries yet.</p>
                ) : (
                  <div className="space-y-3">
                    {asset.activity.map((event) => {
                      const changes = collectActivityChanges(event);
                      return (
                        <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                              {formatEnumLabel(event.action)}
                            </span>
                            <span className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{event.actorName}</p>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            {changes.length === 0 ? (
                              <p>No field-level changes captured.</p>
                            ) : (
                              changes.map((change) => (
                                <p key={`${event.id}-${change.field}`}>
                                  {change.field}: {change.from} {"->"} {change.to}
                                </p>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
