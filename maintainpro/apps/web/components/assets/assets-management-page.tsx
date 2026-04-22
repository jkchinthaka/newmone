"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDownUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileDown,
  FileSpreadsheet,
  FileUp,
  HardDrive,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Undo2,
  Upload,
  Wrench,
  X
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { USER_KEY } from "@/lib/auth-storage";

type AssetCategory =
  | "MACHINE"
  | "TOOL"
  | "INFRASTRUCTURE"
  | "EQUIPMENT"
  | "VEHICLE"
  | "OTHER";

type AssetStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "UNDER_MAINTENANCE"
  | "DISPOSED"
  | "RETIRED";

type AssetCondition = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL";

type SortField =
  | "updatedAt"
  | "createdAt"
  | "name"
  | "assetTag"
  | "status"
  | "condition"
  | "nextServiceDate"
  | "purchaseDate";

type ArchivedView = "active" | "all" | "archived";

type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "ASSET_MANAGER"
  | "SUPERVISOR"
  | "MECHANIC"
  | "VIEWER"
  | string;

interface AssetDocument {
  id: string;
  name: string;
  storedName?: string;
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
  description?: string | null;
  category: AssetCategory;
  condition: AssetCondition;
  status: AssetStatus;
  purchaseDate?: string | null;
  purchasePrice?: string | null;
  currentValue?: string | null;
  supplier?: string | null;
  department?: string | null;
  ownerName?: string | null;
  location?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  meterReading?: string | null;
  lastServiceDate?: string | null;
  nextServiceDate?: string | null;
  warrantyExpiry?: string | null;
  disposalDate?: string | null;
  disposalReason?: string | null;
  archivedAt?: string | null;
  qrCodeUrl?: string | null;
  updatedAt: string;
  createdAt: string;
  documentCount: number;
  maintenanceLogCount: number;
  workOrderCount: number;
  isArchived: boolean;
  documents: AssetDocument[];
}

interface MaintenanceHistoryItem {
  id: string;
  description: string;
  performedBy: string;
  performedAt: string;
  cost?: string | null;
  notes?: string | null;
  attachments: string[];
  workOrderId?: string | null;
}

interface WorkOrderSummary {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  dueDate?: string | null;
  estimatedCost?: string | null;
  actualCost?: string | null;
  createdAt: string;
  technician?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
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
  totalMaintenanceCost?: string | null;
}

interface AssetSummary {
  totalAssets: number;
  activeAssets: number;
  underMaintenanceAssets: number;
  dueSoonAssets: number;
  criticalAssets: number;
  archivedAssets: number;
  byCategory: Array<{ key: AssetCategory; count: number }>;
  byCondition: Array<{ key: AssetCondition; count: number }>;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AssetFilters {
  search: string;
  status: AssetStatus | "";
  category: AssetCategory | "";
  condition: AssetCondition | "";
  location: string;
  department: string;
  supplier: string;
  ownerName: string;
  archivedView: ArchivedView;
  page: number;
  limit: number;
  sortBy: SortField;
  sortOrder: "asc" | "desc";
}

interface AssetFormValues {
  assetTag: string;
  name: string;
  description: string;
  category: AssetCategory;
  condition: AssetCondition;
  status: AssetStatus;
  purchaseDate: string;
  purchasePrice: string;
  currentValue: string;
  supplier: string;
  department: string;
  ownerName: string;
  location: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  meterReading: string;
  lastServiceDate: string;
  nextServiceDate: string;
  warrantyExpiry: string;
  disposalDate: string;
  disposalReason: string;
}

interface RemovalDialogState {
  asset: AssetListItem | AssetDetail;
  permanent: boolean;
}

interface ToastMessage {
  id: number;
  tone: "success" | "error" | "info";
  title: string;
  description?: string;
}

const CATEGORY_OPTIONS: AssetCategory[] = [
  "MACHINE",
  "TOOL",
  "INFRASTRUCTURE",
  "EQUIPMENT",
  "VEHICLE",
  "OTHER"
];

const STATUS_OPTIONS: AssetStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "UNDER_MAINTENANCE",
  "DISPOSED",
  "RETIRED"
];

const CONDITION_OPTIONS: AssetCondition[] = [
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "POOR",
  "CRITICAL"
];

const LIMIT_OPTIONS = [10, 20, 50];
const READ_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "MECHANIC", "VIEWER"];
const WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"];
const DELETE_ROLES = ["SUPER_ADMIN", "ADMIN"];

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const selectClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const textareaClassName = `${inputClassName} min-h-[120px] resize-y`;

const STATUS_STYLES: Record<AssetStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-slate-200 text-slate-700",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-800",
  DISPOSED: "bg-rose-100 text-rose-700",
  RETIRED: "bg-slate-300 text-slate-700"
};

const CONDITION_STYLES: Record<AssetCondition, string> = {
  EXCELLENT: "bg-sky-100 text-sky-700",
  GOOD: "bg-emerald-100 text-emerald-700",
  FAIR: "bg-amber-100 text-amber-800",
  POOR: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-rose-100 text-rose-700"
};

function formatEnumLabel(value?: string | null) {
  if (!value) {
    return "-";
  }
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(numeric);
}

function formatDocumentSize(value?: number) {
  if (!value) {
    return "-";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown) {
  const responseMessage =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? (error as { response: { data: { message: string } } }).response.data.message
      : undefined;

  if (responseMessage) {
    return responseMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}

function getStoredRole(): UserRole {
  if (typeof window === "undefined") {
    return "VIEWER";
  }

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    return "VIEWER";
  }

  try {
    const parsed = JSON.parse(raw) as {
      role?: string | { name?: string | null } | null;
    };
    if (typeof parsed.role === "string") {
      return parsed.role;
    }
    if (parsed.role && typeof parsed.role === "object" && typeof parsed.role.name === "string") {
      return parsed.role.name;
    }
  } catch {
    return "VIEWER";
  }

  return "VIEWER";
}

function emptyAssetForm(): AssetFormValues {
  return {
    assetTag: `AST-${Date.now().toString().slice(-6)}`,
    name: "",
    description: "",
    category: "MACHINE",
    condition: "GOOD",
    status: "ACTIVE",
    purchaseDate: "",
    purchasePrice: "",
    currentValue: "",
    supplier: "",
    department: "",
    ownerName: "",
    location: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    meterReading: "",
    lastServiceDate: "",
    nextServiceDate: "",
    warrantyExpiry: "",
    disposalDate: "",
    disposalReason: ""
  };
}

function mapAssetToForm(asset: AssetListItem | AssetDetail): AssetFormValues {
  return {
    assetTag: asset.assetTag,
    name: asset.name,
    description: asset.description ?? "",
    category: asset.category,
    condition: asset.condition,
    status: asset.status,
    purchaseDate: toDateInput(asset.purchaseDate),
    purchasePrice: toInputString(asset.purchasePrice),
    currentValue: toInputString(asset.currentValue),
    supplier: asset.supplier ?? "",
    department: asset.department ?? "",
    ownerName: asset.ownerName ?? "",
    location: asset.location ?? "",
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    serialNumber: asset.serialNumber ?? "",
    meterReading: toInputString(asset.meterReading),
    lastServiceDate: toDateInput(asset.lastServiceDate),
    nextServiceDate: toDateInput(asset.nextServiceDate),
    warrantyExpiry: toDateInput(asset.warrantyExpiry),
    disposalDate: toDateInput(asset.disposalDate),
    disposalReason: asset.disposalReason ?? ""
  };
}

function toInputString(value?: string | null) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function toDateInput(value?: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function toAssetPayload(form: AssetFormValues) {
  const payload: Record<string, unknown> = {
    assetTag: form.assetTag.trim(),
    name: form.name.trim(),
    category: form.category,
    condition: form.condition,
    status: form.status
  };

  const stringFields: Array<keyof Pick<AssetFormValues, "description" | "supplier" | "department" | "ownerName" | "location" | "manufacturer" | "model" | "serialNumber" | "disposalReason">> = [
    "description",
    "supplier",
    "department",
    "ownerName",
    "location",
    "manufacturer",
    "model",
    "serialNumber",
    "disposalReason"
  ];

  stringFields.forEach((field) => {
    const value = form[field].trim();
    if (value) {
      payload[field] = value;
    }
  });

  const numericFields: Array<keyof Pick<AssetFormValues, "purchasePrice" | "currentValue" | "meterReading">> = [
    "purchasePrice",
    "currentValue",
    "meterReading"
  ];

  numericFields.forEach((field) => {
    const value = form[field].trim();
    if (value) {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        payload[field] = numeric;
      }
    }
  });

  const dateFields: Array<keyof Pick<AssetFormValues, "purchaseDate" | "lastServiceDate" | "nextServiceDate" | "warrantyExpiry" | "disposalDate">> = [
    "purchaseDate",
    "lastServiceDate",
    "nextServiceDate",
    "warrantyExpiry",
    "disposalDate"
  ];

  dateFields.forEach((field) => {
    const value = form[field].trim();
    if (value) {
      payload[field] = value;
    }
  });

  if (form.status !== "DISPOSED") {
    delete payload.disposalDate;
    delete payload.disposalReason;
  }

  return payload;
}

function buildQueryParams(filters: AssetFilters) {
  const params: Record<string, string | number | boolean> = {
    page: filters.page,
    limit: filters.limit,
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
  if (filters.condition) {
    params.condition = filters.condition;
  }
  if (filters.location.trim()) {
    params.location = filters.location.trim();
  }
  if (filters.department.trim()) {
    params.department = filters.department.trim();
  }
  if (filters.supplier.trim()) {
    params.supplier = filters.supplier.trim();
  }
  if (filters.ownerName.trim()) {
    params.ownerName = filters.ownerName.trim();
  }
  if (filters.archivedView === "all") {
    params.includeArchived = true;
  }
  if (filters.archivedView === "archived") {
    params.archivedOnly = true;
  }

  return params;
}

function normalizeEnumToken(value: string) {
  return value.trim().replace(/[\s-]+/g, "_").toUpperCase();
}

function isAssetCategory(value: string): value is AssetCategory {
  return CATEGORY_OPTIONS.includes(value as AssetCategory);
}

function isAssetStatus(value: string): value is AssetStatus {
  return STATUS_OPTIONS.includes(value as AssetStatus);
}

function isAssetCondition(value: string): value is AssetCondition {
  return CONDITION_OPTIONS.includes(value as AssetCondition);
}

function splitCsvRow(row: string) {
  return row
    .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
    .map((part) => part.trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"'));
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseImportCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Provide a header row and at least one asset row.");
  }

  const headers = splitCsvRow(lines[0]).map(normalizeCsvHeader);

  return lines.slice(1).map((line, index) => {
    const values = splitCsvRow(line);
    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""]));
    const rowNumber = index + 2;
    const categoryToken = normalizeEnumToken(String(row.category ?? ""));
    const statusToken = normalizeEnumToken(String(row.status ?? "ACTIVE"));
    const conditionToken = normalizeEnumToken(String(row.condition ?? "GOOD"));

    if (!row.assettag || !row.name) {
      throw new Error(`Row ${rowNumber} must include assetTag and name.`);
    }
    if (!isAssetCategory(categoryToken)) {
      throw new Error(`Row ${rowNumber} has an invalid category.`);
    }
    if (String(row.status ?? "") && !isAssetStatus(statusToken)) {
      throw new Error(`Row ${rowNumber} has an invalid status.`);
    }
    if (String(row.condition ?? "") && !isAssetCondition(conditionToken)) {
      throw new Error(`Row ${rowNumber} has an invalid condition.`);
    }

    const payload: Record<string, unknown> = {
      assetTag: String(row.assettag).trim(),
      name: String(row.name).trim(),
      category: categoryToken,
      status: statusToken,
      condition: conditionToken
    };

    const optionalTextMappings: Array<[string, string]> = [
      ["description", "description"],
      ["location", "location"],
      ["supplier", "supplier"],
      ["department", "department"],
      ["ownername", "ownerName"],
      ["manufacturer", "manufacturer"],
      ["model", "model"],
      ["serialnumber", "serialNumber"],
      ["disposalreason", "disposalReason"]
    ];

    optionalTextMappings.forEach(([source, target]) => {
      const value = String(row[source] ?? "").trim();
      if (value) {
        payload[target] = value;
      }
    });

    const optionalDateMappings: Array<[string, string]> = [
      ["purchasedate", "purchaseDate"],
      ["lastservicedate", "lastServiceDate"],
      ["nextservicedate", "nextServiceDate"],
      ["warrantyexpiry", "warrantyExpiry"],
      ["disposaldate", "disposalDate"]
    ];

    optionalDateMappings.forEach(([source, target]) => {
      const value = String(row[source] ?? "").trim();
      if (value) {
        payload[target] = value;
      }
    });

    const optionalNumberMappings: Array<[string, string]> = [
      ["purchaseprice", "purchasePrice"],
      ["currentvalue", "currentValue"],
      ["meterreading", "meterReading"]
    ];

    optionalNumberMappings.forEach(([source, target]) => {
      const value = String(row[source] ?? "").trim();
      if (value) {
        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
          throw new Error(`Row ${rowNumber} has an invalid number for ${target}.`);
        }
        payload[target] = numeric;
      }
    });

    return payload;
  });
}

async function readTextFile(file: File) {
  return file.text();
}

async function downloadBlob(url: string, fallbackName: string, params?: Record<string, unknown>) {
  const response = await apiClient.get(url, {
    params,
    responseType: "blob"
  });
  const blob = new Blob([response.data]);
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export default function AssetsManagementPage() {
  const [filters, setFilters] = useState<AssetFilters>({
    search: "",
    status: "",
    category: "",
    condition: "",
    location: "",
    department: "",
    supplier: "",
    ownerName: "",
    archivedView: "active",
    page: 1,
    limit: 20,
    sortBy: "updatedAt",
    sortOrder: "desc"
  });
  const [rows, setRows] = useState<AssetListItem[]>([]);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [details, setDetails] = useState<AssetDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetListItem | AssetDetail | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [qrAsset, setQrAsset] = useState<AssetListItem | AssetDetail | null>(null);
  const [removalDialog, setRemovalDialog] = useState<RemovalDialogState | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<AssetStatus>("ACTIVE");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [role, setRole] = useState<UserRole>("VIEWER");

  const filterKey = JSON.stringify(filters);
  const canEdit = WRITE_ROLES.includes(role);
  const canDelete = DELETE_ROLES.includes(role);
  const canExport = READ_ROLES.includes(role);
  const selectedCount = selectedIds.size;
  const allRowsSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const currentAsset = details ?? (detailsId ? rows.find((row) => row.id === detailsId) ?? null : null);

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setSummaryLoading(true);
      setError(null);
      try {
        const params = buildQueryParams(filters);
        const [listResponse, summaryResponse] = await Promise.all([
          apiClient.get("/assets", { params }),
          apiClient.get("/assets/summary", { params })
        ]);
        setRows(listResponse.data?.data ?? []);
        setMeta(listResponse.data?.meta ?? { page: 1, limit: filters.limit, total: 0, totalPages: 1 });
        setSummary(summaryResponse.data?.data ?? null);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setLoading(false);
        setSummaryLoading(false);
      }
    }

    void loadData();
  }, [filterKey]);

  useEffect(() => {
    const requestedAssetId = typeof window !== "undefined"
      ? new URL(window.location.href).searchParams.get("assetId")
      : null;

    if (!requestedAssetId || requestedAssetId === detailsId) {
      return;
    }

    void openDetails(requestedAssetId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsId, rows.length]);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [toasts]);

  function pushToast(toast: Omit<ToastMessage, "id">) {
    setToasts((current) => [...current, { id: Date.now() + Math.random(), ...toast }]);
  }

  async function refreshData(nextDetailId?: string | null) {
    const params = buildQueryParams(filters);
    try {
      const [listResponse, summaryResponse] = await Promise.all([
        apiClient.get("/assets", { params }),
        apiClient.get("/assets/summary", { params })
      ]);
      setRows(listResponse.data?.data ?? []);
      setMeta(listResponse.data?.meta ?? meta);
      setSummary(summaryResponse.data?.data ?? summary);
      if (nextDetailId) {
        await loadDetails(nextDetailId);
      }
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Refresh failed",
        description: getErrorMessage(requestError)
      });
    }
  }

  async function loadDetails(id: string) {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const response = await apiClient.get(`/assets/${id}`);
      setDetails(response.data?.data ?? null);
      setDetailsId(id);
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setDetailsError(message);
      pushToast({
        tone: "error",
        title: "Unable to load asset",
        description: message
      });
    } finally {
      setDetailsLoading(false);
    }
  }

  async function openDetails(id: string, syncUrl = true) {
    if (syncUrl && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("assetId", id);
      window.history.replaceState({}, "", url);
    }
    await loadDetails(id);
  }

  function closeDetails() {
    setDetailsId(null);
    setDetails(null);
    setDetailsError(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("assetId");
      window.history.replaceState({}, "", url);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allRowsSelected) {
        rows.forEach((row) => next.delete(row.id));
      } else {
        rows.forEach((row) => next.add(row.id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function updateFilter<K extends keyof AssetFilters>(key: K, value: AssetFilters[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" || key === "limit" ? (value as number) || 1 : 1
    }));
  }

  function resetFilters() {
    setFilters({
      search: "",
      status: "",
      category: "",
      condition: "",
      location: "",
      department: "",
      supplier: "",
      ownerName: "",
      archivedView: "active",
      page: 1,
      limit: 20,
      sortBy: "updatedAt",
      sortOrder: "desc"
    });
  }

  async function saveAsset(form: AssetFormValues) {
    if (!form.assetTag.trim() || !form.name.trim()) {
      throw new Error("Asset tag and name are required.");
    }

    const payload = toAssetPayload(form);
    if (editingAsset) {
      await apiClient.patch(`/assets/${editingAsset.id}`, payload);
      pushToast({
        tone: "success",
        title: "Asset updated",
        description: `${form.name.trim()} was updated successfully.`
      });
      await refreshData(editingAsset.id);
      return;
    }

    const response = await apiClient.post("/assets", payload);
    const created = response.data?.data as AssetDetail;
    pushToast({
      tone: "success",
      title: "Asset created",
      description: `${form.name.trim()} is now tracked in the registry.`
    });
    await refreshData(created?.id ?? null);
    if (created?.id) {
      await openDetails(created.id);
    }
  }

  async function runBulkStatusUpdate() {
    if (selectedCount === 0) {
      return;
    }

    setMutating("bulk-status");
    try {
      await apiClient.post("/assets/bulk-action", {
        ids: Array.from(selectedIds),
        action: "UPDATE_STATUS",
        status: bulkStatus
      });
      pushToast({
        tone: "success",
        title: "Bulk update complete",
        description: `${selectedCount} assets updated to ${formatEnumLabel(bulkStatus)}.`
      });
      clearSelection();
      await refreshData(detailsId);
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Bulk update failed",
        description: getErrorMessage(requestError)
      });
    } finally {
      setMutating(null);
    }
  }

  async function runBulkAction(action: "ARCHIVE" | "RESTORE") {
    if (selectedCount === 0) {
      return;
    }

    setMutating(`bulk-${action.toLowerCase()}`);
    try {
      await apiClient.post("/assets/bulk-action", {
        ids: Array.from(selectedIds),
        action
      });
      pushToast({
        tone: "success",
        title: action === "ARCHIVE" ? "Assets archived" : "Assets restored",
        description: `${selectedCount} assets processed.`
      });
      clearSelection();
      await refreshData(detailsId);
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: action === "ARCHIVE" ? "Archive failed" : "Restore failed",
        description: getErrorMessage(requestError)
      });
    } finally {
      setMutating(null);
    }
  }

  async function exportAssets(ids?: string[]) {
    setMutating("export");
    try {
      const params = buildQueryParams(filters) as Record<string, unknown>;
      if (ids?.length) {
        params.ids = ids.join(",");
      }
      params.format = "xlsx";
      await downloadBlob("/assets/export", ids?.length ? "selected-assets.xlsx" : "assets.xlsx", params);
      pushToast({
        tone: "success",
        title: "Export ready",
        description: ids?.length ? "Selected assets exported." : "Filtered assets exported."
      });
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Export failed",
        description: getErrorMessage(requestError)
      });
    } finally {
      setMutating(null);
    }
  }

  async function confirmRemoval() {
    if (!removalDialog) {
      return;
    }

    setMutating(`remove-${removalDialog.asset.id}`);
    try {
      await apiClient.delete(`/assets/${removalDialog.asset.id}`, {
        params: {
          permanent: removalDialog.permanent
        }
      });
      pushToast({
        tone: "success",
        title: removalDialog.permanent ? "Asset deleted" : "Asset archived",
        description: `${removalDialog.asset.name} has been processed.`
      });
      setRemovalDialog(null);
      clearSelection();
      if (detailsId === removalDialog.asset.id) {
        closeDetails();
      }
      await refreshData();
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: removalDialog.permanent ? "Delete failed" : "Archive failed",
        description: getErrorMessage(requestError)
      });
    } finally {
      setMutating(null);
    }
  }

  async function restoreAsset(id: string) {
    setMutating(`restore-${id}`);
    try {
      await apiClient.post(`/assets/${id}/restore`);
      pushToast({
        tone: "success",
        title: "Asset restored",
        description: "The asset is back in the active registry."
      });
      await refreshData(id);
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Restore failed",
        description: getErrorMessage(requestError)
      });
    } finally {
      setMutating(null);
    }
  }

  async function updateAssetStatus(id: string, status: AssetStatus, disposalReason?: string) {
    setMutating(`status-${id}`);
    try {
      await apiClient.patch(`/assets/${id}/status`, {
        status,
        disposalReason: disposalReason?.trim() || undefined,
        disposalDate: status === "DISPOSED" ? new Date().toISOString().slice(0, 10) : undefined
      });
      pushToast({
        tone: "success",
        title: "Status updated",
        description: `Asset moved to ${formatEnumLabel(status)}.`
      });
      await refreshData(id);
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Status update failed",
        description: getErrorMessage(requestError)
      });
    } finally {
      setMutating(null);
    }
  }

  async function uploadDocument(id: string, file: File) {
    setMutating(`document-${id}`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiClient.post(`/assets/${id}/documents`, formData);
      pushToast({
        tone: "success",
        title: "Document uploaded",
        description: `${file.name} is attached to the asset.`
      });
      await refreshData(id);
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Upload failed",
        description: getErrorMessage(requestError)
      });
    } finally {
      setMutating(null);
    }
  }

  async function downloadDocument(id: string, document: AssetDocument) {
    try {
      if (document.externalUrl) {
        window.open(document.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }
      await downloadBlob(`/assets/${id}/documents/${document.id}`, document.name);
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Download failed",
        description: getErrorMessage(requestError)
      });
    }
  }

  async function removeDocument(id: string, documentId: string) {
    setMutating(`document-remove-${documentId}`);
    try {
      await apiClient.delete(`/assets/${id}/documents/${documentId}`);
      pushToast({
        tone: "success",
        title: "Document removed",
        description: "The file has been removed from the asset record."
      });
      await refreshData(id);
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Document removal failed",
        description: getErrorMessage(requestError)
      });
    } finally {
      setMutating(null);
    }
  }

  async function importAssets(items: Array<Record<string, unknown>>) {
    setMutating("import");
    try {
      const response = await apiClient.post("/assets/bulk-import", { items });
      const result = response.data?.data as { createdCount: number; updatedCount: number };
      pushToast({
        tone: "success",
        title: "Bulk import complete",
        description: `${result?.createdCount ?? 0} created, ${result?.updatedCount ?? 0} updated.`
      });
      setShowImportModal(false);
      clearSelection();
      await refreshData();
    } catch (requestError) {
      pushToast({
        tone: "error",
        title: "Import failed",
        description: getErrorMessage(requestError)
      });
    } finally {
      setMutating(null);
    }
  }

  const categoryShare = useMemo(() => {
    if (!summary || summary.totalAssets === 0) {
      return [];
    }
    return summary.byCategory.map((item) => ({
      ...item,
      percentage: (item.count / summary.totalAssets) * 100
    }));
  }, [summary]);

  const conditionShare = useMemo(() => {
    if (!summary || summary.totalAssets === 0) {
      return [];
    }
    return summary.byCondition.map((item) => ({
      ...item,
      percentage: (item.count / summary.totalAssets) * 100
    }));
  }, [summary]);

  return (
    <>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="absolute inset-y-0 right-0 hidden w-72 rounded-full bg-sky-100/60 blur-3xl lg:block" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">Asset Registry</p>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Assets command center</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Track asset health, ownership, service commitments, documents, and audit history in one operational view.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => refreshData(detailsId)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={16} /> Refresh
              </button>
              {canExport && (
                <button
                  onClick={() => void exportAssets()}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <FileDown size={16} /> Export
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <FileSpreadsheet size={16} /> Bulk import
                  </button>
                  <button
                    onClick={() => {
                      setEditingAsset(null);
                      setShowEditor(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    <Plus size={16} /> New asset
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[2.1fr,1fr]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Tracked assets"
              value={summaryLoading ? "..." : String(summary?.totalAssets ?? 0)}
              subtitle="Current filtered registry"
              tone="sky"
              icon={<HardDrive size={18} />}
            />
            <SummaryCard
              title="Active"
              value={summaryLoading ? "..." : String(summary?.activeAssets ?? 0)}
              subtitle="Ready for dispatch"
              tone="emerald"
              icon={<CheckCircle2 size={18} />}
            />
            <SummaryCard
              title="Maintenance due"
              value={summaryLoading ? "..." : String(summary?.dueSoonAssets ?? 0)}
              subtitle="Within 30 days"
              tone="amber"
              icon={<Wrench size={18} />}
            />
            <SummaryCard
              title="Critical condition"
              value={summaryLoading ? "..." : String(summary?.criticalAssets ?? 0)}
              subtitle="POOR or CRITICAL"
              tone="rose"
              icon={<ShieldAlert size={18} />}
            />
          </div>

          <div className="card space-y-4 rounded-[24px] border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Portfolio mix</p>
                <p className="text-xs text-slate-500">Category and condition distribution</p>
              </div>
              {summary && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {summary.archivedAssets} archived
                </span>
              )}
            </div>
            <div className="space-y-3">
              {categoryShare.length === 0 ? (
                <p className="text-sm text-slate-500">Distribution will appear once assets are available.</p>
              ) : (
                categoryShare.slice(0, 4).map((item) => (
                  <MetricBar key={item.key} label={formatEnumLabel(item.key)} value={item.count} percentage={item.percentage} />
                ))
              )}
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Condition</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {conditionShare.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${CONDITION_STYLES[item.key]}`}>
                        {formatEnumLabel(item.key)}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{item.percentage.toFixed(0)}% of filtered assets</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card space-y-4 rounded-[24px] border-slate-200">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search size={16} className="text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Search asset tag, name, model, supplier, department, owner..."
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">{meta.total} results</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Sorted by {formatEnumLabel(filters.sortBy)}</span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SelectField label="Status" value={filters.status} onChange={(value) => updateFilter("status", value as AssetStatus | "")}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatEnumLabel(option)}
                </option>
              ))}
            </SelectField>
            <SelectField label="Category" value={filters.category} onChange={(value) => updateFilter("category", value as AssetCategory | "")}>
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatEnumLabel(option)}
                </option>
              ))}
            </SelectField>
            <SelectField label="Condition" value={filters.condition} onChange={(value) => updateFilter("condition", value as AssetCondition | "")}>
              <option value="">All conditions</option>
              {CONDITION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatEnumLabel(option)}
                </option>
              ))}
            </SelectField>
            <SelectField label="Archive scope" value={filters.archivedView} onChange={(value) => updateFilter("archivedView", value as ArchivedView)}>
              <option value="active">Active only</option>
              <option value="all">Include archived</option>
              <option value="archived">Archived only</option>
            </SelectField>
            <InputField label="Location" value={filters.location} onChange={(event) => updateFilter("location", event.target.value)} placeholder="Plant, building, or bay" />
            <InputField label="Department" value={filters.department} onChange={(event) => updateFilter("department", event.target.value)} placeholder="Production, facilities..." />
            <InputField label="Supplier" value={filters.supplier} onChange={(event) => updateFilter("supplier", event.target.value)} placeholder="Vendor or partner" />
            <InputField label="Owner" value={filters.ownerName} onChange={(event) => updateFilter("ownerName", event.target.value)} placeholder="Assigned person or team" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <SortButton current={filters} field="updatedAt" onClick={() => toggleSort("updatedAt")} label="Updated" />
              <SortButton current={filters} field="name" onClick={() => toggleSort("name")} label="Name" />
              <SortButton current={filters} field="status" onClick={() => toggleSort("status")} label="Status" />
              <SortButton current={filters} field="condition" onClick={() => toggleSort("condition")} label="Condition" />
              <SortButton current={filters} field="nextServiceDate" onClick={() => toggleSort("nextServiceDate")} label="Next service" />
            </div>
            <button
              onClick={resetFilters}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Reset filters
            </button>
          </div>
        </section>

        {selectedCount > 0 && canEdit && (
          <section className="card flex flex-col gap-3 rounded-[24px] border-brand-200 bg-brand-50/50 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{selectedCount} assets selected</p>
              <p className="text-xs text-slate-500">Run bulk status changes, archive actions, or export the selection.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as AssetStatus)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatEnumLabel(option)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void runBulkStatusUpdate()}
                disabled={Boolean(mutating)}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Apply status
              </button>
              <button
                onClick={() => void runBulkAction("ARCHIVE")}
                disabled={Boolean(mutating)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Archive selected
              </button>
              <button
                onClick={() => void runBulkAction("RESTORE")}
                disabled={Boolean(mutating)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Restore selected
              </button>
              <button
                onClick={() => void exportAssets(Array.from(selectedIds))}
                disabled={Boolean(mutating)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Export selected
              </button>
              <button
                onClick={clearSelection}
                className="rounded-full border border-transparent px-3 py-2 text-sm text-slate-500 transition hover:text-slate-800"
              >
                Clear
              </button>
            </div>
          </section>
        )}

        <section className="card overflow-hidden rounded-[24px] border-slate-200 p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Asset register</h3>
              <p className="text-sm text-slate-500">Sortable registry with document, service, and ownership context.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ArrowDownUp size={16} />
              Page {meta.page} of {meta.totalPages}
            </div>
          </div>

          {error && (
            <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-3 px-5 py-12 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" /> Loading assets...
            </div>
          ) : rows.length === 0 ? (
            <div className="grid place-items-center gap-3 px-5 py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500">
                <HardDrive size={24} />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">No assets matched this view</p>
                <p className="mt-1 text-sm text-slate-500">Adjust filters or add a new asset to populate the registry.</p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => {
                      setEditingAsset(null);
                      setShowEditor(true);
                    }}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Create asset
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    Import CSV
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-5 py-3">
                        <input type="checkbox" checked={allRowsSelected} onChange={toggleAllOnPage} />
                      </th>
                      <th className="px-5 py-3">Asset</th>
                      <th className="px-5 py-3">Condition</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Ownership</th>
                      <th className="px-5 py-3">Service</th>
                      <th className="px-5 py-3">Value</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((asset) => (
                      <tr
                        key={asset.id}
                        onClick={() => void openDetails(asset.id)}
                        className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(asset.id)}
                            onChange={() => toggleSelection(asset.id)}
                          />
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{asset.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{asset.assetTag}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatEnumLabel(asset.category)}
                              {asset.location ? ` • ${asset.location}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${CONDITION_STYLES[asset.condition]}`}>
                              {formatEnumLabel(asset.condition)}
                            </span>
                            <p className="text-xs text-slate-500">{asset.maintenanceLogCount} maintenance logs</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[asset.status]}`}>
                              {formatEnumLabel(asset.status)}
                            </span>
                            <p className="text-xs text-slate-500">{asset.isArchived ? "Archived" : `${asset.workOrderCount} work orders`}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <p>{asset.ownerName || "Unassigned owner"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[asset.department, asset.supplier].filter(Boolean).join(" • ") || "No department or supplier"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <p>Next: {formatDate(asset.nextServiceDate)}</p>
                          <p className="mt-1 text-xs text-slate-500">Last: {formatDate(asset.lastServiceDate)}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <p>{formatCurrency(asset.currentValue)}</p>
                          <p className="mt-1 text-xs text-slate-500">Purchase {formatCurrency(asset.purchasePrice)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                            <button
                              onClick={() => setQrAsset(asset)}
                              className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                              aria-label="View QR"
                            >
                              <QrCode size={15} />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setEditingAsset(asset);
                                  setShowEditor(true);
                                }}
                                className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                                aria-label="Edit asset"
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setRemovalDialog({ asset, permanent: false })}
                                className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                                aria-label="Archive asset"
                              >
                                <Archive size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>
                    Showing {(meta.page - 1) * meta.limit + 1}-{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                  </span>
                  <select
                    value={filters.limit}
                    onChange={(event) => updateFilter("limit", Number(event.target.value))}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {LIMIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option} / page
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateFilter("page", Math.max(1, filters.page - 1))}
                    disabled={filters.page <= 1}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button
                    onClick={() => updateFilter("page", Math.min(meta.totalPages, filters.page + 1))}
                    disabled={filters.page >= meta.totalPages}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <AssetEditorModal
        open={showEditor}
        asset={editingAsset}
        busy={Boolean(mutating)}
        onClose={() => {
          if (mutating) {
            return;
          }
          setShowEditor(false);
          setEditingAsset(null);
        }}
        onSubmit={async (form) => {
          setMutating(editingAsset ? `edit-${editingAsset.id}` : "create");
          try {
            await saveAsset(form);
            setShowEditor(false);
            setEditingAsset(null);
          } finally {
            setMutating(null);
          }
        }}
      />

      <BulkImportModal
        open={showImportModal}
        busy={mutating === "import"}
        onClose={() => setShowImportModal(false)}
        onImport={importAssets}
      />

      <RemovalDialog
        state={removalDialog}
        busy={Boolean(mutating)}
        onClose={() => setRemovalDialog(null)}
        onConfirm={() => void confirmRemoval()}
        onTogglePermanent={(permanent) =>
          setRemovalDialog((current) => (current ? { ...current, permanent } : current))
        }
      />

      <QrPreviewModal asset={qrAsset} onClose={() => setQrAsset(null)} />

      <AssetDetailsDrawer
        open={Boolean(detailsId)}
        loading={detailsLoading}
        asset={currentAsset}
        detail={details}
        error={detailsError}
        canEdit={canEdit}
        canDelete={canDelete}
        busy={mutating}
        onClose={closeDetails}
        onRefresh={() => (detailsId ? refreshData(detailsId) : Promise.resolve())}
        onEdit={() => {
          if (!currentAsset) {
            return;
          }
          setEditingAsset(currentAsset);
          setShowEditor(true);
        }}
        onArchive={() => currentAsset && setRemovalDialog({ asset: currentAsset, permanent: false })}
        onPermanentDelete={() => currentAsset && setRemovalDialog({ asset: currentAsset, permanent: true })}
        onRestore={() => currentAsset && void restoreAsset(currentAsset.id)}
        onStatusUpdate={(status, disposalReason) =>
          currentAsset ? updateAssetStatus(currentAsset.id, status, disposalReason) : Promise.resolve()
        }
        onShowQr={() => currentAsset && setQrAsset(currentAsset)}
        onUploadDocument={(file) =>
          currentAsset ? uploadDocument(currentAsset.id, file) : Promise.resolve()
        }
        onDownloadDocument={(document) =>
          currentAsset ? downloadDocument(currentAsset.id, document) : Promise.resolve()
        }
        onRemoveDocument={(documentId) =>
          currentAsset ? removeDocument(currentAsset.id, documentId) : Promise.resolve()
        }
      />

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </>
  );

  function toggleSort(field: SortField) {
    setFilters((current) => ({
      ...current,
      page: 1,
      sortBy: field,
      sortOrder:
        current.sortBy === field ? (current.sortOrder === "asc" ? "desc" : "asc") : "asc"
    }));
  }
}

function SummaryCard({
  title,
  value,
  subtitle,
  tone,
  icon
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "sky" | "emerald" | "amber" | "rose";
  icon: React.ReactNode;
}) {
  const toneStyles: Record<typeof tone, string> = {
    sky: "from-sky-50 to-white text-sky-700",
    emerald: "from-emerald-50 to-white text-emerald-700",
    amber: "from-amber-50 to-white text-amber-700",
    rose: "from-rose-50 to-white text-rose-700"
  };

  return (
    <article className={`rounded-[24px] border border-slate-200 bg-gradient-to-br p-5 shadow-sm ${toneStyles[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-4 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/80 shadow-sm">{icon}</div>
      </div>
      <p className="mt-4 text-sm text-slate-500">{subtitle}</p>
    </article>
  );
}

function MetricBar({ label, value, percentage }: { label: string; value: number; percentage: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.max(8, percentage)}%` }} />
      </div>
    </div>
  );
}

function SortButton({
  current,
  field,
  label,
  onClick
}: {
  current: AssetFilters;
  field: SortField;
  label: string;
  onClick: () => void;
}) {
  const active = current.sortBy === field;
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition ${
        active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
      {active ? ` • ${current.sortOrder.toUpperCase()}` : ""}
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-600">
      <span>{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder} className={inputClassName} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-600">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClassName}>
        {children}
      </select>
    </label>
  );
}

function AssetEditorModal({
  open,
  asset,
  busy,
  onClose,
  onSubmit
}: {
  open: boolean;
  asset: AssetListItem | AssetDetail | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (form: AssetFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<AssetFormValues>(emptyAssetForm());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(asset ? mapAssetToForm(asset) : emptyAssetForm());
    setError(null);
  }, [asset, open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  function updateField<K extends keyof AssetFormValues>(field: K, value: AssetFormValues[K]) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="mt-8 w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">{asset ? "Edit asset" : "New asset"}</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">
              {asset ? `Update ${asset.name}` : "Create a tracked asset"}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-6 overflow-y-auto px-6 py-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField label="Asset tag *">
              <input value={form.assetTag} onChange={(event) => updateField("assetTag", event.target.value)} className={inputClassName} required />
            </FormField>
            <FormField label="Asset name *">
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} className={inputClassName} required />
            </FormField>
            <FormField label="Category">
              <select value={form.category} onChange={(event) => updateField("category", event.target.value as AssetCategory)} className={selectClassName}>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatEnumLabel(option)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Condition">
              <select value={form.condition} onChange={(event) => updateField("condition", event.target.value as AssetCondition)} className={selectClassName}>
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatEnumLabel(option)}
                  </option>
                ))}
              </select>
            </FormField>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField label="Status">
              <select value={form.status} onChange={(event) => updateField("status", event.target.value as AssetStatus)} className={selectClassName}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatEnumLabel(option)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Owner">
              <input value={form.ownerName} onChange={(event) => updateField("ownerName", event.target.value)} className={inputClassName} />
            </FormField>
            <FormField label="Department">
              <input value={form.department} onChange={(event) => updateField("department", event.target.value)} className={inputClassName} />
            </FormField>
            <FormField label="Supplier">
              <input value={form.supplier} onChange={(event) => updateField("supplier", event.target.value)} className={inputClassName} />
            </FormField>
            <FormField label="Location" className="md:col-span-2">
              <input value={form.location} onChange={(event) => updateField("location", event.target.value)} className={inputClassName} />
            </FormField>
            <FormField label="Manufacturer">
              <input value={form.manufacturer} onChange={(event) => updateField("manufacturer", event.target.value)} className={inputClassName} />
            </FormField>
            <FormField label="Model">
              <input value={form.model} onChange={(event) => updateField("model", event.target.value)} className={inputClassName} />
            </FormField>
            <FormField label="Serial number">
              <input value={form.serialNumber} onChange={(event) => updateField("serialNumber", event.target.value)} className={inputClassName} />
            </FormField>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField label="Purchase date">
              <input type="date" value={form.purchaseDate} onChange={(event) => updateField("purchaseDate", event.target.value)} className={inputClassName} />
            </FormField>
            <FormField label="Purchase price">
              <input inputMode="decimal" value={form.purchasePrice} onChange={(event) => updateField("purchasePrice", event.target.value)} className={inputClassName} placeholder="12000" />
            </FormField>
            <FormField label="Current value">
              <input inputMode="decimal" value={form.currentValue} onChange={(event) => updateField("currentValue", event.target.value)} className={inputClassName} placeholder="9800" />
            </FormField>
            <FormField label="Meter reading">
              <input inputMode="decimal" value={form.meterReading} onChange={(event) => updateField("meterReading", event.target.value)} className={inputClassName} placeholder="12540" />
            </FormField>
            <FormField label="Last service date">
              <input type="date" value={form.lastServiceDate} onChange={(event) => updateField("lastServiceDate", event.target.value)} className={inputClassName} />
            </FormField>
            <FormField label="Next service date">
              <input type="date" value={form.nextServiceDate} onChange={(event) => updateField("nextServiceDate", event.target.value)} className={inputClassName} />
            </FormField>
            <FormField label="Warranty expiry">
              <input type="date" value={form.warrantyExpiry} onChange={(event) => updateField("warrantyExpiry", event.target.value)} className={inputClassName} />
            </FormField>
            {form.status === "DISPOSED" && (
              <>
                <FormField label="Disposal date">
                  <input type="date" value={form.disposalDate} onChange={(event) => updateField("disposalDate", event.target.value)} className={inputClassName} />
                </FormField>
                <FormField label="Disposal reason" className="md:col-span-2 xl:col-span-3">
                  <input value={form.disposalReason} onChange={(event) => updateField("disposalReason", event.target.value)} className={inputClassName} placeholder="Reason for disposal" />
                </FormField>
              </>
            )}
          </section>

          <FormField label="Description">
            <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} className={textareaClassName} placeholder="What is this asset used for, what does the team need to know, and what risks exist?" />
          </FormField>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {asset ? "Save changes" : "Create asset"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`space-y-2 text-sm text-slate-600 ${className ?? ""}`}>
      <span>{label}</span>
      {children}
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
  onImport: (items: Array<Record<string, unknown>>) => Promise<void>;
}) {
  const [csvText, setCsvText] = useState("");
  const [previewCount, setPreviewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCsvText("");
      setPreviewCount(0);
      setError(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await readTextFile(file);
      setCsvText(text);
      const parsed = parseImportCsv(text);
      setPreviewCount(parsed.length);
      setError(null);
    } catch (uploadError) {
      setPreviewCount(0);
      setError(getErrorMessage(uploadError));
    } finally {
      event.target.value = "";
    }
  }

  function handlePreview() {
    try {
      const parsed = parseImportCsv(csvText);
      setPreviewCount(parsed.length);
      setError(null);
    } catch (previewError) {
      setPreviewCount(0);
      setError(getErrorMessage(previewError));
    }
  }

  async function handleImport() {
    try {
      const parsed = parseImportCsv(csvText);
      setPreviewCount(parsed.length);
      setError(null);
      await onImport(parsed);
    } catch (importError) {
      setError(getErrorMessage(importError));
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="mt-12 w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">Bulk import</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Upload or paste asset rows</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Use CSV headers like <span className="font-medium text-slate-900">assetTag, name, category, condition, status, location, department, ownerName</span>.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
              <Upload size={16} /> Upload CSV
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <button onClick={handlePreview} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
              Preview rows
            </button>
            <span className="text-sm text-slate-500">{previewCount > 0 ? `${previewCount} rows ready` : "No preview yet"}</span>
          </div>

          <textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            className={`${textareaClassName} min-h-[240px] font-mono text-xs`}
            placeholder={'assetTag,name,category,condition,status,location\nAST-1001,Hydraulic Press,MACHINE,GOOD,ACTIVE,Plant A'}
          />

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
            Close
          </button>
          <button onClick={() => void handleImport()} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />}
            Import assets
          </button>
        </div>
      </div>
    </div>
  );
}

function RemovalDialog({
  state,
  busy,
  onClose,
  onConfirm,
  onTogglePermanent
}: {
  state: RemovalDialogState | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onTogglePermanent: (value: boolean) => void;
}) {
  if (!state) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-700">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Confirm asset removal</h3>
            <p className="text-sm text-slate-500">{state.asset.name}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4 text-sm text-slate-600">
          <p>
            Default behavior archives the asset and removes it from active views. Permanent delete removes the record and any uploaded documents.
          </p>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input type="checkbox" checked={state.permanent} onChange={(event) => onTogglePermanent(event.target.checked)} />
            <span>Delete permanently instead of archiving</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {state.permanent ? "Delete permanently" : "Archive asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QrPreviewModal({ asset, onClose }: { asset: AssetListItem | AssetDetail | null; onClose: () => void }) {
  if (!asset) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">Asset QR</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{asset.assetTag}</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-6">
          {asset.qrCodeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.qrCodeUrl} alt={`QR for ${asset.assetTag}`} className="mx-auto h-56 w-56 rounded-2xl bg-white p-3 shadow-sm" />
          ) : (
            <div className="grid h-56 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
              QR not available for this asset yet.
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={() => void downloadBlob(`/assets/${asset.id}/qr-code/download`, `${asset.assetTag}-qr.png`)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            <Download size={16} /> Download QR
          </button>
          <button onClick={onClose} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetDetailsDrawer({
  open,
  loading,
  asset,
  detail,
  error,
  canEdit,
  canDelete,
  busy,
  onClose,
  onRefresh,
  onEdit,
  onArchive,
  onPermanentDelete,
  onRestore,
  onStatusUpdate,
  onShowQr,
  onUploadDocument,
  onDownloadDocument,
  onRemoveDocument
}: {
  open: boolean;
  loading: boolean;
  asset: AssetListItem | AssetDetail | null;
  detail: AssetDetail | null;
  error: string | null;
  canEdit: boolean;
  canDelete: boolean;
  busy: string | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onEdit: () => void;
  onArchive: () => void;
  onPermanentDelete: () => void;
  onRestore: () => void;
  onStatusUpdate: (status: AssetStatus, disposalReason?: string) => Promise<void>;
  onShowQr: () => void;
  onUploadDocument: (file: File) => Promise<void>;
  onDownloadDocument: (document: AssetDocument) => Promise<void>;
  onRemoveDocument: (documentId: string) => Promise<void>;
}) {
  const [statusDraft, setStatusDraft] = useState<AssetStatus>(detail?.status ?? asset?.status ?? "ACTIVE");
  const [disposalReason, setDisposalReason] = useState("");

  useEffect(() => {
    setStatusDraft(detail?.status ?? asset?.status ?? "ACTIVE");
    setDisposalReason(detail?.disposalReason ?? "");
  }, [asset, detail]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/20 backdrop-blur-[2px]">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">Asset details</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">{asset?.name ?? "Loading asset"}</h3>
              <p className="mt-2 text-sm text-slate-500">{asset?.assetTag ?? "--"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void onRefresh()} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100">
                <RefreshCw size={16} />
              </button>
              <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 px-6 py-10 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" /> Loading asset details...
          </div>
        ) : error ? (
          <div className="m-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : !detail ? (
          <div className="px-6 py-10 text-sm text-slate-500">Select an asset to inspect its full record.</div>
        ) : (
          <div className="space-y-6 px-6 py-6">
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[detail.status]}`}>
                      {formatEnumLabel(detail.status)}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${CONDITION_STYLES[detail.condition]}`}>
                      {formatEnumLabel(detail.condition)}
                    </span>
                    {detail.isArchived && (
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">Archived</span>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniMetric label="Open work orders" value={String(detail.openWorkOrders)} />
                    <MiniMetric label="Maintenance spend" value={formatCurrency(detail.totalMaintenanceCost)} />
                    <MiniMetric label="Documents" value={String(detail.documents.length)} />
                    <MiniMetric label="Last updated" value={formatDate(detail.updatedAt)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={onShowQr} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                    <QrCode size={16} /> QR
                  </button>
                  {canEdit && (
                    <button onClick={onEdit} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                      <Pencil size={16} /> Edit
                    </button>
                  )}
                  {detail.isArchived ? (
                    canEdit && (
                      <button onClick={onRestore} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">
                        <Undo2 size={16} /> Restore
                      </button>
                    )
                  ) : (
                    canDelete && (
                      <button onClick={onArchive} className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700">
                        <Archive size={16} /> Archive
                      </button>
                    )
                  )}
                </div>
              </div>
            </section>

            {canEdit && !detail.isArchived && (
              <section className="rounded-[24px] border border-slate-200 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Quick status change</p>
                    <p className="text-xs text-slate-500">Move the asset through lifecycle states without opening the edit form.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as AssetStatus)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {formatEnumLabel(option)}
                        </option>
                      ))}
                    </select>
                    {statusDraft === "DISPOSED" && (
                      <input value={disposalReason} onChange={(event) => setDisposalReason(event.target.value)} placeholder="Disposal reason" className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none" />
                    )}
                    <button
                      onClick={() => void onStatusUpdate(statusDraft, disposalReason)}
                      disabled={Boolean(busy)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="grid gap-4 md:grid-cols-2">
              <InfoCard title="Ownership">
                <InfoRow label="Owner" value={detail.ownerName || "-"} />
                <InfoRow label="Department" value={detail.department || "-"} />
                <InfoRow label="Supplier" value={detail.supplier || "-"} />
                <InfoRow label="Location" value={detail.location || "-"} />
              </InfoCard>
              <InfoCard title="Technical">
                <InfoRow label="Manufacturer" value={detail.manufacturer || "-"} />
                <InfoRow label="Model" value={detail.model || "-"} />
                <InfoRow label="Serial number" value={detail.serialNumber || "-"} />
                <InfoRow label="Meter reading" value={detail.meterReading || "-"} />
              </InfoCard>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <InfoCard title="Financial and lifecycle">
                <InfoRow label="Purchase date" value={formatDate(detail.purchaseDate)} />
                <InfoRow label="Purchase price" value={formatCurrency(detail.purchasePrice)} />
                <InfoRow label="Current value" value={formatCurrency(detail.currentValue)} />
                <InfoRow label="Warranty expiry" value={formatDate(detail.warrantyExpiry)} />
              </InfoCard>
              <InfoCard title="Service planning">
                <InfoRow label="Last service" value={formatDate(detail.lastServiceDate)} />
                <InfoRow label="Next service" value={formatDate(detail.nextServiceDate)} />
                <InfoRow label="Maintenance logs" value={String(detail.maintenanceLogs.length)} />
                <InfoRow label="Linked work orders" value={String(detail.workOrders.length)} />
              </InfoCard>
            </section>

            <section className="rounded-[24px] border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Documents</p>
                  <p className="text-xs text-slate-500">Upload manuals, warranties, invoices, or audit evidence.</p>
                </div>
                {canEdit && (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                    <Upload size={16} /> Upload file
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void onUploadDocument(file);
                        }
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {detail.documents.length === 0 ? (
                  <p className="text-sm text-slate-500">No documents attached yet.</p>
                ) : (
                  detail.documents.map((document) => (
                    <div key={document.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{document.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(document.uploadedAt)} • {formatDocumentSize(document.size)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => void onDownloadDocument(document)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                          Download
                        </button>
                        {canEdit && (
                          <button onClick={() => void onRemoveDocument(document.id)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 p-5">
              <div className="flex items-center gap-2">
                <Wrench size={18} className="text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Maintenance history</p>
                  <p className="text-xs text-slate-500">Latest completed work with technician notes and cost.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {detail.maintenanceLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">No maintenance history recorded yet.</p>
                ) : (
                  detail.maintenanceLogs.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">{item.description}</p>
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.cost)}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {item.performedBy} • {formatDateTime(item.performedAt)}
                      </p>
                      {item.notes && <p className="mt-2 text-sm text-slate-600">{item.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 p-5">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Related work orders</p>
                  <p className="text-xs text-slate-500">Open, historical, and assigned work requests tied to this asset.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {detail.workOrders.length === 0 ? (
                  <p className="text-sm text-slate-500">No work orders linked to this asset yet.</p>
                ) : (
                  detail.workOrders.map((workOrder) => (
                    <div key={workOrder.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{workOrder.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{workOrder.woNumber}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>{formatEnumLabel(workOrder.status)} • {formatEnumLabel(workOrder.priority)}</p>
                          <p className="mt-1">Due {formatDate(workOrder.dueDate)}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {workOrder.technician?.firstName || workOrder.technician?.lastName
                          ? `Assigned to ${[workOrder.technician?.firstName, workOrder.technician?.lastName].filter(Boolean).join(" ")}`
                          : "Technician not assigned"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Audit trail</p>
                  <p className="text-xs text-slate-500">Chronological activity recorded against the asset.</p>
                </div>
                {canDelete && !detail.isArchived && (
                  <button onClick={onPermanentDelete} className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-100">
                    <Trash2 size={16} /> Delete permanently
                  </button>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {detail.activity.length === 0 ? (
                  <p className="text-sm text-slate-500">No activity entries recorded yet.</p>
                ) : (
                  detail.activity.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">{formatEnumLabel(event.action)}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Recorded by {event.actorName}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-slate-200 p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function ToastViewport({
  toasts,
  onDismiss
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg ${
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50"
              : toast.tone === "error"
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">{toast.title}</p>
              {toast.description && <p className="mt-1 text-sm text-slate-600">{toast.description}</p>}
            </div>
            <button onClick={() => onDismiss(toast.id)} className="rounded-full p-1 text-slate-400 transition hover:bg-white/80 hover:text-slate-700">
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
