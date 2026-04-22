"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import {
  ArrowUpDown,
  CalendarClock,
  CarFront,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleOff,
  CircleSlash,
  Filter,
  Fuel,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
  type LucideIcon
} from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api-client";
import {
  getStoredRole,
  VEHICLE_DELETE_ROLES,
  VEHICLE_WRITE_ROLES,
  type DashboardRole
} from "@/lib/user-role";

type VehicleType = "CAR" | "MOTORCYCLE" | "TRUCK" | "VAN" | "BUS" | "HEAVY_EQUIPMENT" | "OTHER";
type FuelType = "PETROL" | "DIESEL" | "ELECTRIC" | "HYBRID" | "CNG" | "LPG";
type VehicleStatus = "AVAILABLE" | "IN_USE" | "UNDER_MAINTENANCE" | "OUT_OF_SERVICE" | "DISPOSED";
type SortBy = "createdAt" | "mileage" | "nextServiceDate" | "year";
type SortDir = "asc" | "desc";

interface Vehicle {
  id: string;
  registrationNo: string;
  make: string;
  vehicleModel: string;
  year: number;
  type: VehicleType;
  fuelType: FuelType;
  status: VehicleStatus;
  currentMileage: number | string;
  color?: string | null;
  nextServiceDate?: string | null;
  nextServiceMileage?: number | null;
  updatedAt?: string;
}

interface VehicleSummary {
  totalVehicles: number;
  vehiclesUnderMaintenance: number;
  availableVehicles: number;
  upcomingServices: number;
  overdueMaintenance: number;
  vehiclesInUse: number;
  vehiclesOutOfService: number;
}

interface VehicleAlert {
  id: string;
  type: "UPCOMING_SERVICE" | "OVERDUE_MAINTENANCE" | "STATUS_CHANGE";
  severity: "info" | "warning" | "critical";
  vehicleId: string;
  registrationNo: string;
  title: string;
  message: string;
  status: VehicleStatus;
  dueAt?: string | null;
  createdAt?: string;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

const VEHICLE_TYPES: VehicleType[] = [
  "CAR",
  "MOTORCYCLE",
  "TRUCK",
  "VAN",
  "BUS",
  "HEAVY_EQUIPMENT",
  "OTHER"
];

const FUEL_TYPES: FuelType[] = ["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG"];

const VEHICLE_STATUSES: VehicleStatus[] = [
  "AVAILABLE",
  "IN_USE",
  "UNDER_MAINTENANCE",
  "OUT_OF_SERVICE",
  "DISPOSED"
];

const DEFAULT_SUMMARY: VehicleSummary = {
  totalVehicles: 0,
  vehiclesUnderMaintenance: 0,
  availableVehicles: 0,
  upcomingServices: 0,
  overdueMaintenance: 0,
  vehiclesInUse: 0,
  vehiclesOutOfService: 0
};

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  pageSize: 9,
  total: 0,
  totalPages: 1,
  hasNextPage: false
};

const PAGE_SIZE_OPTIONS = [9, 12, 24, 48];

const STATUS_META: Record<VehicleStatus, { label: string; badgeClass: string; icon: LucideIcon }> = {
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

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "createdAt", label: "Recently Added" },
  { value: "mileage", label: "Mileage" },
  { value: "nextServiceDate", label: "Next Service Date" },
  { value: "year", label: "Year" }
];

export default function VehiclesPage() {
  const [role, setRole] = useState<DashboardRole>("VIEWER");
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<VehicleSummary>(DEFAULT_SUMMARY);
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<VehicleStatus[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [pendingStatusById, setPendingStatusById] = useState<Record<string, boolean>>({});

  const canEdit = VEHICLE_WRITE_ROLES.includes(role);
  const canDelete = VEHICLE_DELETE_ROLES.includes(role);

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const selectedStatusesKey = useMemo(
    () => [...selectedStatuses].sort().join(","),
    [selectedStatuses]
  );

  const loadSummary = useCallback(async () => {
    try {
      const res = await apiClient.get("/vehicles/summary", { params: { upcomingDays: 14 } });
      const payload = res.data?.data ?? res.data;

      if (payload && typeof payload === "object") {
        setSummary({
          totalVehicles: Number(payload.totalVehicles ?? 0),
          vehiclesUnderMaintenance: Number(payload.vehiclesUnderMaintenance ?? 0),
          availableVehicles: Number(payload.availableVehicles ?? 0),
          upcomingServices: Number(payload.upcomingServices ?? 0),
          overdueMaintenance: Number(payload.overdueMaintenance ?? 0),
          vehiclesInUse: Number(payload.vehiclesInUse ?? 0),
          vehiclesOutOfService: Number(payload.vehiclesOutOfService ?? 0)
        });
      }
    } catch {
      // Non-blocking; keep list usable even if summary endpoint is unavailable.
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await apiClient.get("/vehicles/alerts", {
        params: {
          upcomingDays: 14,
          limit: 6
        }
      });

      const payload = res.data?.data ?? res.data;
      const nextAlerts = Array.isArray(payload) ? payload : [];
      setAlerts(nextAlerts);
    } catch {
      setAlerts([]);
    }
  }, []);

  const loadVehicles = useCallback(
    async (options?: { silent?: boolean; pageOverride?: number }) => {
      const targetPage = options?.pageOverride ?? page;

      if (!options?.silent) {
        setLoading(true);
      }

      try {
        const params: Record<string, string | number> = {
          page: targetPage,
          pageSize,
          sortBy,
          sortDir
        };

        if (debouncedQuery) {
          params.q = debouncedQuery;
        }

        if (selectedStatuses.length > 0) {
          params.status = selectedStatuses.join(",");
        }

        const res = await apiClient.get("/vehicles", { params });
        const payload = res.data?.data ?? res.data;

        if (Array.isArray(payload)) {
          setRows(payload);
          setPagination({
            page: 1,
            pageSize: payload.length || pageSize,
            total: payload.length,
            totalPages: 1,
            hasNextPage: false
          });
        } else {
          const items = Array.isArray(payload?.items) ? payload.items : [];
          const nextPagination = payload?.pagination;

          setRows(items);
          setPagination({
            page: Number(nextPagination?.page ?? targetPage),
            pageSize: Number(nextPagination?.pageSize ?? pageSize),
            total: Number(nextPagination?.total ?? items.length),
            totalPages: Number(nextPagination?.totalPages ?? 1),
            hasNextPage: Boolean(nextPagination?.hasNextPage)
          });
        }

        setError(null);
      } catch (err: any) {
        setError(buildErrorMessage(err, "Failed to load vehicles."));
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [debouncedQuery, page, pageSize, selectedStatuses, sortBy, sortDir]
  );

  useEffect(() => {
    void loadSummary();
    void loadAlerts();
  }, [loadSummary, loadAlerts]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  async function refreshAll() {
    await Promise.all([loadVehicles(), loadSummary(), loadAlerts()]);
    toast.success("Vehicle dashboard refreshed.");
  }

  function toggleStatus(status: VehicleStatus) {
    setSelectedStatuses((current) => {
      if (current.includes(status)) {
        return current.filter((value) => value !== status);
      }

      return [...current, status];
    });
    setPage(1);
  }

  function resetFilters() {
    setSearchTerm("");
    setDebouncedQuery("");
    setSelectedStatuses([]);
    setSortBy("createdAt");
    setSortDir("desc");
    setPage(1);
    setPageSize(9);
  }

  async function handleDelete(vehicle: Vehicle) {
    if (!canDelete) {
      toast.error("Only administrators can delete vehicles.");
      return;
    }

    const confirmed = window.confirm(`Delete vehicle ${vehicle.registrationNo}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const previousRows = rows;

    setRows((current) => current.filter((item) => item.id !== vehicle.id));

    try {
      await apiClient.delete(`/vehicles/${vehicle.id}`);
      toast.success(`${vehicle.registrationNo} deleted.`);
      await Promise.all([loadSummary(), loadAlerts()]);

      const expectedRemaining = previousRows.length - 1;
      if (expectedRemaining <= 0 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await loadVehicles({ silent: true });
      }
    } catch (err: any) {
      setRows(previousRows);
      toast.error(buildErrorMessage(err, "Failed to delete vehicle."));
    }
  }

  async function handleStatusUpdate(vehicle: Vehicle, nextStatus: VehicleStatus) {
    if (!canEdit) {
      toast.error("Your role is view-only for vehicle status updates.");
      return;
    }

    if (vehicle.status === nextStatus) {
      return;
    }

    const previousRows = rows;
    setPendingStatusById((current) => ({ ...current, [vehicle.id]: true }));
    setRows((current) =>
      current.map((item) => (item.id === vehicle.id ? { ...item, status: nextStatus } : item))
    );

    try {
      await apiClient.patch(`/vehicles/${vehicle.id}`, { status: nextStatus });
      toast.success(`${vehicle.registrationNo} moved to ${humanizeEnum(nextStatus)}.`);
      await Promise.all([loadSummary(), loadAlerts()]);
    } catch (err: any) {
      setRows(previousRows);
      toast.error(buildErrorMessage(err, "Failed to update vehicle status."));
    } finally {
      setPendingStatusById((current) => {
        const next = { ...current };
        delete next[vehicle.id];
        return next;
      });
    }
  }

  function exportCurrentViewCsv() {
    if (rows.length === 0) {
      toast.error("No vehicle rows to export.");
      return;
    }

    const headers = [
      "Registration",
      "Make",
      "Model",
      "Year",
      "Type",
      "Fuel",
      "Status",
      "Mileage",
      "Next Service Date",
      "Next Service Mileage"
    ];

    const records = rows.map((vehicle) => [
      vehicle.registrationNo,
      vehicle.make,
      vehicle.vehicleModel,
      String(vehicle.year),
      vehicle.type,
      vehicle.fuelType,
      vehicle.status,
      String(Number(vehicle.currentMileage)),
      vehicle.nextServiceDate ? new Date(vehicle.nextServiceDate).toISOString().slice(0, 10) : "",
      vehicle.nextServiceMileage ? String(vehicle.nextServiceMileage) : ""
    ]);

    const csv = [headers, ...records]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vehicles-page-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("Current vehicle view exported as CSV.");
  }

  const summaryCards = useMemo(
    () => [
      {
        title: "Total Vehicles",
        value: summary.totalVehicles,
        icon: CarFront,
        tone: "bg-sky-50 text-sky-800 ring-sky-200"
      },
      {
        title: "Under Maintenance",
        value: summary.vehiclesUnderMaintenance,
        icon: Wrench,
        tone: "bg-amber-50 text-amber-800 ring-amber-200"
      },
      {
        title: "Available Vehicles",
        value: summary.availableVehicles,
        icon: CircleCheck,
        tone: "bg-emerald-50 text-emerald-800 ring-emerald-200"
      },
      {
        title: "Upcoming Services",
        value: summary.upcomingServices,
        icon: CalendarClock,
        tone: "bg-violet-50 text-violet-800 ring-violet-200"
      }
    ],
    [summary]
  );

  const showingFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const showingTo = pagination.total === 0 ? 0 : Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-5 py-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Fleet Operations</p>
            <h2 className="mt-1 text-2xl font-semibold">Vehicle Management</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-200">
              Search, filter, sort, and track your fleet with server-side performance controls, proactive service alerts,
              and role-aware actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-500/70 bg-slate-600/40 px-3 py-2 text-sm text-white transition hover:bg-slate-500/60"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              disabled={!canEdit}
              title={!canEdit ? "Your role cannot register vehicles" : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                canEdit
                  ? "bg-white text-slate-900 hover:bg-slate-100"
                  : "cursor-not-allowed bg-slate-500/50 text-slate-200"
              }`}
            >
              <Plus size={14} /> Register Vehicle
            </button>
          </div>
        </div>
        {!canEdit && (
          <p className="mt-3 rounded-lg border border-slate-500/70 bg-slate-800/60 px-3 py-2 text-xs text-slate-200">
            View-only mode is active for your current role. Edit and create actions are visually disabled.
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.title} title={card.title} value={card.value} icon={card.icon} tone={card.tone} />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CircleAlert size={16} className="text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-800">Service & Status Alerts</h3>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">No active alerts right now.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  alert.severity === "critical"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : alert.severity === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-sky-200 bg-sky-50 text-sky-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{alert.title}</p>
                    <p className="mt-0.5 text-xs opacity-90">{alert.message}</p>
                  </div>
                  <a
                    href={`/vehicles/${alert.vehicleId}`}
                    className="rounded-md border border-current/30 px-2 py-0.5 text-xs font-medium hover:bg-white/70"
                  >
                    {alert.registrationNo}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr,1fr,1fr,auto]">
          <label className="relative block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Search</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-[35px] text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              placeholder="Registration number or model"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-400"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Sort By</span>
            <div className="relative">
              <ArrowUpDown size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as SortBy);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-400"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Order</span>
            <select
              value={sortDir}
              onChange={(event) => {
                setSortDir(event.target.value as SortDir);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Rows</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400"
            >
              {PAGE_SIZE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} / page
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            <Filter size={12} /> Status
          </span>
          {VEHICLE_STATUSES.map((status) => {
            const active = selectedStatuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {humanizeEnum(status)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading vehicles...
        </div>
      ) : rows.length === 0 ? (
        <div className="card py-10 text-center text-sm text-slate-500">
          No vehicles matched your current filters.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((vehicle) => {
            const statusMeta = STATUS_META[vehicle.status];
            const StatusIcon = statusMeta.icon;
            const isPendingStatusUpdate = Boolean(pendingStatusById[vehicle.id]);

            return (
              <article key={vehicle.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {vehicle.registrationNo}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">
                      {vehicle.make} {vehicle.vehicleModel}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">{vehicle.year} model</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusMeta.badgeClass}`}
                  >
                    <StatusIcon size={12} /> {statusMeta.label}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <CarFront size={14} className="text-slate-400" />
                    <span>{humanizeEnum(vehicle.type)} • {humanizeEnum(vehicle.fuelType)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Fuel size={14} className="text-slate-400" />
                    <span>{Number(vehicle.currentMileage).toLocaleString()} km</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarClock size={14} className="text-slate-400" />
                    <span>
                      Next service: {vehicle.nextServiceDate ? formatDate(vehicle.nextServiceDate) : "Not scheduled"}
                    </span>
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Quick Status Update
                    </span>
                    <select
                      value={vehicle.status}
                      disabled={!canEdit || isPendingStatusUpdate}
                      onChange={(event) =>
                        void handleStatusUpdate(vehicle, event.target.value as VehicleStatus)
                      }
                      title={!canEdit ? "Your role cannot change status" : undefined}
                      className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-brand-400 ${
                        !canEdit ? "cursor-not-allowed opacity-60" : ""
                      }`}
                    >
                      {VEHICLE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {humanizeEnum(status)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/vehicles/${vehicle.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Details
                    </a>
                    <button
                      type="button"
                      onClick={() => setEditing(vehicle)}
                      disabled={!canEdit}
                      title={!canEdit ? "Your role cannot edit vehicles" : undefined}
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                        canEdit
                          ? "border-slate-200 text-slate-700 hover:bg-slate-50"
                          : "cursor-not-allowed border-slate-200 text-slate-400"
                      }`}
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(vehicle)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-900">{showingFrom}</span> to{" "}
            <span className="font-semibold text-slate-900">{showingTo}</span> of{" "}
            <span className="font-semibold text-slate-900">{pagination.total}</span> vehicles
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={pagination.page <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-sm text-slate-600">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!pagination.hasNextPage}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Advanced & Future Enhancements</h3>
        <p className="mt-1 text-sm text-slate-600">
          This workspace is now prepared for deeper fleet intelligence modules. Immediate export is available for CSV,
          with PDF and Excel exports staged as next upgrades.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <FutureFeatureCard
            title="Fuel Management"
            description="Track fuel cost, usage, and efficiency trends per vehicle from the details page."
            icon={Fuel}
            tone="bg-emerald-50 text-emerald-800"
          />
          <FutureFeatureCard
            title="GPS & Route History"
            description="Trips tab is future-ready for real-time map trails and route playback."
            icon={CarFront}
            tone="bg-sky-50 text-sky-800"
          />
          <FutureFeatureCard
            title="Predictive Maintenance"
            description="Alerts panel is aligned for AI-driven anomaly and service risk notifications."
            icon={CircleAlert}
            tone="bg-violet-50 text-violet-800"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCurrentViewCsv}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-400"
          >
            Export Excel (coming soon)
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-400"
          >
            Export PDF (coming soon)
          </button>
        </div>
      </section>

      {showCreate && (
        <CreateVehicleModal
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setShowCreate(false);
            toast.success(`${created.registrationNo} registered.`);

            if (
              page === 1 &&
              vehicleMatchesFilters(created, debouncedQuery, selectedStatuses)
            ) {
              setRows((current) => [created, ...current].slice(0, pageSize));
            }

            void Promise.all([loadSummary(), loadAlerts(), loadVehicles({ silent: true })]);
          }}
        />
      )}

      {editing && (
        <EditVehicleModal
          vehicle={editing}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setRows((current) =>
              current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item))
            );
            toast.success(`${saved.registrationNo} updated.`);
            void Promise.all([loadSummary(), loadAlerts()]);
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <article className={`rounded-xl p-4 ring-1 ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{title}</p>
        <Icon size={14} />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value.toLocaleString()}</p>
    </article>
  );
}

function FutureFeatureCard({
  title,
  description,
  icon: Icon,
  tone
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <article className={`rounded-xl p-3 ${tone}`}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon size={14} /> {title}
      </p>
      <p className="mt-1 text-xs opacity-90">{description}</p>
    </article>
  );
}

function CreateVehicleModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (vehicle: Vehicle) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    registrationNo: "",
    make: "",
    vehicleModel: "",
    year: new Date().getFullYear(),
    type: "CAR" as VehicleType,
    fuelType: "PETROL" as FuelType,
    currentMileage: 0
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.registrationNo.trim() || !form.make.trim() || !form.vehicleModel.trim()) {
      setError("Registration, make, and model are required.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await apiClient.post("/vehicles", {
        registrationNo: form.registrationNo.trim(),
        make: form.make.trim(),
        vehicleModel: form.vehicleModel.trim(),
        year: Number(form.year),
        type: form.type,
        fuelType: form.fuelType,
        currentMileage: Number(form.currentMileage) || 0
      });

      const payload = res.data?.data ?? res.data;
      onCreated(payload as Vehicle);
    } catch (err: any) {
      setError(buildErrorMessage(err, "Failed to register vehicle."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Register Vehicle" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Registration No *">
            <input
              required
              value={form.registrationNo}
              onChange={(event) => setForm({ ...form, registrationNo: event.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Year *">
            <input
              type="number"
              min={1990}
              max={2100}
              required
              value={form.year}
              onChange={(event) => setForm({ ...form, year: Number(event.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Make *">
            <input
              required
              value={form.make}
              onChange={(event) => setForm({ ...form, make: event.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Model *">
            <input
              required
              value={form.vehicleModel}
              onChange={(event) => setForm({ ...form, vehicleModel: event.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Type">
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as VehicleType })}
              className={inputCls}
            >
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanizeEnum(type)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fuel">
            <select
              value={form.fuelType}
              onChange={(event) => setForm({ ...form, fuelType: event.target.value as FuelType })}
              className={inputCls}
            >
              {FUEL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanizeEnum(type)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Current Mileage (km)" className="md:col-span-2">
            <input
              type="number"
              min={0}
              value={form.currentMileage}
              onChange={(event) => setForm({ ...form, currentMileage: Number(event.target.value) })}
              className={inputCls}
            />
          </Field>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Create
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditVehicleModal({
  vehicle,
  canEdit,
  onClose,
  onSaved
}: {
  vehicle: Vehicle;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    status: vehicle.status,
    currentMileage: Number(vehicle.currentMileage),
    color: vehicle.color ?? "",
    nextServiceDate: vehicle.nextServiceDate ? vehicle.nextServiceDate.slice(0, 10) : "",
    nextServiceMileage: vehicle.nextServiceMileage ?? 0
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!canEdit) {
      setError("Your role is not authorized to update vehicles.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await apiClient.patch(`/vehicles/${vehicle.id}`, {
        status: form.status,
        currentMileage: Number(form.currentMileage),
        color: form.color.trim() || undefined,
        nextServiceDate: form.nextServiceDate || undefined,
        nextServiceMileage: form.nextServiceMileage ? Number(form.nextServiceMileage) : undefined
      });

      const payload = res.data?.data ?? res.data;
      onSaved((payload as Vehicle) ?? { ...vehicle, ...form });
    } catch (err: any) {
      setError(buildErrorMessage(err, "Failed to update vehicle."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Edit ${vehicle.registrationNo}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Status">
            <select
              value={form.status}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, status: event.target.value as VehicleStatus })}
              className={inputCls}
            >
              {VEHICLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanizeEnum(status)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Current Mileage (km)">
            <input
              type="number"
              min={Number(vehicle.currentMileage)}
              value={form.currentMileage}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, currentMileage: Number(event.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Color">
            <input
              value={form.color}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Next Service Date">
            <input
              type="date"
              value={form.nextServiceDate}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, nextServiceDate: event.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Next Service Mileage" className="md:col-span-2">
            <input
              type="number"
              min={0}
              value={form.nextServiceMileage}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, nextServiceMileage: Number(event.target.value) })}
              className={inputCls}
            />
          </Field>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !canEdit}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Save Changes
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

const inputCls = "w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400";

function Field({
  label,
  children,
  className
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModalShell({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </div>
  );
}

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Invalid date";
  }

  return parsed.toLocaleDateString();
}

function buildErrorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) {
    return message.join(", ");
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function vehicleMatchesFilters(vehicle: Vehicle, query: string, statuses: VehicleStatus[]) {
  const queryMatches = !query
    ? true
    : vehicle.registrationNo.toLowerCase().includes(query.toLowerCase()) ||
      vehicle.vehicleModel.toLowerCase().includes(query.toLowerCase());

  const statusMatches = statuses.length === 0 || statuses.includes(vehicle.status);

  return queryMatches && statusMatches;
}
