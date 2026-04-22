"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { USER_KEY } from "@/lib/auth-storage";

import type {
  Employee,
  EstimateState,
  FaultCondition,
  FmsRole,
  InventoryItem,
  JobFormDraft,
  JobStatus,
  MaintenanceJob,
  MaintenanceSchedule,
  ModuleKey,
  PendingRequest,
  RequestType,
  RequestedItem,
  ToastNotification,
  Vendor
} from "./types";

type PersistedState = {
  jobs: MaintenanceJob[];
  pendingRequests: PendingRequest[];
  schedules: MaintenanceSchedule[];
  notifications: ToastNotification[];
};

type MaintenanceJobContextValue = PersistedState & {
  role: FmsRole;
  employees: Employee[];
  vendors: Vendor[];
  inventory: InventoryItem[];
  canEdit: boolean;
  previewJobId: (module: ModuleKey) => string;
  getPendingRequests: (filter: RequestType | "ALL") => PendingRequest[];
  getJobsByModule: (module: ModuleKey, filter: JobStatus | "ALL") => MaintenanceJob[];
  createManualJob: (module: ModuleKey, draft: Partial<MaintenanceJob>) => MaintenanceJob;
  createJobFromRequest: (requestId: string) => MaintenanceJob | null;
  saveJob: (jobId: string, patch: Partial<MaintenanceJob>) => MaintenanceJob | null;
  completeJob: (jobId: string, patch: Partial<MaintenanceJob>) => MaintenanceJob | null;
  addSchedule: (schedule: Omit<MaintenanceSchedule, "id">) => void;
  dismissNotification: (id: string) => void;
};

const STORAGE_KEY = "maintainpro_maintenance_job_v2";

const employees: Employee[] = [
  { epf: "EPF001", name: "W.G.H Saranga Kumara", specialty: "Mechanical" },
  { epf: "EPF002", name: "N.I. Prabath Fernando", specialty: "Electrical" },
  { epf: "EPF003", name: "M.M. Kaushalya Perera", specialty: "Service Coordination" },
  { epf: "EPF004", name: "A.R. Chamara Silva", specialty: "Fleet Support" }
];

const vendors: Vendor[] = [
  { code: "V001", name: "Alpha Engineering", creditPayment: "Credit", creditDays: 30, settlementWindow: "Monthly" },
  { code: "V002", name: "Delta Fleet Works", creditPayment: "Cash", creditDays: 0, settlementWindow: "Immediate" },
  { code: "V003", name: "Zen Service Partners", creditPayment: "Credit", creditDays: 14, settlementWindow: "Bi-weekly" }
];

const inventory: InventoryItem[] = [
  { id: "IT00001", group: "Brake", name: "Brake Pad Front Left", unit: "Nos", unitCost: 45 },
  { id: "IT00002", group: "Filter", name: "Hydraulic Filter", unit: "Nos", unitCost: 22 },
  { id: "IT00003", group: "Oil", name: "Engine Oil 15W-40", unit: "L", unitCost: 11 },
  { id: "IT00004", group: "Electrical", name: "Alternator Belt", unit: "Nos", unitCost: 18 }
];

const defaultState: PersistedState = {
  pendingRequests: [
    {
      id: "req-1",
      reqNumber: "REQ-24001",
      date: "2026-04-22",
      dueDate: "2026-04-20",
      assetNumber: "KH-1234",
      department: "IT Dept",
      requestedBy: "D. Jayasinghe",
      type: "VEHICLE",
      mainJob: "Tyre Replacement",
      subJob: "Front axle alignment",
      narration: "Vehicle pulling left and tyre wear is visible.",
      status: "PENDING"
    },
    {
      id: "req-2",
      reqNumber: "REQ-24002",
      date: "2026-04-22",
      dueDate: "2026-04-23",
      assetNumber: "MC-781",
      department: "Production",
      requestedBy: "H. Repala",
      type: "MACHINERY",
      mainJob: "Hydraulic Repair",
      subJob: "Pressure drop inspection",
      narration: "Hydraulic press loses pressure after 15 minutes of operation.",
      status: "PENDING"
    },
    {
      id: "req-3",
      reqNumber: "REQ-24003",
      date: "2026-04-21",
      dueDate: "2026-04-21",
      assetNumber: "SV-302",
      department: "Facilities",
      requestedBy: "T. Punyawardena",
      type: "SERVICE",
      mainJob: "HVAC Service",
      subJob: "Cooling loss",
      narration: "Main office HVAC needs urgent cooling calibration.",
      status: "PENDING"
    },
    {
      id: "req-4",
      reqNumber: "REQ-24004",
      date: "2026-04-20",
      dueDate: "2026-04-27",
      assetNumber: "GEN-11",
      department: "Power House",
      requestedBy: "K. Ariyaratne",
      type: "OTHER",
      mainJob: "Generator Inspection",
      subJob: "Noise diagnosis",
      narration: "Generator emits higher than normal vibration during load test.",
      status: "PENDING"
    }
  ],
  jobs: [
    {
      id: "job-1",
      module: "machinery",
      jobId: "CH00001",
      requestId: "req-legacy-1",
      requestNo: "REQ-23991",
      requestDate: "2026-04-18",
      requestedBy: "S. Kumar",
      status: "IN_PROGRESS",
      date: "2026-04-18",
      dueDate: "2026-04-25",
      assetNumber: "MC-221",
      department: "Workshop",
      jobType: "Internal",
      jobSegment: "Repair",
      mainJobCategory: "Maintenance",
      subJobCategory: "Bearing",
      title: "Conveyor bearing repair",
      narration: "Bearing noise and belt drift inspection in progress.",
      buildingName: "Plant 2",
      departmentName: "Workshop",
      sectionName: "Machinery Bay",
      serviceJobDefinition: "",
      serviceValue: "",
      vehicleInternalName: "",
      position: "",
      subJobDefinitions: ["Bearing replacement"],
      servicePartyCode: "V001",
      servicePartyName: "Alpha Engineering",
      onlineOrdering: true,
      mainJobCode: "M-REP-01",
      staff: [employees[0]],
      workers: [employees[1]],
      estimateState: "Approved",
      estimateTime: "6h",
      startDate: "2026-04-19",
      endDate: "2026-04-25",
      startTime: "08:00",
      endTime: "15:00",
      faultCondition: "Major Fault",
      faultNarration: "Bearing overheating observed.",
      previousReading: "450",
      currentReading: "460",
      maintenanceMode: "Sudden",
      requestedItems: [{ itemId: "IT00002", name: "Hydraulic Filter", group: "Filter", quantity: 2, unit: "Nos", unitCost: 22 }],
      machineNumber: "MC-221",
      completionDate: "",
      completionTime: "",
      completionNotes: "",
      costing: { labor: 180, parts: 44, vendor: 120, total: 344 }
    },
    {
      id: "job-2",
      module: "service",
      jobId: "CH00002",
      status: "PENDING",
      date: "2026-04-21",
      dueDate: "2026-04-24",
      assetNumber: "SV-102",
      department: "Administration",
      jobType: "External",
      jobSegment: "Service",
      mainJobCategory: "Service",
      subJobCategory: "HVAC",
      title: "Cooling tower service",
      narration: "Vendor visit pending confirmation.",
      buildingName: "Head Office",
      departmentName: "Facilities",
      sectionName: "Tower 1",
      serviceJobDefinition: "Quarterly HVAC cleaning",
      serviceValue: "4,500",
      vehicleInternalName: "",
      position: "",
      subJobDefinitions: [],
      servicePartyCode: "V003",
      servicePartyName: "Zen Service Partners",
      onlineOrdering: false,
      mainJobCode: "S-HVAC-09",
      staff: [employees[2]],
      workers: [],
      estimateState: "Quoted",
      estimateTime: "4h",
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      faultCondition: "Minor Fault",
      faultNarration: "Cooling inconsistent during peak hours.",
      previousReading: "0",
      currentReading: "0",
      maintenanceMode: "Regular",
      requestedItems: [],
      machineNumber: "",
      completionDate: "",
      completionTime: "",
      completionNotes: "",
      costing: { labor: 90, parts: 0, vendor: 210, total: 300 }
    },
    {
      id: "job-3",
      module: "vehicle",
      jobId: "CH00003",
      status: "COMPLETED",
      date: "2026-04-17",
      dueDate: "2026-04-19",
      assetNumber: "CAB-7788",
      department: "Transport",
      jobType: "Internal",
      jobSegment: "Repair",
      mainJobCategory: "Repair",
      subJobCategory: "Tyres",
      title: "Rear tyre alignment",
      narration: "Completed with balancing and road test.",
      buildingName: "Depot",
      departmentName: "Transport",
      sectionName: "Vehicle Bay",
      serviceJobDefinition: "",
      serviceValue: "",
      vehicleInternalName: "Cab 12",
      position: "Rear Right",
      subJobDefinitions: ["Tyre balancing"],
      servicePartyCode: "V002",
      servicePartyName: "Delta Fleet Works",
      onlineOrdering: false,
      mainJobCode: "V-TYR-05",
      staff: [employees[3]],
      workers: [employees[0]],
      estimateState: "Approved",
      estimateTime: "3h",
      startDate: "2026-04-17",
      endDate: "2026-04-18",
      startTime: "10:00",
      endTime: "13:15",
      faultCondition: "Minor Fault",
      faultNarration: "Completed after alignment and replacement.",
      previousReading: "128500",
      currentReading: "128590",
      maintenanceMode: "Regular",
      requestedItems: [{ itemId: "IT00001", name: "Brake Pad Front Left", group: "Brake", quantity: 4, unit: "Nos", unitCost: 45 }],
      machineNumber: "",
      completionDate: "2026-04-18",
      completionTime: "13:30",
      completionNotes: "Vehicle released to operations.",
      costing: { labor: 75, parts: 180, vendor: 30, total: 285 }
    }
  ],
  schedules: [
    { id: "sch-1", title: "Quarterly fleet inspection", module: "vehicle", target: "Fleet A", dueDate: "2026-05-05", interval: "Quarterly" },
    { id: "sch-2", title: "Conveyor lubrication", module: "machinery", target: "Plant 2", dueDate: "2026-04-29", interval: "Weekly" }
  ],
  notifications: [
    { id: "note-1", title: "Overdue attention", message: "1 vehicle request and 1 service request are overdue today.", tone: "warning" }
  ]
};

const roleMap: Record<string, FmsRole> = {
  SUPER_ADMIN: "MAINTENANCE_ADMIN",
  ADMIN: "MAINTENANCE_ADMIN",
  SUPERVISOR: "MAINTENANCE_MANAGER",
  VIEWER: "EXECUTIVE",
  DRIVER: "VEHICLE_SPECIALIST",
  MECHANIC: "MACHINERY_SPECIALIST"
};

const MaintenanceJobContext = createContext<MaintenanceJobContextValue | null>(null);

function normalizeModule(type: RequestType): ModuleKey {
  if (type === "VEHICLE") return "vehicle";
  if (type === "SERVICE") return "service";
  return "machinery";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseMoney(value: string | number | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeRequestedItems(items: RequestedItem[]) {
  return items.filter((item) => item.quantity > 0);
}

function recalculateCosting(job: MaintenanceJob) {
  const parts = job.requestedItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const hours = Number.parseFloat(job.estimateTime.replace(/[^\d.]/g, ""));
  const labor = Number.isFinite(hours) ? Math.round(hours * 35) : job.costing.labor;
  const vendor = parseMoney(job.serviceValue);

  return {
    labor,
    parts,
    vendor,
    total: labor + parts + vendor
  };
}

function buildEmptyJob(module: ModuleKey, jobCode: string): MaintenanceJob {
  return {
    id: `job-${Date.now()}`,
    module,
    jobId: jobCode,
    status: "PENDING",
    date: todayIso(),
    dueDate: todayIso(),
    assetNumber: "",
    department: "",
    jobType: "Internal",
    jobSegment: module === "service" ? "Service" : "Repair",
    mainJobCategory: "",
    subJobCategory: "",
    title: "",
    narration: "",
    buildingName: "",
    departmentName: "",
    sectionName: "",
    serviceJobDefinition: "",
    serviceValue: "",
    vehicleInternalName: "",
    position: "",
    subJobDefinitions: [],
    servicePartyCode: vendors[0]?.code ?? "",
    servicePartyName: vendors[0]?.name ?? "",
    onlineOrdering: false,
    mainJobCode: "",
    staff: [],
    workers: [],
    estimateState: "Quoted",
    estimateTime: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    faultCondition: "Operational",
    faultNarration: "",
    previousReading: "",
    currentReading: "",
    maintenanceMode: "Regular",
    requestedItems: [],
    machineNumber: "",
    completionDate: "",
    completionTime: "",
    completionNotes: "",
    costing: { labor: 0, parts: 0, vendor: 0, total: 0 }
  };
}

function sortRequests(requests: PendingRequest[]) {
  const now = new Date(todayIso()).getTime();
  return [...requests].sort((left, right) => {
    const leftOverdue = Math.max(0, Math.round((now - new Date(left.dueDate).getTime()) / 86400000));
    const rightOverdue = Math.max(0, Math.round((now - new Date(right.dueDate).getTime()) / 86400000));

    if (leftOverdue !== rightOverdue) {
      return rightOverdue - leftOverdue;
    }

    return new Date(left.date).getTime() - new Date(right.date).getTime();
  });
}

export function MaintenanceJobProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PersistedState;
        setState(parsed);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const role = useMemo<FmsRole>(() => {
    if (typeof window === "undefined") return "MAINTENANCE_MANAGER";

    try {
      const raw = window.localStorage.getItem(USER_KEY);
      if (!raw) return "MAINTENANCE_MANAGER";
      const parsed = JSON.parse(raw) as { role?: { name?: string } | null };
      return roleMap[parsed.role?.name ?? ""] ?? "MAINTENANCE_MANAGER";
    } catch {
      return "MAINTENANCE_MANAGER";
    }
  }, [hydrated]);

  const previewJobId = (module: ModuleKey) => {
    const count = state.jobs.filter((job) => job.module === module).length + 1;
    return `CH${String(count).padStart(5, "0")}`;
  };

  const getPendingRequests = (filter: RequestType | "ALL") => {
    const requests = state.pendingRequests.filter((request) => request.status === "PENDING");
    if (filter === "ALL") {
      return sortRequests(requests);
    }

    return sortRequests(requests.filter((request) => request.type === filter));
  };

  const getJobsByModule = (module: ModuleKey, filter: JobStatus | "ALL") => {
    return state.jobs
      .filter((job) => job.module === module)
      .filter((job) => (filter === "ALL" ? true : job.status === filter))
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  };

  const createManualJob = (module: ModuleKey, draft: Partial<MaintenanceJob>) => {
    const next = {
      ...buildEmptyJob(module, previewJobId(module)),
      ...draft,
      module,
      requestedItems: sanitizeRequestedItems(draft.requestedItems ?? []),
      staff: draft.staff ?? [],
      workers: draft.workers ?? [],
      subJobDefinitions: draft.subJobDefinitions ?? []
    } satisfies MaintenanceJob;

    const newJob = { ...next, costing: recalculateCosting(next) };

    setState((current) => ({
      ...current,
      jobs: [newJob, ...current.jobs],
      notifications: [
        {
          id: `note-${Date.now()}`,
          title: "New job saved",
          message: `${newJob.jobId} is ready for allocation and time estimation.`,
          tone: "success" as const
        },
        ...current.notifications
      ].slice(0, 6)
    }));

    return newJob;
  };

  const createJobFromRequest = (requestId: string) => {
    const request = state.pendingRequests.find((entry) => entry.id === requestId && entry.status === "PENDING");
    if (!request) {
      return null;
    }

    const module = normalizeModule(request.type);
    const seededJob: MaintenanceJob = {
      ...buildEmptyJob(module, previewJobId(module)),
      requestId: request.id,
      requestNo: request.reqNumber,
      requestDate: request.date,
      requestedBy: request.requestedBy,
      date: todayIso(),
      dueDate: request.dueDate,
      assetNumber: request.assetNumber,
      department: request.department,
      jobType: "Internal",
      jobSegment: request.type === "SERVICE" ? "Service" : "Repair",
      mainJobCategory: request.mainJob,
      subJobCategory: request.subJob,
      title: request.mainJob,
      narration: request.narration,
      buildingName: request.type === "SERVICE" ? "Head Office" : "Main Workshop",
      departmentName: request.department,
      sectionName: request.type === "VEHICLE" ? "Vehicle Bay" : "Operations",
      serviceJobDefinition: request.type === "SERVICE" ? request.mainJob : "",
      serviceValue: "",
      vehicleInternalName: request.type === "VEHICLE" ? request.assetNumber : "",
      position: "",
      subJobDefinitions: request.subJob ? [request.subJob] : [],
      onlineOrdering: true,
      mainJobCode: `${request.type.slice(0, 1)}-${String(Date.now()).slice(-4)}`,
      faultCondition: "Minor Fault",
      faultNarration: request.narration,
      machineNumber: module === "machinery" ? request.assetNumber : "",
    };

    const newJob = { ...seededJob, costing: recalculateCosting(seededJob) };

    setState((current) => ({
      ...current,
      jobs: [newJob, ...current.jobs],
      pendingRequests: current.pendingRequests.map((entry) => (entry.id === requestId ? { ...entry, status: "CONVERTED" } : entry)),
      notifications: [
        {
          id: `note-${Date.now()}`,
          title: "Job created",
          message: `${newJob.jobId} was created from ${request.reqNumber}.`,
          tone: "success" as const
        },
        ...current.notifications
      ].slice(0, 6)
    }));

    return newJob;
  };

  const saveJob = (jobId: string, patch: Partial<MaintenanceJob>) => {
    const currentJob = state.jobs.find((job) => job.id === jobId);
    if (!currentJob) {
      return null;
    }

    const requestedItems = patch.requestedItems ? sanitizeRequestedItems(patch.requestedItems) : currentJob.requestedItems;
    if ((patch.requestedItems ?? []).some((item) => item.quantity <= 0)) {
      setState((current) => ({
        ...current,
        notifications: [
          {
            id: `note-${Date.now()}`,
            title: "Item quantity blocked",
            message: "Zero-quantity items are not allowed in a request.",
            tone: "warning" as const
          },
          ...current.notifications
        ].slice(0, 6)
      }));
      return null;
    }

    const nextJob = {
      ...currentJob,
      ...patch,
      requestedItems,
      status: patch.status ?? (currentJob.startDate || patch.startDate ? "IN_PROGRESS" : currentJob.status)
    } satisfies MaintenanceJob;
    const recalculated = { ...nextJob, costing: recalculateCosting(nextJob) };

    setState((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.id === jobId ? recalculated : job))
    }));

    return recalculated;
  };

  const completeJob = (jobId: string, patch: Partial<MaintenanceJob>) => {
    const completed = saveJob(jobId, {
      ...patch,
      status: "COMPLETED",
      completionDate: patch.completionDate ?? todayIso()
    });

    if (!completed) {
      return null;
    }

    setState((current) => ({
      ...current,
      notifications: [
        {
          id: `note-${Date.now()}`,
          title: "Job completed",
          message: `${completed.jobId} has been marked completed and added to reporting.`,
          tone: "success" as const
        },
        ...current.notifications
      ].slice(0, 6)
    }));

    return completed;
  };

  const addSchedule = (schedule: Omit<MaintenanceSchedule, "id">) => {
    setState((current) => ({
      ...current,
      schedules: [{ ...schedule, id: `sch-${Date.now()}` }, ...current.schedules],
      notifications: [
        {
          id: `note-${Date.now()}`,
          title: "Schedule created",
          message: `${schedule.title} was added to the future maintenance queue.`,
          tone: "info" as const
        },
        ...current.notifications
      ].slice(0, 6)
    }));
  };

  const dismissNotification = (id: string) => {
    setState((current) => ({ ...current, notifications: current.notifications.filter((note) => note.id !== id) }));
  };

  const value = useMemo<MaintenanceJobContextValue>(
    () => ({
      ...state,
      role,
      employees,
      vendors,
      inventory,
      canEdit: role !== "EXECUTIVE",
      previewJobId,
      getPendingRequests,
      getJobsByModule,
      createManualJob,
      createJobFromRequest,
      saveJob,
      completeJob,
      addSchedule,
      dismissNotification
    }),
    [role, state]
  );

  return <MaintenanceJobContext.Provider value={value}>{children}</MaintenanceJobContext.Provider>;
}

export function useMaintenanceJobApp() {
  const context = useContext(MaintenanceJobContext);
  if (!context) {
    throw new Error("useMaintenanceJobApp must be used within MaintenanceJobProvider");
  }

  return context;
}

export function createRequestDraft(request: PendingRequest, jobNo: string): JobFormDraft {
  return {
    requestDate: request.date,
    requestNo: request.reqNumber,
    requestedBy: request.requestedBy,
    jobNo,
    department: request.department,
    mainJob: request.mainJob,
    subJob: request.subJob,
    narration: request.narration
  };
}

export const estimateStates: EstimateState[] = ["Quoted", "Approved", "Waiting Parts", "Vendor Review"];
export const faultConditions: FaultCondition[] = ["Operational", "Minor Fault", "Major Fault", "Breakdown"];
