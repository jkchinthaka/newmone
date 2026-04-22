"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Cog,
  Factory,
  Loader2,
  PackagePlus,
  RefreshCw,
  UserRound,
  Wrench
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import {
  LegacyMaintenanceJobsBoard,
  type LegacyBoardLane,
  type LegacyBoardStatus,
  type LegacyMaintenanceBoardJob,
  type LegacyMaintenancePendingRequest
} from "@/components/maintenance/legacy-maintenance-jobs-board";

type JobLane = "VEHICLE" | "MACHINERY" | "SERVICE";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type WorkOrderStatus = "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED" | "OVERDUE";
type WorkOrderType = "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY" | "INSPECTION" | "INSTALLATION";
type MaintenanceType = "PREVENTIVE" | "PREDICTIVE" | "CORRECTIVE" | "INSPECTION";
type MaintenanceFrequency =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "BIANNUAL"
  | "ANNUAL"
  | "MILEAGE_BASED"
  | "CUSTOM";
type AssetCategory = "MACHINE" | "TOOL" | "INFRASTRUCTURE" | "EQUIPMENT" | "VEHICLE" | "OTHER";
type AssetStatus = "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "DISPOSED" | "RETIRED";
type VehicleStatus = "AVAILABLE" | "IN_USE" | "UNDER_MAINTENANCE" | "OUT_OF_SERVICE" | "DISPOSED";
type RoleName =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "ASSET_MANAGER"
  | "MECHANIC"
  | "SUPERVISOR"
  | "DRIVER"
  | "VIEWER"
  | "CLEANER";
type StudioStep = "REQUEST" | "SCHEDULE" | "ALLOCATION" | "TIMING" | "PARTS" | "COMPLETION";
type MaintenanceViewMode = "integrated" | "legacy-board";
type Feedback = { tone: "success" | "error"; message: string };

const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;

type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: {
    name: RoleName;
  } | null;
};

type VehicleRow = {
  id: string;
  registrationNo: string;
  make: string;
  vehicleModel: string;
  status: VehicleStatus;
  currentMileage: number | string;
  nextServiceDate?: string | null;
  nextServiceMileage?: number | string | null;
};

type AssetRow = {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  location?: string | null;
};

type PartRow = {
  id: string;
  partNumber: string;
  name: string;
  category: string;
  quantityInStock: number;
  reorderPoint: number;
  unitCost: number | string;
  unit?: string | null;
};

type WorkOrderPartRow = {
  id: string;
  partId: string;
  quantity: number;
  unitCost: number | string;
  totalCost: number | string;
  part: PartRow;
};

type WorkOrderRow = {
  id: string;
  woNumber: string;
  title: string;
  description: string;
  priority: Priority;
  status: WorkOrderStatus;
  type: WorkOrderType;
  assetId?: string | null;
  vehicleId?: string | null;
  scheduleId?: string | null;
  dueDate?: string | null;
  estimatedCost?: number | string | null;
  actualCost?: number | string | null;
  estimatedHours?: number | string | null;
  actualHours?: number | string | null;
  notes?: string | null;
  createdAt: string;
  technicianId?: string | null;
  technician?: CurrentUser | null;
  vehicle?: VehicleRow | null;
  asset?: AssetRow | null;
  parts: WorkOrderPartRow[];
};

type MaintenanceScheduleRow = {
  id: string;
  name: string;
  description?: string | null;
  type: MaintenanceType;
  frequency: MaintenanceFrequency;
  intervalDays?: number | null;
  intervalMileage?: number | string | null;
  assetId?: string | null;
  vehicleId?: string | null;
  nextDueDate?: string | null;
  nextDueMileage?: number | string | null;
  isActive: boolean;
  estimatedCost?: number | string | null;
  estimatedHours?: number | string | null;
};

type MaintenanceLogRow = {
  id: string;
  description: string;
  performedBy: string;
  performedAt: string;
  cost?: number | string | null;
  notes?: string | null;
  workOrderId?: string | null;
  vehicleId?: string | null;
  assetId?: string | null;
};

type CalendarRow = {
  id: string;
  title: string;
  date?: string | null;
  vehicleId?: string | null;
  assetId?: string | null;
};

type PredictiveAlertRow = {
  id: string;
  type: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  referenceId: string;
};

type JobFormState = {
  lane: JobLane;
  title: string;
  requestDate: string;
  dueDate: string;
  priority: Priority;
  type: WorkOrderType;
  targetId: string;
  scheduleId: string;
  serviceParty: string;
  departmentName: string;
  sectionName: string;
  position: string;
  faultCondition: string;
  narration: string;
  description: string;
};

type ScheduleFormState = {
  lane: JobLane;
  targetId: string;
  name: string;
  type: MaintenanceType;
  frequency: MaintenanceFrequency;
  nextDueDate: string;
  intervalDays: string;
  intervalMileage: string;
  estimatedCost: string;
  estimatedHours: string;
  description: string;
};

type AllocationFormState = {
  primaryAssigneeId: string;
  supportCrewIds: string[];
  vendorPartner: string;
  serviceParty: string;
};

type TimingFormState = {
  dueDate: string;
  estimatedCost: string;
  estimatedHours: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  faultCondition: string;
  narration: string;
  previousReading: string;
  currentReading: string;
};

type PartFormState = {
  category: string;
  partId: string;
  quantity: number;
};

type CompletionFormState = {
  completedOn: string;
  completedAt: string;
  actualCost: string;
  actualHours: string;
  notes: string;
};

const PRIORITY_OPTIONS: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const WORK_ORDER_TYPES: WorkOrderType[] = ["PREVENTIVE", "CORRECTIVE", "EMERGENCY", "INSPECTION", "INSTALLATION"];
const MAINTENANCE_TYPES: MaintenanceType[] = ["PREVENTIVE", "PREDICTIVE", "CORRECTIVE", "INSPECTION"];
const MAINTENANCE_FREQUENCIES: MaintenanceFrequency[] = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "BIANNUAL",
  "ANNUAL",
  "MILEAGE_BASED",
  "CUSTOM"
];

const LANE_META: Record<JobLane, { label: string; description: string; accent: string; icon: typeof CarFront; badge: string }> = {
  VEHICLE: {
    label: "Vehicle Jobs",
    description: "Breakdowns, service jobs, time estimation, and vehicle-side reporting.",
    accent: "from-sky-500/20 via-sky-500/8 to-white",
    icon: CarFront,
    badge: "bg-sky-100 text-sky-700"
  },
  MACHINERY: {
    label: "Machinery Jobs",
    description: "Machine-side requests, crew allocation, item issues, and total job reporting.",
    accent: "from-violet-500/18 via-violet-500/8 to-white",
    icon: Factory,
    badge: "bg-violet-100 text-violet-700"
  },
  SERVICE: {
    label: "Service Jobs",
    description: "General service maintenance, pending requests, timing updates, and completion flows.",
    accent: "from-amber-500/20 via-amber-500/8 to-white",
    icon: Cog,
    badge: "bg-amber-100 text-amber-700"
  }
};

const STATUS_STYLES: Record<WorkOrderStatus, string> = {
  OPEN: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  OVERDUE: "bg-rose-100 text-rose-700"
};

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-rose-100 text-rose-700"
};

const RISK_STYLES: Record<PredictiveAlertRow["riskLevel"], string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-rose-100 text-rose-800"
};

const studioInputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";
const studioLabelClass =
  "space-y-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not scheduled" : date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(toNumber(value));
}

function daysDelta(value?: string | null) {
  if (!value) {
    return null;
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function combineDateTime(date: string, time: string) {
  if (!date) {
    return new Date().toISOString();
  }

  return new Date(`${date}T${time || "00:00"}:00`).toISOString();
}

function extractErrorMessage(error: unknown) {
  const maybeError = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const raw = maybeError?.response?.data?.message;

  if (Array.isArray(raw)) {
    return raw.join(", ");
  }

  return raw ?? maybeError?.message ?? "Maintenance action failed";
}

function userFullName(user?: Partial<CurrentUser> | null) {
  const first = user?.firstName?.trim() ?? "";
  const last = user?.lastName?.trim() ?? "";
  return `${first} ${last}`.trim() || "Unassigned";
}

function getJobLane(order: WorkOrderRow): JobLane {
  if (order.vehicleId) {
    return "VEHICLE";
  }

  if (order.asset?.category && ["MACHINE", "EQUIPMENT", "TOOL"].includes(order.asset.category)) {
    return "MACHINERY";
  }

  return "SERVICE";
}

function targetLabel(order: WorkOrderRow) {
  if (order.vehicle) {
    return `${order.vehicle.registrationNo} · ${order.vehicle.make} ${order.vehicle.vehicleModel}`;
  }

  if (order.asset) {
    return `${order.asset.assetTag} · ${order.asset.name}`;
  }

  return "Target not linked";
}

function toLegacyBoardStatus(status: WorkOrderStatus): LegacyBoardStatus {
  if (status === "COMPLETED") {
    return "Completed";
  }

  if (status === "IN_PROGRESS") {
    return "In-Progress";
  }

  return "Pending";
}

function toLegacyBoardLane(lane: JobLane): LegacyBoardLane {
  if (lane === "MACHINERY") {
    return "machinery";
  }

  if (lane === "SERVICE") {
    return "service";
  }

  return "vehicle";
}

function taggedDescriptionValue(text: string | undefined | null, tag: string) {
  if (!text) {
    return "";
  }

  const line = text.split("\n").find((entry) => entry.trim().toLowerCase().startsWith(`${tag.toLowerCase()}:`));
  if (!line) {
    return "";
  }

  return line.slice(line.indexOf(":") + 1).trim();
}

function normalizeWorkOrders(rows: WorkOrderRow[]) {
  return rows.map((row) => ({
    ...row,
    parts: Array.isArray(row.parts) ? row.parts : []
  }));
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  badge,
  tone = "slate"
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  badge?: string;
  tone?: "slate" | "sky" | "amber" | "rose" | "emerald";
}) {
  const toneMap: Record<"slate" | "sky" | "amber" | "rose" | "emerald", string> = {
    slate: "from-white via-white to-slate-50",
    sky: "from-brand-100 via-white to-slate-50",
    amber: "from-amber-50 via-white to-slate-50",
    rose: "from-rose-50 via-white to-slate-50",
    emerald: "from-emerald-50 via-white to-slate-50"
  };

  return (
    <article className={`group relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(15,23,42,0.1)] ${toneMap[tone]}`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-300 via-brand-500/70 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-white/90 p-3 text-brand-700 ring-1 ring-slate-200 transition group-hover:ring-brand-200">{icon}</div>
        {badge ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{badge}</span> : null}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </article>
  );
}

function SyncStatusPills({
  lastSyncedAt,
  isBackgroundSyncing
}: {
  lastSyncedAt: string | null;
  isBackgroundSyncing: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-semibold uppercase tracking-[0.16em] text-brand-700">
        Auto-sync every 30 min
      </span>
      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 shadow-sm">
        {isBackgroundSyncing
          ? "Syncing in background..."
          : lastSyncedAt
            ? `Last synced ${formatDateTime(lastSyncedAt)}`
            : "Preparing first sync..."}
      </span>
    </div>
  );
}

export default function MaintenancePage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MaintenanceViewMode>("integrated");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [schedules, setSchedules] = useState<MaintenanceScheduleRow[]>([]);
  const [logs, setLogs] = useState<MaintenanceLogRow[]>([]);
  const [calendarRows, setCalendarRows] = useState<CalendarRow[]>([]);
  const [alerts, setAlerts] = useState<PredictiveAlertRow[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);

  const [laneFilter, setLaneFilter] = useState<JobLane | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [studioStep, setStudioStep] = useState<StudioStep>("REQUEST");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  const [jobForm, setJobForm] = useState<JobFormState>({
    lane: "VEHICLE",
    title: "",
    requestDate: todayDate(),
    dueDate: "",
    priority: "MEDIUM",
    type: "CORRECTIVE",
    targetId: "",
    scheduleId: "",
    serviceParty: "",
    departmentName: "",
    sectionName: "",
    position: "",
    faultCondition: "",
    narration: "",
    description: ""
  });

  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    lane: "VEHICLE",
    targetId: "",
    name: "",
    type: "PREVENTIVE",
    frequency: "MONTHLY",
    nextDueDate: "",
    intervalDays: "30",
    intervalMileage: "",
    estimatedCost: "",
    estimatedHours: "",
    description: ""
  });

  const [allocationForm, setAllocationForm] = useState<AllocationFormState>({
    primaryAssigneeId: "",
    supportCrewIds: [],
    vendorPartner: "",
    serviceParty: ""
  });

  const [timingForm, setTimingForm] = useState<TimingFormState>({
    dueDate: "",
    estimatedCost: "",
    estimatedHours: "",
    startDate: todayDate(),
    startTime: nowTime(),
    endDate: todayDate(),
    endTime: nowTime(),
    faultCondition: "",
    narration: "",
    previousReading: "",
    currentReading: ""
  });

  const [partForm, setPartForm] = useState<PartFormState>({
    category: "",
    partId: "",
    quantity: 1
  });
  const [queuedParts, setQueuedParts] = useState<Array<{ partId: string; quantity: number }>>([]);

  const [completionForm, setCompletionForm] = useState<CompletionFormState>({
    completedOn: todayDate(),
    completedAt: nowTime(),
    actualCost: "",
    actualHours: "",
    notes: ""
  });

  const loadWorkspace = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
    } else {
      setIsBackgroundSyncing(true);
    }

    setLoadError(null);

    try {
      const [meResult, schedulesResult, logsResult, calendarResult, alertsResult, workOrdersResult, vehiclesResult, assetsResult, partsResult, usersResult] =
        await Promise.allSettled([
          apiClient.get("/auth/me"),
          apiClient.get("/maintenance/schedules"),
          apiClient.get("/maintenance/logs"),
          apiClient.get("/maintenance/calendar"),
          apiClient.get("/maintenance/predictive-alerts"),
          apiClient.get("/work-orders"),
          apiClient.get("/vehicles"),
          apiClient.get("/assets", { params: { limit: 200 } }),
          apiClient.get("/inventory/parts"),
          apiClient.get("/users")
        ]);

      if (meResult.status !== "fulfilled") {
        setLoadError("Unable to load the maintenance workspace for the current session.");
        return;
      }

      const me = (meResult.value.data?.data ?? null) as CurrentUser | null;
      setCurrentUser(me);
      setSchedules(schedulesResult.status === "fulfilled" ? ((schedulesResult.value.data?.data ?? []) as MaintenanceScheduleRow[]) : []);
      setLogs(logsResult.status === "fulfilled" ? ((logsResult.value.data?.data ?? []) as MaintenanceLogRow[]) : []);
      setCalendarRows(calendarResult.status === "fulfilled" ? ((calendarResult.value.data?.data ?? []) as CalendarRow[]) : []);
      setAlerts(alertsResult.status === "fulfilled" ? ((alertsResult.value.data?.data ?? []) as PredictiveAlertRow[]) : []);
      setWorkOrders(
        workOrdersResult.status === "fulfilled"
          ? normalizeWorkOrders((workOrdersResult.value.data?.data ?? []) as WorkOrderRow[])
          : []
      );
      setVehicles(vehiclesResult.status === "fulfilled" ? ((vehiclesResult.value.data?.data ?? []) as VehicleRow[]) : []);
      setAssets(assetsResult.status === "fulfilled" ? ((assetsResult.value.data?.data ?? []) as AssetRow[]) : []);
      setParts(partsResult.status === "fulfilled" ? ((partsResult.value.data?.data ?? []) as PartRow[]) : []);
      setUsers(usersResult.status === "fulfilled" ? ((usersResult.value.data?.data ?? []) as CurrentUser[]) : me ? [me] : []);
      setLastSyncedAt(new Date().toISOString());

      const failedEndpoints = [
        schedulesResult,
        logsResult,
        calendarResult,
        alertsResult,
        workOrdersResult,
        vehiclesResult,
        assetsResult,
        partsResult
      ].filter((result) => result.status === "rejected");

      if (failedEndpoints.length > 0) {
        setLoadError("Some maintenance data could not be loaded. The workspace is partially available.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      if (silent) {
        setIsBackgroundSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadWorkspace({ silent: true });
    }, AUTO_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadWorkspace]);

  useEffect(() => {
    if (workOrders.length === 0) {
      setSelectedWorkOrderId(null);
      return;
    }

    if (!selectedWorkOrderId || !workOrders.some((row) => row.id === selectedWorkOrderId)) {
      setSelectedWorkOrderId(workOrders[0].id);
    }
  }, [selectedWorkOrderId, workOrders]);

  const technicians = useMemo(() => {
    const fallback = currentUser ? [currentUser] : [];
    const source = users.length > 0 ? users : fallback;
    return source.filter((user) => !["DRIVER", "VIEWER", "CLEANER"].includes(user.role?.name ?? "VIEWER"));
  }, [currentUser, users]);

  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const partsById = useMemo(() => new Map(parts.map((part) => [part.id, part])), [parts]);

  const machineryAssets = useMemo(() => assets.filter((asset) => ["MACHINE", "EQUIPMENT", "TOOL"].includes(asset.category)), [assets]);
  const serviceAssets = useMemo(() => assets.filter((asset) => !["MACHINE", "EQUIPMENT", "TOOL", "VEHICLE"].includes(asset.category)), [assets]);

  const filteredWorkOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return workOrders.filter((order) => {
      const lane = getJobLane(order);
      if (laneFilter !== "ALL" && lane !== laneFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [order.woNumber, order.title, order.description, order.vehicle?.registrationNo, order.asset?.assetTag, order.asset?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [laneFilter, search, workOrders]);

  const pendingRequests = useMemo(() => filteredWorkOrders.filter((order) => order.status === "OPEN"), [filteredWorkOrders]);
  const overdueOrders = useMemo(
    () =>
      filteredWorkOrders.filter((order) => {
        const delta = daysDelta(order.dueDate);
        return typeof delta === "number" && delta < 0 && order.status !== "COMPLETED" && order.status !== "CANCELLED";
      }),
    [filteredWorkOrders]
  );
  const zeroStockParts = useMemo(() => parts.filter((part) => toNumber(part.quantityInStock) <= 0), [parts]);
  const upcomingSchedules = useMemo(
    () =>
      [...schedules]
        .filter((schedule) => schedule.isActive)
        .sort((a, b) => {
          const left = a.nextDueDate ? new Date(a.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const right = b.nextDueDate ? new Date(b.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return left - right;
        })
        .slice(0, 6),
    [schedules]
  );

  const selectedWorkOrder = useMemo(() => workOrders.find((order) => order.id === selectedWorkOrderId) ?? null, [selectedWorkOrderId, workOrders]);
  const selectedLogs = useMemo(() => {
    if (!selectedWorkOrder) {
      return [] as MaintenanceLogRow[];
    }

    return logs.filter((log) => {
      if (log.workOrderId === selectedWorkOrder.id) {
        return true;
      }

      if (selectedWorkOrder.vehicleId && log.vehicleId === selectedWorkOrder.vehicleId) {
        return true;
      }

      if (selectedWorkOrder.assetId && log.assetId === selectedWorkOrder.assetId) {
        return true;
      }

      return false;
    });
  }, [logs, selectedWorkOrder]);

  const legacyBoardJobs = useMemo<LegacyMaintenanceBoardJob[]>(() => {
    return workOrders.map((order) => {
      const lane = getJobLane(order);
      const primaryTech = order.technician ? [userFullName(order.technician)] : [];
      const department = taggedDescriptionValue(order.description, "Department") || formatLabel(lane);
      const narration =
        taggedDescriptionValue(order.description, "Narration") ||
        taggedDescriptionValue(order.description, "Fault condition") ||
        order.notes ||
        order.description ||
        "";

      return {
        id: order.id,
        code: order.woNumber,
        lane: toLegacyBoardLane(lane),
        type: order.title,
        status: toLegacyBoardStatus(order.status),
        dueDateLabel: formatDate(order.dueDate),
        requestDateLabel: formatDate(order.createdAt),
        targetLabel: targetLabel(order),
        departmentLabel: department,
        narration,
        staff: primaryTech,
        itemsCount: order.parts.length,
        estimatedHours: `${toNumber(order.estimatedHours).toFixed(1)} h`,
        estimatedCost: formatCurrency(order.estimatedCost),
        actualCost: formatCurrency(order.actualCost)
      };
    });
  }, [workOrders]);

  const legacyPendingRequests = useMemo<LegacyMaintenancePendingRequest[]>(() => {
    return workOrders
      .filter((order) => order.status === "OPEN")
      .map((order) => {
        const lane = getJobLane(order);
        const laneLabel = toLegacyBoardLane(lane);

        return {
          id: order.id,
          code: order.woNumber,
          targetLabel: targetLabel(order),
          dateLabel: formatDate(order.createdAt),
          typeLabel: laneLabel
        };
      });
  }, [workOrders]);

  const partCategories = useMemo(() => Array.from(new Set(parts.map((part) => part.category))).sort(), [parts]);
  const visibleParts = useMemo(() => parts.filter((part) => !partForm.category || part.category === partForm.category), [partForm.category, parts]);
  const queuedPartDetails = useMemo(
    () => queuedParts.map((entry) => ({ ...entry, part: partsById.get(entry.partId) })),
    [partsById, queuedParts]
  );

  const jobTargetOptions = useMemo(() => {
    if (jobForm.lane === "VEHICLE") {
      return vehicles.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.registrationNo} · ${vehicle.make} ${vehicle.vehicleModel}` }));
    }

    const source = jobForm.lane === "MACHINERY" ? machineryAssets : serviceAssets;
    return source.map((asset) => ({ id: asset.id, label: `${asset.assetTag} · ${asset.name}` }));
  }, [jobForm.lane, machineryAssets, serviceAssets, vehicles]);

  const scheduleTargetOptions = useMemo(() => {
    if (scheduleForm.lane === "VEHICLE") {
      return vehicles.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.registrationNo} · ${vehicle.make} ${vehicle.vehicleModel}` }));
    }

    const source = scheduleForm.lane === "MACHINERY" ? machineryAssets : serviceAssets;
    return source.map((asset) => ({ id: asset.id, label: `${asset.assetTag} · ${asset.name}` }));
  }, [machineryAssets, scheduleForm.lane, serviceAssets, vehicles]);

  const compatibleSchedules = useMemo(() => {
    if (!jobForm.targetId) {
      return schedules;
    }

    return schedules.filter((schedule) => (jobForm.lane === "VEHICLE" ? schedule.vehicleId === jobForm.targetId : schedule.assetId === jobForm.targetId));
  }, [jobForm.lane, jobForm.targetId, schedules]);

  useEffect(() => {
    if (!selectedWorkOrder) {
      return;
    }

    setAllocationForm({
      primaryAssigneeId: selectedWorkOrder.technicianId ?? "",
      supportCrewIds: [],
      vendorPartner: "",
      serviceParty: ""
    });
    setTimingForm({
      dueDate: selectedWorkOrder.dueDate?.slice(0, 10) ?? "",
      estimatedCost: selectedWorkOrder.estimatedCost ? String(toNumber(selectedWorkOrder.estimatedCost)) : "",
      estimatedHours: selectedWorkOrder.estimatedHours ? String(toNumber(selectedWorkOrder.estimatedHours)) : "",
      startDate: todayDate(),
      startTime: nowTime(),
      endDate: todayDate(),
      endTime: nowTime(),
      faultCondition: "",
      narration: selectedWorkOrder.notes ?? "",
      previousReading: selectedWorkOrder.vehicle ? String(toNumber(selectedWorkOrder.vehicle.currentMileage)) : "",
      currentReading: ""
    });
    setCompletionForm({
      completedOn: todayDate(),
      completedAt: nowTime(),
      actualCost: selectedWorkOrder.actualCost ? String(toNumber(selectedWorkOrder.actualCost)) : "",
      actualHours: selectedWorkOrder.actualHours ? String(toNumber(selectedWorkOrder.actualHours)) : "",
      notes: selectedWorkOrder.notes ?? ""
    });
    setQueuedParts([]);
  }, [selectedWorkOrder]);

  async function appendWorkOrderNote(workOrderId: string, note: string) {
    if (!note.trim()) {
      return;
    }

    await apiClient.post(`/work-orders/${workOrderId}/notes`, { note });
  }

  async function handleCreateWorkOrder() {
    if (!currentUser || !jobForm.title.trim() || !jobForm.targetId) {
      setFeedback({ tone: "error", message: "Select the target and title before creating a maintenance request." });
      return;
    }

    setBusyAction("create-work-order");
    setFeedback(null);

    try {
      const response = await apiClient.post("/work-orders", {
        title: jobForm.title.trim(),
        description: [jobForm.description.trim(), `Request date: ${jobForm.requestDate || todayDate()}`, jobForm.narration ? `Narration: ${jobForm.narration}` : null, jobForm.faultCondition ? `Fault condition: ${jobForm.faultCondition}` : null, jobForm.departmentName ? `Department: ${jobForm.departmentName}` : null, jobForm.sectionName ? `Section: ${jobForm.sectionName}` : null, jobForm.position ? `Position: ${jobForm.position}` : null, jobForm.serviceParty ? `Service party: ${jobForm.serviceParty}` : null].filter(Boolean).join("\n\n"),
        priority: jobForm.priority,
        type: jobForm.type,
        createdById: currentUser.id,
        dueDate: jobForm.dueDate || undefined,
        scheduleId: jobForm.scheduleId || undefined,
        vehicleId: jobForm.lane === "VEHICLE" ? jobForm.targetId : undefined,
        assetId: jobForm.lane === "VEHICLE" ? undefined : jobForm.targetId
      });

      const created = (response.data?.data ?? response.data) as WorkOrderRow;
      await loadWorkspace();
      setSelectedWorkOrderId(created.id);
      setStudioStep("ALLOCATION");
      setFeedback({ tone: "success", message: `${created.woNumber} created and ready for allocation.` });
    } catch (error) {
      setFeedback({ tone: "error", message: extractErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateSchedule() {
    if (!scheduleForm.name.trim() || !scheduleForm.targetId) {
      setFeedback({ tone: "error", message: "Enter the schedule name and target before creating it." });
      return;
    }

    setBusyAction("create-schedule");
    setFeedback(null);

    try {
      await apiClient.post("/maintenance/schedules", {
        name: scheduleForm.name.trim(),
        description: scheduleForm.description || undefined,
        type: scheduleForm.type,
        frequency: scheduleForm.frequency,
        nextDueDate: scheduleForm.nextDueDate || undefined,
        intervalDays: scheduleForm.frequency === "MILEAGE_BASED" ? undefined : parsePositiveNumber(scheduleForm.intervalDays) ?? undefined,
        intervalMileage: scheduleForm.frequency === "MILEAGE_BASED" ? parsePositiveNumber(scheduleForm.intervalMileage) ?? undefined : undefined,
        estimatedCost: parsePositiveNumber(scheduleForm.estimatedCost) ?? undefined,
        estimatedHours: parsePositiveNumber(scheduleForm.estimatedHours) ?? undefined,
        vehicleId: scheduleForm.lane === "VEHICLE" ? scheduleForm.targetId : undefined,
        assetId: scheduleForm.lane === "VEHICLE" ? undefined : scheduleForm.targetId
      });

      await loadWorkspace();
      setStudioStep("REQUEST");
      setFeedback({ tone: "success", message: "Maintenance schedule created and added to the plan." });
    } catch (error) {
      setFeedback({ tone: "error", message: extractErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApplyAllocation() {
    if (!selectedWorkOrder) {
      setFeedback({ tone: "error", message: "Select a maintenance job before allocating staff." });
      return;
    }

    setBusyAction("apply-allocation");
    setFeedback(null);

    try {
      if (allocationForm.primaryAssigneeId) {
        await apiClient.post(`/work-orders/${selectedWorkOrder.id}/assign`, {
          technicianId: allocationForm.primaryAssigneeId
        });
      }

      const supportCrewNames = technicians.filter((user) => allocationForm.supportCrewIds.includes(user.id)).map((user) => userFullName(user));
      await appendWorkOrderNote(
        selectedWorkOrder.id,
        [allocationForm.serviceParty ? `Service party: ${allocationForm.serviceParty}` : null, allocationForm.vendorPartner ? `Vendor partner: ${allocationForm.vendorPartner}` : null, supportCrewNames.length > 0 ? `Support crew: ${supportCrewNames.join(", ")}` : null].filter(Boolean).join("\n")
      );

      await loadWorkspace();
      setStudioStep("TIMING");
      setFeedback({ tone: "success", message: `Allocation updated for ${selectedWorkOrder.woNumber}.` });
    } catch (error) {
      setFeedback({ tone: "error", message: extractErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStartSelectedWorkOrder() {
    if (!selectedWorkOrder) {
      setFeedback({ tone: "error", message: "Select a maintenance job before updating the live timing stage." });
      return;
    }

    setBusyAction("start-work-order");
    setFeedback(null);

    try {
      await apiClient.patch(`/work-orders/${selectedWorkOrder.id}`, {
        dueDate: timingForm.dueDate || undefined,
        estimatedCost: parsePositiveNumber(timingForm.estimatedCost) ?? undefined,
        estimatedHours: parsePositiveNumber(timingForm.estimatedHours) ?? undefined
      });

      if (selectedWorkOrder.status === "OPEN") {
        await apiClient.patch(`/work-orders/${selectedWorkOrder.id}/status`, {
          status: "IN_PROGRESS"
        });
      }

      await appendWorkOrderNote(
        selectedWorkOrder.id,
        [
          `Planned start: ${timingForm.startDate || todayDate()} ${timingForm.startTime || nowTime()}`,
          `Planned end: ${timingForm.endDate || todayDate()} ${timingForm.endTime || nowTime()}`,
          timingForm.faultCondition ? `Fault condition: ${timingForm.faultCondition}` : null,
          timingForm.narration ? `Narration: ${timingForm.narration}` : null,
          timingForm.previousReading ? `Previous reading: ${timingForm.previousReading}` : null,
          timingForm.currentReading ? `Current reading: ${timingForm.currentReading}` : null
        ]
          .filter(Boolean)
          .join("\n")
      );

      await loadWorkspace();
      setStudioStep("PARTS");
      setFeedback({ tone: "success", message: `${selectedWorkOrder.woNumber} moved into the active maintenance stream.` });
    } catch (error) {
      setFeedback({ tone: "error", message: extractErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  function handleQueuePart() {
    if (!partForm.partId || partForm.quantity < 1) {
      setFeedback({ tone: "error", message: "Pick an item and quantity before adding it to the request list." });
      return;
    }

    setQueuedParts((current) => {
      const existing = current.find((entry) => entry.partId === partForm.partId);
      if (existing) {
        return current.map((entry) => (entry.partId === partForm.partId ? { ...entry, quantity: entry.quantity + partForm.quantity } : entry));
      }

      return [...current, { partId: partForm.partId, quantity: partForm.quantity }];
    });
    setPartForm((current) => ({ ...current, partId: "", quantity: 1 }));
    setFeedback({ tone: "success", message: "Item staged in the maintenance request basket." });
  }

  async function handleSubmitPartRequest() {
    if (!selectedWorkOrder || queuedParts.length === 0) {
      setFeedback({ tone: "error", message: "Select a maintenance job and queue at least one item before submitting." });
      return;
    }

    setBusyAction("submit-part-request");
    setFeedback(null);

    try {
      for (const entry of queuedParts) {
        const part = partsById.get(entry.partId);
        if (!part) {
          continue;
        }

        await apiClient.post(`/work-orders/${selectedWorkOrder.id}/parts`, {
          partId: entry.partId,
          quantity: entry.quantity,
          unitCost: toNumber(part.unitCost)
        });
      }

      await loadWorkspace();
      setQueuedParts([]);
      setStudioStep("COMPLETION");
      setFeedback({ tone: "success", message: `Requested items linked to ${selectedWorkOrder.woNumber}.` });
    } catch (error) {
      setFeedback({ tone: "error", message: extractErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCompleteSelectedWorkOrder() {
    if (!selectedWorkOrder || !currentUser) {
      setFeedback({ tone: "error", message: "Select a maintenance job before completing the report." });
      return;
    }

    const actualCost = parsePositiveNumber(completionForm.actualCost);
    const actualHours = parsePositiveNumber(completionForm.actualHours);

    if (!actualCost || !actualHours) {
      setFeedback({ tone: "error", message: "Actual cost and actual hours are required before completion." });
      return;
    }

    setBusyAction("complete-work-order");
    setFeedback(null);

    try {
      await apiClient.patch(`/work-orders/${selectedWorkOrder.id}/status`, {
        status: "COMPLETED",
        actualCost,
        actualHours
      });

      await apiClient.post("/maintenance/logs", {
        workOrderId: selectedWorkOrder.id,
        scheduleId: selectedWorkOrder.scheduleId || undefined,
        assetId: selectedWorkOrder.assetId || undefined,
        vehicleId: selectedWorkOrder.vehicleId || undefined,
        description: `${selectedWorkOrder.title} completed through the integrated maintenance workspace`,
        performedBy: userFullName(currentUser),
        performedAt: combineDateTime(completionForm.completedOn, completionForm.completedAt),
        cost: actualCost,
        notes: completionForm.notes || undefined
      });

      await appendWorkOrderNote(selectedWorkOrder.id, [completionForm.notes ? `Completion notes: ${completionForm.notes}` : null, `Actual cost: ${completionForm.actualCost}`, `Actual hours: ${completionForm.actualHours}`].filter(Boolean).join("\n"));

      await loadWorkspace();
      setFeedback({ tone: "success", message: `${selectedWorkOrder.woNumber} marked complete and logged.` });
    } catch (error) {
      setFeedback({ tone: "error", message: extractErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  function handleOpenLegacyStudio(jobId: string, step: "ALLOCATION" | "TIMING" | "PARTS" | "COMPLETION") {
    setSelectedWorkOrderId(jobId);
    openMaintenanceStudio(step);
  }

  function openMaintenanceStudio(preferredStep: StudioStep = "REQUEST") {
    const nextStep = selectedWorkOrderId && preferredStep === "REQUEST" ? "ALLOCATION" : preferredStep;
    setStudioStep(nextStep);
    setViewMode("integrated");

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        document.getElementById("maintenance-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  const dueSoonCount = upcomingSchedules.filter((item) => {
    const delta = daysDelta(item.nextDueDate);
    return typeof delta === "number" && delta >= 0 && delta <= 7;
  }).length;
  const activeJobCount = filteredWorkOrders.filter((order) => order.status === "IN_PROGRESS").length;
  const elevatedRiskCount = alerts.filter((alert) => ["HIGH", "CRITICAL"].includes(alert.riskLevel)).length;
  const criticalOpenCount = filteredWorkOrders.filter(
    (order) => order.priority === "CRITICAL" && !["COMPLETED", "CANCELLED"].includes(order.status)
  ).length;

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-3xl border border-slate-200 bg-white text-sm text-slate-600 shadow-sm">
        <div className="inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading integrated maintenance workspace...
        </div>
      </div>
    );
  }

  if (viewMode === "legacy-board") {
    return (
      <div className="relative space-y-6">
        <div className="pointer-events-none absolute -top-14 right-0 h-56 w-56 rounded-full bg-violet-200/45 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 top-40 h-64 w-64 rounded-full bg-sky-200/45 blur-3xl" />

        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-violet-50/60 to-sky-50/50 p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Maintenance</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Maintenance Jobs Legacy Board</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-600">
                Classic board experience with richer hierarchy, faster scannability, and direct jump paths into the
                integrated studio actions.
              </p>
              <SyncStatusPills lastSyncedAt={lastSyncedAt} isBackgroundSyncing={isBackgroundSyncing} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode("integrated")}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Integrated View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("legacy-board")}
                  className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                >
                  Legacy Board
                </button>
              </div>

              <button
                type="button"
                onClick={() => void loadWorkspace()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
              >
                <RefreshCw size={15} /> Refresh workspace
              </button>
              <button
                type="button"
                onClick={() => openMaintenanceStudio()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-100"
              >
                <Cog size={15} /> Maintenance Studio
              </button>
              <button
                type="button"
                onClick={() => openMaintenanceStudio("REQUEST")}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
              >
                <ClipboardCheck size={15} /> New maintenance flow
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active Jobs</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{activeJobCount}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending Intake</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{pendingRequests.length}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Due In 7 Days</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{dueSoonCount}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">High/Critical Alerts</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{elevatedRiskCount}</p>
            </div>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</div>
        ) : null}

        {feedback ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
              feedback.tone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <LegacyMaintenanceJobsBoard
          jobs={legacyBoardJobs}
          pendingRequests={legacyPendingRequests}
          onCreateJob={() => openMaintenanceStudio("REQUEST")}
          onOpenStudio={handleOpenLegacyStudio}
        />
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-50 via-transparent to-transparent" />
      <div className="pointer-events-none absolute -top-12 right-0 h-56 w-56 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 top-36 h-64 w-64 rounded-full bg-sky-100/60 blur-3xl" />

      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Maintenance</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Integrated Maintenance Workspace</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              A cleaner workspace for intake, planning, alerts, and studio actions. The page now focuses on the
              maintenance items that need attention instead of spreading work across too many panels.
            </p>
            <SyncStatusPills lastSyncedAt={lastSyncedAt} isBackgroundSyncing={isBackgroundSyncing} />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("integrated")}
                className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm"
              >
                Integrated View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("legacy-board")}
                className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white"
              >
                Legacy Board
              </button>
            </div>

            <button type="button" onClick={() => void loadWorkspace()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <RefreshCw size={15} /> Refresh workspace
            </button>
            <button type="button" onClick={() => openMaintenanceStudio()} className="inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 shadow-sm hover:bg-brand-100/70">
              <Cog size={15} /> Maintenance Studio
            </button>
            <button type="button" onClick={() => openMaintenanceStudio("REQUEST")} className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              <ClipboardCheck size={15} /> New maintenance flow
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
          <article className="rounded-[28px] bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-5 text-white shadow-[0_24px_50px_rgba(17,94,168,0.28)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Workspace focus</p>
            <h2 className="mt-3 text-2xl font-semibold">
              {selectedWorkOrder ? selectedWorkOrder.woNumber : "Ready for next action"}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/80">
              {selectedWorkOrder
                ? selectedWorkOrder.title
                : "Open a request from the queue or launch Maintenance Studio to start a new maintenance flow."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1">Pending {pendingRequests.length}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Overdue {overdueOrders.length}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {selectedWorkOrder ? formatLabel(selectedWorkOrder.status) : "Studio ready"}
              </span>
            </div>
          </article>

          <MetricCard icon={<ClipboardList size={18} />} label="Pending Requests" value={String(pendingRequests.length)} hint="Open intake items waiting for assignment or action." tone="sky" />
          <MetricCard icon={<Wrench size={18} />} label="Live Jobs" value={String(activeJobCount)} hint="Active maintenance work currently in progress." tone="emerald" />
          <MetricCard icon={<AlertTriangle size={18} />} label="Critical Open" value={String(criticalOpenCount)} hint="High-priority work still waiting to be resolved." tone="rose" />
        </div>
      </section>

      {loadError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</div> : null}
      {feedback ? <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${feedback.tone === "success" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-rose-200 bg-rose-50 text-rose-800"}`}>{feedback.message}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
        <section id="request-board" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Work Queue</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Requests that need action</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">{pendingRequests.length} open requests</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">{activeJobCount} live jobs</span>
              </div>
            </div>

            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search WO no, asset, vehicle, or title" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 lg:w-80" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(["ALL", "VEHICLE", "MACHINERY", "SERVICE"] as Array<JobLane | "ALL">).map((lane) => (
              <button key={lane} type="button" onClick={() => setLaneFilter(lane)} className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${laneFilter === lane ? "bg-brand-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50/50"}`}>
                {lane === "ALL" ? "All Streams" : LANE_META[lane].label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No pending maintenance requests match the current filter.</div>
            ) : (
              pendingRequests.slice(0, 5).map((order) => {
                const lane = getJobLane(order);
                const delta = daysDelta(order.dueDate);
                const Icon = LANE_META[lane].icon;

                return (
                  <button key={order.id} type="button" onClick={() => { setSelectedWorkOrderId(order.id); setStudioStep("ALLOCATION"); }} className={`w-full rounded-3xl border px-4 py-4 text-left transition ${selectedWorkOrderId === order.id ? "border-brand-400 bg-brand-50 shadow-sm" : "border-slate-200 bg-slate-50 hover:border-brand-200 hover:bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className={`mt-0.5 rounded-2xl p-2.5 ${selectedWorkOrderId === order.id ? "bg-brand-100 text-brand-700" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}><Icon size={16} /></div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{order.woNumber}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${LANE_META[lane].badge}`}>{LANE_META[lane].label}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLES[order.priority]}`}>{formatLabel(order.priority)}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-900">{order.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{targetLabel(order)}</p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p className="font-medium text-slate-700">{formatDate(order.dueDate)}</p>
                        <p>{typeof delta === "number" ? (delta < 0 ? `${Math.abs(delta)} days overdue` : `${delta} days left`) : "No due date"}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section id="schedule-planner" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Planning</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Upcoming schedule</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{dueSoonCount} due soon</span>
            </div>

            <div className="mt-4 space-y-3">
              {upcomingSchedules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No active schedules yet. Use the studio planner to seed preventive maintenance.</div>
              ) : (
                upcomingSchedules.slice(0, 4).map((schedule) => {
                  const target = schedule.vehicleId ? vehicles.find((vehicle) => vehicle.id === schedule.vehicleId)?.registrationNo : schedule.assetId ? assetsById.get(schedule.assetId)?.name : "Unlinked target";
                  const delta = daysDelta(schedule.nextDueDate);

                  return (
                    <article key={schedule.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{schedule.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{target} · {formatLabel(schedule.frequency)}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p className="font-medium text-slate-700">{formatDate(schedule.nextDueDate)}</p>
                          <p>{typeof delta === "number" ? `${delta} days` : "TBD"}</p>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {calendarRows.length > 0 ? (
              <div className="mt-5 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Calendar pulse</p>
                <div className="mt-3 space-y-2">
                  {calendarRows.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{entry.title}</p>
                        <p className="text-xs text-slate-500">{entry.vehicleId ? "Vehicle schedule" : entry.assetId ? "Asset schedule" : "Maintenance event"}</p>
                      </div>
                      <p className="text-xs font-medium text-slate-600">{formatDate(entry.date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section id="attention-queue" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Attention</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">What needs attention now</h2>
              </div>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">{elevatedRiskCount} elevated alerts</span>
            </div>

            <div className="mt-4 space-y-3">
              {alerts.slice(0, 3).map((alert) => (
                <article key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RISK_STYLES[alert.riskLevel]}`}>{alert.riskLevel}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{formatLabel(alert.type)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{alert.message}</p>
                </article>
              ))}

              {overdueOrders.slice(0, 2).map((order) => (
                <article key={order.id} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <p className="font-semibold">{order.woNumber} is overdue</p>
                  <p className="mt-1">{order.title}</p>
                </article>
              ))}

              {zeroStockParts.slice(0, 1).map((part) => (
                <article key={part.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold">Zero stock: {part.partNumber}</p>
                  <p className="mt-1">{part.name}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.2fr]">
        <section className="space-y-5">
          <article id="job-report" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Selected Job</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Job summary</h2>
              </div>
              {selectedWorkOrder ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[selectedWorkOrder.status]}`}>{formatLabel(selectedWorkOrder.status)}</span> : null}
            </div>

            {!selectedWorkOrder ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">Select a request from the queue to see the maintenance summary and recent activity.</div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 px-5 py-5 text-white shadow-[0_22px_44px_rgba(17,94,168,0.24)]">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                    <span>{selectedWorkOrder.woNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 normal-case tracking-normal ${LANE_META[getJobLane(selectedWorkOrder)].badge}`}>{LANE_META[getJobLane(selectedWorkOrder)].label}</span>
                    <span className={`rounded-full px-2 py-0.5 normal-case tracking-normal ${PRIORITY_STYLES[selectedWorkOrder.priority]}`}>{formatLabel(selectedWorkOrder.priority)}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-white">{selectedWorkOrder.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/80">{selectedWorkOrder.description}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Job details</p>
                    <dl className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3"><dt>Target</dt><dd className="text-right font-medium text-slate-900">{targetLabel(selectedWorkOrder)}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Type</dt><dd className="font-medium text-slate-900">{formatLabel(selectedWorkOrder.type)}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Due date</dt><dd className="font-medium text-slate-900">{formatDate(selectedWorkOrder.dueDate)}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Primary assignee</dt><dd className="font-medium text-slate-900">{userFullName(selectedWorkOrder.technician)}</dd></div>
                    </dl>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cost and time</p>
                    <dl className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3"><dt>Estimated cost</dt><dd className="font-medium text-slate-900">{formatCurrency(selectedWorkOrder.estimatedCost)}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Actual cost</dt><dd className="font-medium text-slate-900">{formatCurrency(selectedWorkOrder.actualCost)}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Estimated hours</dt><dd className="font-medium text-slate-900">{toNumber(selectedWorkOrder.estimatedHours).toFixed(1)} h</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt>Actual hours</dt><dd className="font-medium text-slate-900">{toNumber(selectedWorkOrder.actualHours).toFixed(1)} h</dd></div>
                    </dl>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Requested Items</p>
                    <span className="text-sm font-medium text-slate-700">{selectedWorkOrder.parts.length} linked</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedWorkOrder.parts.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">No parts attached yet. Use the item request stage to add them.</div>
                    ) : (
                      selectedWorkOrder.parts.map((part) => (
                        <div key={part.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                          <div>
                            <p className="font-medium text-slate-900">{part.part.partNumber}</p>
                            <p className="text-slate-500">{part.part.name}</p>
                          </div>
                          <div className="text-right text-slate-600">
                            <p>{part.quantity} {part.part.unit ?? "pcs"}</p>
                            <p>{formatCurrency(part.totalCost)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Activity</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Recent maintenance logs</h2>
              </div>
              <Clock3 size={18} className="text-slate-400" />
            </div>

            <div className="mt-4 space-y-3">
              {selectedLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No related maintenance logs yet for the selected stream.</div>
              ) : (
                selectedLogs.slice(0, 5).map((log) => (
                  <article key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{log.description}</p>
                        <p className="mt-1 text-xs text-slate-500">{log.performedBy} · {formatDateTime(log.performedAt)}</p>
                      </div>
                      <p className="text-xs font-medium text-slate-500">{formatCurrency(log.cost)}</p>
                    </div>
                    {log.notes ? <p className="mt-2 text-sm text-slate-600">{log.notes}</p> : null}
                  </article>
                ))
              )}
            </div>
          </article>
        </section>

        <section id="maintenance-studio" className="scroll-mt-24 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Maintenance Studio</p>
            <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Focused maintenance flow</h2>
                <p className="mt-1 text-sm text-slate-500">Create, plan, assign, update, request parts, and complete jobs inside one simplified workspace.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{selectedWorkOrder ? `${selectedWorkOrder.woNumber} · ${selectedWorkOrder.title}` : "No job selected"}</div>
            </div>
          </div>

          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {([[
                "REQUEST",
                "Request intake"
              ], ["SCHEDULE", "Schedule"], ["ALLOCATION", "Allocation"], ["TIMING", "Time & fault"], ["PARTS", "Item request"], ["COMPLETION", "Completion"]] as Array<[StudioStep, string]>).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setStudioStep(value)} className={`rounded-full px-3 py-1.5 text-sm transition ${studioStep === value ? "bg-brand-600 text-white shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-200 hover:bg-brand-50/60"}`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="space-y-6 px-5 py-5 text-slate-900">
            {studioStep === "REQUEST" ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  {(["VEHICLE", "MACHINERY", "SERVICE"] as JobLane[]).map((lane) => {
                    const Icon = LANE_META[lane].icon;

                    return (
                      <button key={lane} type="button" onClick={() => setJobForm((current) => ({ ...current, lane, targetId: "", scheduleId: "" }))} className={`rounded-3xl border px-4 py-4 text-left transition ${jobForm.lane === lane ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50/70 hover:border-brand-200 hover:bg-white"}`}>
                        <div className={`inline-flex items-center gap-2 text-sm font-semibold ${jobForm.lane === lane ? "text-brand-800" : "text-slate-800"}`}><Icon size={15} /> {LANE_META[lane].label}</div>
                        <p className="mt-2 text-sm text-slate-500">{LANE_META[lane].description}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className={studioLabelClass}>Job title<input value={jobForm.title} onChange={(event) => setJobForm((current) => ({ ...current, title: event.target.value }))} className={studioInputClass} placeholder="Brake replacement, conveyor inspection, HVAC service..." /></label>
                  <label className={studioLabelClass}>Request date<input type="date" value={jobForm.requestDate} onChange={(event) => setJobForm((current) => ({ ...current, requestDate: event.target.value }))} className={studioInputClass} /></label>
                  <label className={studioLabelClass}>Priority<select value={jobForm.priority} onChange={(event) => setJobForm((current) => ({ ...current, priority: event.target.value as Priority }))} className={studioInputClass}>{PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}</select></label>
                  <label className={studioLabelClass}>Job segment<select value={jobForm.type} onChange={(event) => setJobForm((current) => ({ ...current, type: event.target.value as WorkOrderType }))} className={studioInputClass}>{WORK_ORDER_TYPES.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}</select></label>
                  <label className={studioLabelClass}>Asset / vehicle<select value={jobForm.targetId} onChange={(event) => setJobForm((current) => ({ ...current, targetId: event.target.value, scheduleId: "" }))} className={studioInputClass}><option value="">Select target</option>{jobTargetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                  <label className={studioLabelClass}>Link existing schedule<select value={jobForm.scheduleId} onChange={(event) => setJobForm((current) => ({ ...current, scheduleId: event.target.value }))} className={studioInputClass}><option value="">No linked schedule</option>{compatibleSchedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name} · {formatLabel(schedule.frequency)}</option>)}</select></label>
                  <label className={studioLabelClass}>Due date<input type="date" value={jobForm.dueDate} onChange={(event) => setJobForm((current) => ({ ...current, dueDate: event.target.value }))} className={studioInputClass} /></label>
                  <label className={studioLabelClass}>Department name<input value={jobForm.departmentName} onChange={(event) => setJobForm((current) => ({ ...current, departmentName: event.target.value }))} className={studioInputClass} placeholder="Workshop, Fleet Ops, Plant Room..." /></label>
                  <label className={studioLabelClass}>Section name<input value={jobForm.sectionName} onChange={(event) => setJobForm((current) => ({ ...current, sectionName: event.target.value }))} className={studioInputClass} placeholder="Electrical, Mechanical, Body Shop..." /></label>
                  <label className={studioLabelClass}>Service party<input value={jobForm.serviceParty} onChange={(event) => setJobForm((current) => ({ ...current, serviceParty: event.target.value }))} className={studioInputClass} placeholder="Internal crew, vendor, or mixed team" /></label>
                  <label className={studioLabelClass}>Position / mileage / hour meter<input value={jobForm.position} onChange={(event) => setJobForm((current) => ({ ...current, position: event.target.value }))} className={studioInputClass} placeholder="Left front, meter 191 hrs, 52,000 km..." /></label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className={studioLabelClass}>Fault condition<textarea rows={4} value={jobForm.faultCondition} onChange={(event) => setJobForm((current) => ({ ...current, faultCondition: event.target.value }))} className={studioInputClass} placeholder="Capture the observed fault or maintenance condition." /></label>
                  <label className={studioLabelClass}>Job narration / request brief<textarea rows={4} value={jobForm.narration} onChange={(event) => setJobForm((current) => ({ ...current, narration: event.target.value }))} className={studioInputClass} placeholder="Short operational summary, fault history, or request context." /></label>
                </div>

                <label className={studioLabelClass}>Additional description<textarea rows={4} value={jobForm.description} onChange={(event) => setJobForm((current) => ({ ...current, description: event.target.value }))} className={studioInputClass} placeholder="Add any extra details that should flow into the work order." /></label>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="max-w-2xl text-sm text-slate-600">This intake block keeps request creation focused without forcing users through separate maintenance screens.</p>
                  <button type="button" onClick={() => void handleCreateWorkOrder()} disabled={busyAction === "create-work-order"} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                    {busyAction === "create-work-order" ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />} Create job
                  </button>
                </div>
              </div>
            ) : null}

            {studioStep === "SCHEDULE" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={studioLabelClass}>Maintenance lane<select value={scheduleForm.lane} onChange={(event) => setScheduleForm((current) => ({ ...current, lane: event.target.value as JobLane, targetId: "" }))} className={studioInputClass}>{(["VEHICLE", "MACHINERY", "SERVICE"] as JobLane[]).map((lane) => <option key={lane} value={lane}>{LANE_META[lane].label}</option>)}</select></label>
                  <label className={studioLabelClass}>Schedule name<input value={scheduleForm.name} onChange={(event) => setScheduleForm((current) => ({ ...current, name: event.target.value }))} className={studioInputClass} placeholder="Monthly service, daily check, vibration review..." /></label>
                  <label className={studioLabelClass}>Target<select value={scheduleForm.targetId} onChange={(event) => setScheduleForm((current) => ({ ...current, targetId: event.target.value }))} className={studioInputClass}><option value="">Select target</option>{scheduleTargetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                  <label className={studioLabelClass}>Type<select value={scheduleForm.type} onChange={(event) => setScheduleForm((current) => ({ ...current, type: event.target.value as MaintenanceType }))} className={studioInputClass}>{MAINTENANCE_TYPES.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}</select></label>
                  <label className={studioLabelClass}>Frequency<select value={scheduleForm.frequency} onChange={(event) => setScheduleForm((current) => ({ ...current, frequency: event.target.value as MaintenanceFrequency }))} className={studioInputClass}>{MAINTENANCE_FREQUENCIES.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}</select></label>
                  <label className={studioLabelClass}>Next due date<input type="date" value={scheduleForm.nextDueDate} onChange={(event) => setScheduleForm((current) => ({ ...current, nextDueDate: event.target.value }))} className={studioInputClass} /></label>
                  <label className={studioLabelClass}>Interval days<input value={scheduleForm.intervalDays} onChange={(event) => setScheduleForm((current) => ({ ...current, intervalDays: event.target.value }))} className={studioInputClass} placeholder="30" disabled={scheduleForm.frequency === "MILEAGE_BASED"} /></label>
                  <label className={studioLabelClass}>Interval mileage / hours<input value={scheduleForm.intervalMileage} onChange={(event) => setScheduleForm((current) => ({ ...current, intervalMileage: event.target.value }))} className={studioInputClass} placeholder="5000" /></label>
                  <label className={studioLabelClass}>Estimated cost<input value={scheduleForm.estimatedCost} onChange={(event) => setScheduleForm((current) => ({ ...current, estimatedCost: event.target.value }))} className={studioInputClass} placeholder="850" /></label>
                  <label className={studioLabelClass}>Estimated hours<input value={scheduleForm.estimatedHours} onChange={(event) => setScheduleForm((current) => ({ ...current, estimatedHours: event.target.value }))} className={studioInputClass} placeholder="6" /></label>
                </div>

                <label className={studioLabelClass}>Schedule notes<textarea rows={4} value={scheduleForm.description} onChange={(event) => setScheduleForm((current) => ({ ...current, description: event.target.value }))} className={studioInputClass} placeholder="Capture the planning context, service interval rationale, or inspection criteria." /></label>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="max-w-2xl text-sm text-slate-600">Plan preventive work, review intervals, and keep upcoming maintenance visible in one place.</p>
                  <button type="button" onClick={() => void handleCreateSchedule()} disabled={busyAction === "create-schedule"} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                    {busyAction === "create-schedule" ? <Loader2 size={15} className="animate-spin" /> : <CalendarDays size={15} />} Create schedule
                  </button>
                </div>
              </div>
            ) : null}

            {studioStep === "ALLOCATION" ? (
              <div className="space-y-5">
                {!selectedWorkOrder ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Select a maintenance request from the queue before assigning staff or vendors.</div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className={studioLabelClass}>Primary assignee<select value={allocationForm.primaryAssigneeId} onChange={(event) => setAllocationForm((current) => ({ ...current, primaryAssigneeId: event.target.value }))} className={studioInputClass}><option value="">Select primary assignee</option>{technicians.map((user) => <option key={user.id} value={user.id}>{userFullName(user)} · {formatLabel(user.role?.name ?? "VIEWER")}</option>)}</select></label>
                      <label className={studioLabelClass}>Service party / shift<input value={allocationForm.serviceParty} onChange={(event) => setAllocationForm((current) => ({ ...current, serviceParty: event.target.value }))} className={studioInputClass} placeholder="Internal workshop, external vendor, night shift..." /></label>
                      <label className={studioLabelClass}>Vendor partner<input value={allocationForm.vendorPartner} onChange={(event) => setAllocationForm((current) => ({ ...current, vendorPartner: event.target.value }))} className={studioInputClass} placeholder="Optional vendor or subcontractor" /></label>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Support crew / engineers</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {technicians.map((user) => {
                          const active = allocationForm.supportCrewIds.includes(user.id);

                          return (
                            <button key={user.id} type="button" onClick={() => setAllocationForm((current) => ({ ...current, supportCrewIds: active ? current.supportCrewIds.filter((id) => id !== user.id) : [...current.supportCrewIds, user.id] }))} className={`rounded-full px-3 py-1.5 text-sm transition ${active ? "bg-brand-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50/50"}`}>
                              {userFullName(user)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="max-w-2xl text-sm text-slate-600">Assign the lead technician, supporting crew, and any vendor partner without leaving the studio.</p>
                      <button type="button" onClick={() => void handleApplyAllocation()} disabled={busyAction === "apply-allocation"} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                        {busyAction === "apply-allocation" ? <Loader2 size={15} className="animate-spin" /> : <UserRound size={15} />} Apply allocation
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {studioStep === "TIMING" ? (
              <div className="space-y-5">
                {!selectedWorkOrder ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Select a maintenance job before adding time estimation or fault updates.</div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className={studioLabelClass}>Due date<input type="date" value={timingForm.dueDate} onChange={(event) => setTimingForm((current) => ({ ...current, dueDate: event.target.value }))} className={studioInputClass} /></label>
                      <label className={studioLabelClass}>Estimated cost<input value={timingForm.estimatedCost} onChange={(event) => setTimingForm((current) => ({ ...current, estimatedCost: event.target.value }))} className={studioInputClass} placeholder="1200" /></label>
                      <label className={studioLabelClass}>Estimated hours<input value={timingForm.estimatedHours} onChange={(event) => setTimingForm((current) => ({ ...current, estimatedHours: event.target.value }))} className={studioInputClass} placeholder="8" /></label>
                      <label className={studioLabelClass}>Fault condition<input value={timingForm.faultCondition} onChange={(event) => setTimingForm((current) => ({ ...current, faultCondition: event.target.value }))} className={studioInputClass} placeholder="Noise, leakage, overheating, worn part..." /></label>
                      <label className={studioLabelClass}>Start date<input type="date" value={timingForm.startDate} onChange={(event) => setTimingForm((current) => ({ ...current, startDate: event.target.value }))} className={studioInputClass} /></label>
                      <label className={studioLabelClass}>Start time<input type="time" value={timingForm.startTime} onChange={(event) => setTimingForm((current) => ({ ...current, startTime: event.target.value }))} className={studioInputClass} /></label>
                      <label className={studioLabelClass}>End date<input type="date" value={timingForm.endDate} onChange={(event) => setTimingForm((current) => ({ ...current, endDate: event.target.value }))} className={studioInputClass} /></label>
                      <label className={studioLabelClass}>End time<input type="time" value={timingForm.endTime} onChange={(event) => setTimingForm((current) => ({ ...current, endTime: event.target.value }))} className={studioInputClass} /></label>
                      <label className={studioLabelClass}>Previous reading<input value={timingForm.previousReading} onChange={(event) => setTimingForm((current) => ({ ...current, previousReading: event.target.value }))} className={studioInputClass} placeholder="Previous mileage / meter / counter" /></label>
                      <label className={studioLabelClass}>Current reading<input value={timingForm.currentReading} onChange={(event) => setTimingForm((current) => ({ ...current, currentReading: event.target.value }))} className={studioInputClass} placeholder="Current mileage / meter / counter" /></label>
                    </div>

                    <label className={studioLabelClass}>Job narration<textarea rows={5} value={timingForm.narration} onChange={(event) => setTimingForm((current) => ({ ...current, narration: event.target.value }))} className={studioInputClass} placeholder="Capture the inspection result, repair narrative, time estimation assumptions, or issue diagnosis." /></label>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="max-w-2xl text-sm text-slate-600">Capture timing, readings, and fault updates before moving the job into live execution.</p>
                      <button type="button" onClick={() => void handleStartSelectedWorkOrder()} disabled={busyAction === "start-work-order"} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                        {busyAction === "start-work-order" ? <Loader2 size={15} className="animate-spin" /> : <Clock3 size={15} />} Start / update live job
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {studioStep === "PARTS" ? (
              <div className="space-y-5">
                {!selectedWorkOrder ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Select a maintenance job before building the item request list.</div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-[1.1fr_1fr_auto]">
                      <label className={studioLabelClass}>Item group<select value={partForm.category} onChange={(event) => setPartForm((current) => ({ ...current, category: event.target.value, partId: "" }))} className={studioInputClass}><option value="">All categories</option>{partCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                      <label className={studioLabelClass}>Item<select value={partForm.partId} onChange={(event) => setPartForm((current) => ({ ...current, partId: event.target.value }))} className={studioInputClass}><option value="">Select item</option>{visibleParts.map((part) => <option key={part.id} value={part.id}>{part.partNumber} · {part.name} ({part.quantityInStock} in stock)</option>)}</select></label>
                      <div className={studioLabelClass}>
                        Quantity
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setPartForm((current) => ({ ...current, quantity: Math.max(1, current.quantity - 1) }))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 hover:border-brand-200 hover:bg-brand-50/50">-</button>
                          <input value={partForm.quantity} onChange={(event) => setPartForm((current) => ({ ...current, quantity: Math.max(1, Number(event.target.value) || 1) }))} className={`${studioInputClass} w-20 text-center`} />
                          <button type="button" onClick={() => setPartForm((current) => ({ ...current, quantity: current.quantity + 1 }))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 hover:border-brand-200 hover:bg-brand-50/50">+</button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={handleQueuePart} className="inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100/70"><PackagePlus size={15} /> Add item</button>
                      <button type="button" onClick={() => void handleSubmitPartRequest()} disabled={busyAction === "submit-part-request"} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">{busyAction === "submit-part-request" ? <Loader2 size={15} className="animate-spin" /> : <Boxes size={15} />} Submit item request</button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Queued items</p>
                        <div className="mt-3 space-y-2">
                          {queuedPartDetails.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">No items staged yet.</div> : queuedPartDetails.map((entry) => <div key={entry.partId} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><div><p className="font-medium text-slate-900">{entry.part?.partNumber ?? entry.partId}</p><p className="text-slate-500">{entry.part?.name ?? "Unknown item"}</p></div><p>{entry.quantity} {entry.part?.unit ?? "pcs"}</p></div>)}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Already linked to job</p>
                        <div className="mt-3 space-y-2">
                          {selectedWorkOrder.parts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">No linked items yet.</div> : selectedWorkOrder.parts.map((part) => <div key={part.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><div><p className="font-medium text-slate-900">{part.part.partNumber}</p><p className="text-slate-500">{part.part.name}</p></div><p>{part.quantity} {part.part.unit ?? "pcs"}</p></div>)}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {studioStep === "COMPLETION" ? (
              <div className="space-y-5">
                {!selectedWorkOrder ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Select a maintenance job before finalizing completion and the total report.</div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className={studioLabelClass}>Date now<input type="date" value={completionForm.completedOn} onChange={(event) => setCompletionForm((current) => ({ ...current, completedOn: event.target.value }))} className={studioInputClass} /></label>
                      <label className={studioLabelClass}>Time now<input type="time" value={completionForm.completedAt} onChange={(event) => setCompletionForm((current) => ({ ...current, completedAt: event.target.value }))} className={studioInputClass} /></label>
                      <label className={studioLabelClass}>Actual cost<input value={completionForm.actualCost} onChange={(event) => setCompletionForm((current) => ({ ...current, actualCost: event.target.value }))} className={studioInputClass} placeholder="1650" /></label>
                      <label className={studioLabelClass}>Actual hours<input value={completionForm.actualHours} onChange={(event) => setCompletionForm((current) => ({ ...current, actualHours: event.target.value }))} className={studioInputClass} placeholder="9" /></label>
                    </div>

                    <label className={studioLabelClass}>Completion summary / total report<textarea rows={5} value={completionForm.notes} onChange={(event) => setCompletionForm((current) => ({ ...current, notes: event.target.value }))} className={studioInputClass} placeholder="Capture work carried out, replaced parts, pending follow-up, and completion remarks." /></label>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Completion preview</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Job no</p><p className="mt-1 font-medium text-slate-900">{selectedWorkOrder.woNumber}</p></div>
                        <div><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Target</p><p className="mt-1 font-medium text-slate-900">{targetLabel(selectedWorkOrder)}</p></div>
                        <div><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Planned</p><p className="mt-1 font-medium text-slate-900">{formatCurrency(selectedWorkOrder.estimatedCost)} · {toNumber(selectedWorkOrder.estimatedHours).toFixed(1)} h</p></div>
                        <div><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Requested items</p><p className="mt-1 font-medium text-slate-900">{selectedWorkOrder.parts.length} linked items</p></div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="max-w-2xl text-sm text-slate-600">Finalize the job with completion notes, actual values, and a clean handoff into maintenance log history.</p>
                      <button type="button" onClick={() => void handleCompleteSelectedWorkOrder()} disabled={busyAction === "complete-work-order" || selectedWorkOrder.status === "COMPLETED"} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                        {busyAction === "complete-work-order" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {selectedWorkOrder.status === "COMPLETED" ? "Already complete" : "Complete job"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
