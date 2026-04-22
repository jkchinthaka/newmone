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
  ArrowLeft,
  CalendarClock,
  CarFront,
  CircleAlert,
  CircleCheck,
  CircleOff,
  CircleSlash,
  ClipboardList,
  Fuel,
  Loader2,
  Route,
  Save,
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
type DetailTab = "overview" | "maintenance" | "fuel" | "trips";

type ServiceType =
  | "OIL_CHANGE"
  | "REPAIR"
  | "INSPECTION"
  | "TIRE"
  | "BRAKE"
  | "BATTERY"
  | "GENERAL";

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
  insuranceExpiry?: string | null;
  roadTaxExpiry?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
}

interface MaintenanceLog {
  id: string;
  description: string;
  performedBy: string;
  performedAt: string;
  cost?: number | string | null;
  notes?: string | null;
  attachments?: string[];
}

interface FuelLog {
  id: string;
  date: string;
  liters: number | string;
  costPerLiter: number | string;
  totalCost: number | string;
  mileageAtFuel: number | string;
  fuelStation?: string | null;
  notes?: string | null;
}

interface FuelAnalytics {
  averageConsumptionLPer100Km: number;
  costPerKm: number;
  monthlyFuelCostTrend: Array<{ month: string; totalCost: number }>;
}

interface TripLog {
  id: string;
  startLocation: string;
  endLocation: string;
  startMileage: number | string;
  endMileage: number | string;
  distance: number | string;
  startTime: string;
  endTime?: string | null;
  purpose?: string | null;
  status: string;
  notes?: string | null;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

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

const TABS: Array<{ value: DetailTab; label: string; icon: LucideIcon }> = [
  { value: "overview", label: "Overview", icon: ClipboardList },
  { value: "maintenance", label: "Maintenance History", icon: Wrench },
  { value: "fuel", label: "Fuel Logs", icon: Fuel },
  { value: "trips", label: "Trips", icon: Route }
];

const SERVICE_TYPES: ServiceType[] = [
  "OIL_CHANGE",
  "REPAIR",
  "INSPECTION",
  "TIRE",
  "BRAKE",
  "BATTERY",
  "GENERAL"
];

const DEFAULT_MAINTENANCE_PAGINATION: PaginationState = {
  page: 1,
  pageSize: 6,
  total: 0,
  totalPages: 1,
  hasNextPage: false
};

const DEFAULT_FUEL_ANALYTICS: FuelAnalytics = {
  averageConsumptionLPer100Km: 0,
  costPerKm: 0,
  monthlyFuelCostTrend: []
};

export default function VehicleDetailsPage({ params }: { params: { id: string } }) {
  const vehicleId = params.id;

  const [role, setRole] = useState<DashboardRole>("VIEWER");
  const canEdit = VEHICLE_WRITE_ROLES.includes(role);
  const canDelete = VEHICLE_DELETE_ROLES.includes(role);

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);

  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [maintenancePagination, setMaintenancePagination] = useState<PaginationState>(DEFAULT_MAINTENANCE_PAGINATION);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [fuelAnalytics, setFuelAnalytics] = useState<FuelAnalytics>(DEFAULT_FUEL_ANALYTICS);
  const [fuelLoading, setFuelLoading] = useState(false);

  const [trips, setTrips] = useState<TripLog[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);

  const [maintenanceInitialized, setMaintenanceInitialized] = useState(false);
  const [fuelInitialized, setFuelInitialized] = useState(false);
  const [tripsInitialized, setTripsInitialized] = useState(false);

  const [statusSaving, setStatusSaving] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [fuelSaving, setFuelSaving] = useState(false);

  const [maintenanceForm, setMaintenanceForm] = useState({
    serviceType: "GENERAL" as ServiceType,
    description: "",
    performedBy: "",
    performedAt: new Date().toISOString().slice(0, 10),
    cost: 0,
    notes: "",
    attachmentsText: "",
    markAvailableAfterSave: true
  });

  const [fuelForm, setFuelForm] = useState({
    liters: 0,
    costPerLiter: 0,
    mileageAtFuel: 0,
    fuelStation: "",
    notes: ""
  });

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  const loadVehicle = useCallback(async () => {
    setLoadingVehicle(true);
    try {
      const res = await apiClient.get(`/vehicles/${vehicleId}`);
      const payload = (res.data?.data ?? res.data) as Vehicle;
      setVehicle(payload);
      setVehicleError(null);
    } catch (err: any) {
      setVehicleError(buildErrorMessage(err, "Unable to load vehicle details."));
    } finally {
      setLoadingVehicle(false);
    }
  }, [vehicleId]);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await apiClient.get("/vehicles/alerts", {
        params: {
          upcomingDays: 21,
          limit: 30
        }
      });
      const payload = res.data?.data ?? res.data;
      const nextAlerts = (Array.isArray(payload) ? payload : []).filter(
        (item) => item.vehicleId === vehicleId
      );
      setAlerts(nextAlerts);
    } catch {
      setAlerts([]);
    }
  }, [vehicleId]);

  const loadMaintenance = useCallback(
    async (page = 1) => {
      setMaintenanceLoading(true);

      try {
        const res = await apiClient.get("/maintenance/logs", {
          params: {
            vehicleId,
            page,
            pageSize: maintenancePagination.pageSize
          }
        });

        const payload = res.data?.data ?? res.data;

        if (Array.isArray(payload)) {
          setMaintenanceLogs(payload);
          setMaintenancePagination({
            page: 1,
            pageSize: payload.length || maintenancePagination.pageSize,
            total: payload.length,
            totalPages: 1,
            hasNextPage: false
          });
        } else {
          const items = Array.isArray(payload?.items) ? payload.items : [];
          const nextPagination = payload?.pagination;

          setMaintenanceLogs(items);
          setMaintenancePagination({
            page: Number(nextPagination?.page ?? page),
            pageSize: Number(nextPagination?.pageSize ?? maintenancePagination.pageSize),
            total: Number(nextPagination?.total ?? items.length),
            totalPages: Number(nextPagination?.totalPages ?? 1),
            hasNextPage: Boolean(nextPagination?.hasNextPage)
          });
        }
      } catch (err: any) {
        toast.error(buildErrorMessage(err, "Failed to load maintenance logs."));
      } finally {
        setMaintenanceLoading(false);
      }
    },
    [vehicleId, maintenancePagination.pageSize]
  );

  const loadFuel = useCallback(async () => {
    setFuelLoading(true);
    try {
      const [logsRes, analyticsRes] = await Promise.all([
        apiClient.get(`/vehicles/${vehicleId}/fuel-logs`),
        apiClient.get(`/vehicles/${vehicleId}/fuel-analytics`)
      ]);

      const logsPayload = logsRes.data?.data ?? logsRes.data;
      setFuelLogs(Array.isArray(logsPayload) ? logsPayload : []);

      const analyticsPayload = analyticsRes.data?.data ?? analyticsRes.data;
      setFuelAnalytics(
        analyticsPayload && typeof analyticsPayload === "object"
          ? {
              averageConsumptionLPer100Km: Number(analyticsPayload.averageConsumptionLPer100Km ?? 0),
              costPerKm: Number(analyticsPayload.costPerKm ?? 0),
              monthlyFuelCostTrend: Array.isArray(analyticsPayload.monthlyFuelCostTrend)
                ? analyticsPayload.monthlyFuelCostTrend
                : []
            }
          : DEFAULT_FUEL_ANALYTICS
      );
    } catch (err: any) {
      toast.error(buildErrorMessage(err, "Failed to load fuel logs."));
    } finally {
      setFuelLoading(false);
    }
  }, [vehicleId]);

  const loadTrips = useCallback(async () => {
    setTripsLoading(true);
    try {
      const res = await apiClient.get(`/vehicles/${vehicleId}/trips`);
      const payload = res.data?.data ?? res.data;
      setTrips(Array.isArray(payload) ? payload : []);
    } catch (err: any) {
      toast.error(buildErrorMessage(err, "Failed to load trips."));
    } finally {
      setTripsLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void Promise.all([loadVehicle(), loadAlerts()]);
  }, [loadVehicle, loadAlerts]);

  useEffect(() => {
    if (activeTab === "maintenance" && !maintenanceInitialized) {
      setMaintenanceInitialized(true);
      void loadMaintenance(1);
    }

    if (activeTab === "fuel" && !fuelInitialized) {
      setFuelInitialized(true);
      void loadFuel();
    }

    if (activeTab === "trips" && !tripsInitialized) {
      setTripsInitialized(true);
      void loadTrips();
    }
  }, [
    activeTab,
    fuelInitialized,
    loadFuel,
    loadMaintenance,
    loadTrips,
    maintenanceInitialized,
    tripsInitialized
  ]);

  const serviceReminder = useMemo(() => {
    if (!vehicle?.nextServiceDate) {
      return {
        tone: "neutral" as const,
        title: "No service date scheduled",
        description: "Set the next service date to activate reminders and proactive alerts."
      };
    }

    const due = new Date(vehicle.nextServiceDate);
    const now = new Date();
    const msRemaining = due.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return {
        tone: "critical" as const,
        title: "Maintenance overdue",
        description: `Service due ${Math.abs(daysRemaining)} day(s) ago (${due.toLocaleDateString()}).`
      };
    }

    if (daysRemaining <= 14) {
      return {
        tone: "warning" as const,
        title: "Service due soon",
        description: `Service is due in ${daysRemaining} day(s) (${due.toLocaleDateString()}).`
      };
    }

    return {
      tone: "healthy" as const,
      title: "Service schedule healthy",
      description: `Next service is scheduled for ${due.toLocaleDateString()}.`
    };
  }, [vehicle?.nextServiceDate]);

  async function updateVehicleStatus(nextStatus: VehicleStatus, options?: { silentToast?: boolean }) {
    if (!vehicle || vehicle.status === nextStatus) {
      return;
    }

    if (!canEdit) {
      toast.error("Your role cannot update vehicle status.");
      return;
    }

    const previous = vehicle;
    setStatusSaving(true);
    setVehicle({ ...vehicle, status: nextStatus });

    try {
      await apiClient.patch(`/vehicles/${vehicle.id}`, { status: nextStatus });
      if (!options?.silentToast) {
        toast.success(`${vehicle.registrationNo} moved to ${humanizeEnum(nextStatus)}.`);
      }
      await loadAlerts();
    } catch (err: any) {
      setVehicle(previous);
      toast.error(buildErrorMessage(err, "Failed to update vehicle status."));
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleDeleteVehicle() {
    if (!vehicle) {
      return;
    }

    if (!canDelete) {
      toast.error("Only administrators can delete vehicles.");
      return;
    }

    if (!window.confirm(`Delete ${vehicle.registrationNo}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/vehicles/${vehicle.id}`);
      toast.success("Vehicle deleted.");
      window.location.href = "/vehicles";
    } catch (err: any) {
      toast.error(buildErrorMessage(err, "Failed to delete vehicle."));
    }
  }

  async function submitMaintenanceLog(event: FormEvent) {
    event.preventDefault();

    if (!vehicle) {
      return;
    }

    if (!canEdit) {
      toast.error("Your role cannot add maintenance records.");
      return;
    }

    if (!maintenanceForm.description.trim() || !maintenanceForm.performedBy.trim()) {
      toast.error("Service description and technician name are required.");
      return;
    }

    setMaintenanceSaving(true);

    try {
      const attachments = maintenanceForm.attachmentsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      await apiClient.post("/maintenance/logs", {
        vehicleId: vehicle.id,
        description: `[${maintenanceForm.serviceType}] ${maintenanceForm.description.trim()}`,
        performedBy: maintenanceForm.performedBy.trim(),
        performedAt: new Date(maintenanceForm.performedAt).toISOString(),
        cost: Number(maintenanceForm.cost) || 0,
        notes: maintenanceForm.notes.trim() || undefined,
        attachments
      });

      if (maintenanceForm.markAvailableAfterSave && vehicle.status === "UNDER_MAINTENANCE") {
        await updateVehicleStatus("AVAILABLE", { silentToast: true });
      }

      toast.success("Maintenance record saved.");

      setMaintenanceForm({
        serviceType: "GENERAL",
        description: "",
        performedBy: "",
        performedAt: new Date().toISOString().slice(0, 10),
        cost: 0,
        notes: "",
        attachmentsText: "",
        markAvailableAfterSave: true
      });

      await Promise.all([loadMaintenance(maintenancePagination.page), loadVehicle(), loadAlerts()]);
    } catch (err: any) {
      toast.error(buildErrorMessage(err, "Failed to save maintenance log."));
    } finally {
      setMaintenanceSaving(false);
    }
  }

  async function submitFuelLog(event: FormEvent) {
    event.preventDefault();

    if (!vehicle) {
      return;
    }

    if (!canEdit) {
      toast.error("Your role cannot create fuel logs.");
      return;
    }

    if (fuelForm.liters <= 0 || fuelForm.costPerLiter <= 0 || fuelForm.mileageAtFuel <= 0) {
      toast.error("Liters, cost per liter, and mileage are required and must be positive values.");
      return;
    }

    setFuelSaving(true);

    try {
      await apiClient.post(`/vehicles/${vehicle.id}/fuel-log`, {
        liters: Number(fuelForm.liters),
        costPerLiter: Number(fuelForm.costPerLiter),
        mileageAtFuel: Number(fuelForm.mileageAtFuel),
        fuelStation: fuelForm.fuelStation.trim() || undefined,
        notes: fuelForm.notes.trim() || undefined
      });

      toast.success("Fuel log saved.");
      setFuelForm({
        liters: 0,
        costPerLiter: 0,
        mileageAtFuel: Number(vehicle.currentMileage) || 0,
        fuelStation: "",
        notes: ""
      });

      await Promise.all([loadFuel(), loadVehicle()]);
    } catch (err: any) {
      toast.error(buildErrorMessage(err, "Failed to save fuel log."));
    } finally {
      setFuelSaving(false);
    }
  }

  if (loadingVehicle) {
    return (
      <div className="card flex items-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Loading vehicle details...
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="space-y-3">
        <a href="/vehicles" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <ArrowLeft size={14} /> Back to Vehicles
        </a>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
          {vehicleError ?? "Vehicle not found."}
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[vehicle.status];
  const StatusIcon = statusMeta.icon;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-5 py-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <a href="/vehicles" className="inline-flex items-center gap-1 text-sm text-slate-200 hover:text-white">
              <ArrowLeft size={14} /> Back to Vehicles
            </a>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Vehicle Details</p>
            <h1 className="mt-1 text-2xl font-semibold">
              {vehicle.make} {vehicle.vehicleModel}
            </h1>
            <p className="mt-1 text-sm text-slate-200">Registration: {vehicle.registrationNo}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusMeta.badgeClass}`}
            >
              <StatusIcon size={12} /> {statusMeta.label}
            </span>
            {canDelete && (
              <button
                type="button"
                onClick={() => void handleDeleteVehicle()}
                className="inline-flex items-center gap-1 rounded-md border border-rose-300/80 bg-rose-500/20 px-3 py-1.5 text-sm text-rose-50 hover:bg-rose-500/30"
              >
                <Trash2 size={14} /> Delete Vehicle
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-brand-100 text-brand-800"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "overview" && (
        <section className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Overview</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <OverviewItem label="Registration" value={vehicle.registrationNo} icon={CarFront} />
              <OverviewItem label="Vehicle Type" value={humanizeEnum(vehicle.type)} icon={CarFront} />
              <OverviewItem label="Fuel Type" value={humanizeEnum(vehicle.fuelType)} icon={Fuel} />
              <OverviewItem label="Current Mileage" value={`${Number(vehicle.currentMileage).toLocaleString()} km`} icon={Route} />
              <OverviewItem
                label="Next Service Date"
                value={vehicle.nextServiceDate ? new Date(vehicle.nextServiceDate).toLocaleDateString() : "Not set"}
                icon={CalendarClock}
              />
              <OverviewItem
                label="Next Service Mileage"
                value={vehicle.nextServiceMileage ? `${Number(vehicle.nextServiceMileage).toLocaleString()} km` : "Not set"}
                icon={Wrench}
              />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Status Control</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={vehicle.status}
                  disabled={!canEdit || statusSaving}
                  onChange={(event) =>
                    void updateVehicleStatus(event.target.value as VehicleStatus)
                  }
                  title={!canEdit ? "Your role cannot update status" : undefined}
                  className={`rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 ${
                    !canEdit ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  {(Object.keys(STATUS_META) as VehicleStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {humanizeEnum(status)}
                    </option>
                  ))}
                </select>
                {statusSaving && <Loader2 size={14} className="animate-spin text-slate-500" />}
              </div>
            </div>
          </article>

          <div className="space-y-4">
            <article
              className={`rounded-2xl border p-4 shadow-sm ${
                serviceReminder.tone === "critical"
                  ? "border-rose-200 bg-rose-50"
                  : serviceReminder.tone === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : serviceReminder.tone === "healthy"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-white"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CircleAlert size={14} /> Service Reminder
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">{serviceReminder.title}</p>
              <p className="mt-1 text-sm text-slate-600">{serviceReminder.description}</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-800">Vehicle Notifications</p>
              {alerts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No active alerts for this vehicle.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {alerts.map((alert) => (
                    <li
                      key={alert.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        alert.severity === "critical"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : alert.severity === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-sky-200 bg-sky-50 text-sky-700"
                      }`}
                    >
                      <p className="font-semibold">{alert.title}</p>
                      <p className="mt-0.5 text-xs opacity-90">{alert.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </section>
      )}

      {activeTab === "maintenance" && (
        <section className="grid gap-4 xl:grid-cols-[1.15fr,1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Add Maintenance Record</h2>
            <form onSubmit={submitMaintenanceLog} className="mt-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Service Type">
                  <select
                    value={maintenanceForm.serviceType}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMaintenanceForm((current) => ({
                        ...current,
                        serviceType: event.target.value as ServiceType
                      }))
                    }
                    className={inputCls}
                  >
                    {SERVICE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {humanizeEnum(type)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Performed By *">
                  <input
                    required
                    value={maintenanceForm.performedBy}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMaintenanceForm((current) => ({ ...current, performedBy: event.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Service Date *">
                  <input
                    type="date"
                    required
                    value={maintenanceForm.performedAt}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMaintenanceForm((current) => ({ ...current, performedAt: event.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Cost">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={maintenanceForm.cost}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMaintenanceForm((current) => ({ ...current, cost: Number(event.target.value) }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Description *" className="md:col-span-2">
                  <textarea
                    required
                    rows={2}
                    value={maintenanceForm.description}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMaintenanceForm((current) => ({ ...current, description: event.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Notes" className="md:col-span-2">
                  <textarea
                    rows={2}
                    value={maintenanceForm.notes}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMaintenanceForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Attachment URLs (one per line)" className="md:col-span-2">
                  <textarea
                    rows={3}
                    value={maintenanceForm.attachmentsText}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setMaintenanceForm((current) => ({ ...current, attachmentsText: event.target.value }))
                    }
                    placeholder="https://files.example.com/invoice-1.pdf"
                    className={inputCls}
                  />
                </Field>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={maintenanceForm.markAvailableAfterSave}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setMaintenanceForm((current) => ({
                      ...current,
                      markAvailableAfterSave: event.target.checked
                    }))
                  }
                />
                Mark vehicle available after save when currently under maintenance
              </label>

              <button
                type="submit"
                disabled={!canEdit || maintenanceSaving}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  canEdit
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "cursor-not-allowed bg-slate-300 text-slate-500"
                }`}
              >
                {maintenanceSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Maintenance Record
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Maintenance History</h2>
              <span className="text-xs text-slate-500">
                {maintenancePagination.total} record(s)
              </span>
            </div>

            {maintenanceLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" /> Loading maintenance logs...
              </div>
            ) : maintenanceLogs.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No maintenance records yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {maintenanceLogs.map((log) => {
                  const parsed = parseServiceTypeFromDescription(log.description);
                  return (
                    <li key={log.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {humanizeEnum(parsed.serviceType)}
                          </p>
                          <p className="text-sm font-semibold text-slate-900">{parsed.description}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(log.performedAt).toLocaleDateString()} • {log.performedBy}
                          </p>
                          {log.notes && <p className="mt-1 text-xs text-slate-600">{log.notes}</p>}
                          {Array.isArray(log.attachments) && log.attachments.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {log.attachments.map((file, index) => (
                                <a
                                  key={`${log.id}-${index}`}
                                  href={file}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                                >
                                  Attachment {index + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-700">
                          {Number(log.cost ?? 0).toLocaleString(undefined, {
                            style: "currency",
                            currency: "INR",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => void loadMaintenance(Math.max(1, maintenancePagination.page - 1))}
                disabled={maintenancePagination.page <= 1 || maintenanceLoading}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-slate-600">
                Page {maintenancePagination.page} of {maintenancePagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => void loadMaintenance(maintenancePagination.page + 1)}
                disabled={!maintenancePagination.hasNextPage || maintenanceLoading}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </article>
        </section>
      )}

      {activeTab === "fuel" && (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Average Consumption"
              value={`${fuelAnalytics.averageConsumptionLPer100Km.toFixed(2)} L/100km`}
              tone="bg-emerald-50 text-emerald-800"
            />
            <MetricCard
              label="Cost Per Km"
              value={`${fuelAnalytics.costPerKm.toFixed(2)} INR/km`}
              tone="bg-sky-50 text-sky-800"
            />
            <MetricCard
              label="Fuel Entries"
              value={String(fuelLogs.length)}
              tone="bg-violet-50 text-violet-800"
            />
          </div>

          <section className="grid gap-4 xl:grid-cols-[1.1fr,1fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">Log Fuel Entry</h2>
              <form onSubmit={submitFuelLog} className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Liters *">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={fuelForm.liters}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setFuelForm((current) => ({ ...current, liters: Number(event.target.value) }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Cost / Liter *">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={fuelForm.costPerLiter}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setFuelForm((current) => ({ ...current, costPerLiter: Number(event.target.value) }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Mileage at Fuel *">
                  <input
                    type="number"
                    min={0}
                    value={fuelForm.mileageAtFuel}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setFuelForm((current) => ({ ...current, mileageAtFuel: Number(event.target.value) }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Fuel Station">
                  <input
                    value={fuelForm.fuelStation}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setFuelForm((current) => ({ ...current, fuelStation: event.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Notes" className="md:col-span-2">
                  <textarea
                    rows={2}
                    value={fuelForm.notes}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setFuelForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={!canEdit || fuelSaving}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      canEdit
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "cursor-not-allowed bg-slate-300 text-slate-500"
                    }`}
                  >
                    {fuelSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Fuel Log
                  </button>
                </div>
              </form>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Fuel History</h2>
                <button
                  type="button"
                  onClick={() => void loadFuel()}
                  disabled={fuelLoading}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>

              {fuelLoading ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 size={14} className="animate-spin" /> Loading fuel logs...
                </div>
              ) : fuelLogs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No fuel logs recorded yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {fuelLogs.map((log) => (
                    <li key={log.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <p className="font-semibold text-slate-900">
                        {Number(log.liters).toFixed(2)} L @ {Number(log.costPerLiter).toFixed(2)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(log.date).toLocaleDateString()} • Mileage {Number(log.mileageAtFuel).toLocaleString()} km
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Total: {Number(log.totalCost).toLocaleString(undefined, {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2
                        })}
                      </p>
                      {log.fuelStation && <p className="mt-0.5 text-xs text-slate-500">Station: {log.fuelStation}</p>}
                      {log.notes && <p className="mt-0.5 text-xs text-slate-600">{log.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        </section>
      )}

      {activeTab === "trips" && (
        <section className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Trip History (Future-Ready)</h2>
              <button
                type="button"
                onClick={() => void loadTrips()}
                disabled={tripsLoading}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-600">
              This tab is prepared for real-time GPS route history, map playback, and behavior-based smart alerts.
            </p>

            {tripsLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" /> Loading trips...
              </div>
            ) : trips.length === 0 ? (
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                No trips recorded yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {trips.map((trip) => (
                  <li key={trip.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <p className="font-semibold text-slate-900">
                      {trip.startLocation} to {trip.endLocation}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {new Date(trip.startTime).toLocaleString()} • {trip.status}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Distance: {Number(trip.distance).toLocaleString()} km • Mileage: {Number(trip.startMileage).toLocaleString()} to {Number(trip.endMileage).toLocaleString()} km
                    </p>
                    {trip.purpose && <p className="mt-0.5 text-xs text-slate-500">Purpose: {trip.purpose}</p>}
                    {trip.notes && <p className="mt-0.5 text-xs text-slate-600">{trip.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Roadmap: BI, Audit, Integrations</h3>
            <ul className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                Maintenance cost, downtime, and cost-per-vehicle metrics
              </li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                Predictive maintenance and behavior-based smart alerts
              </li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                User/team role management and permissions extensions
              </li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                Audit logs and third-party integrations (GPS/fuel/accounting)
              </li>
            </ul>
          </article>
        </section>
      )}
    </div>
  );
}

function OverviewItem({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
        <Icon size={14} className="text-slate-400" /> {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <article className={`rounded-xl p-4 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </article>
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

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseServiceTypeFromDescription(description: string) {
  const matched = description.match(/^\[([A-Z_]+)]\s*(.*)$/);
  if (!matched) {
    return {
      serviceType: "GENERAL",
      description
    };
  }

  return {
    serviceType: matched[1],
    description: matched[2] || "No description"
  };
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
