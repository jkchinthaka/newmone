import { apiClient } from "./api-client";

export type PmPlan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  dueState?: string;
  remainingDays?: number | null;
  nextDueAt?: string | null;
  /** STORED = saved schedule; PROJECTED = calculated from last completion / schedule start. */
  nextDueSource?: "STORED" | "PROJECTED" | null;
  /** Legacy invalid ACTIVE plans (e.g. NO_ASSET_ASSIGNED) that require remediation. */
  validityIssues?: string[];
  nextDueMeterValue?: number | null;
  combineMode?: string;
  assetId?: string | null;
  vehicleId?: string | null;
  functionalLocationId?: string | null;
  autoCreateWorkOrder?: boolean;
  gracePeriodDays?: number;
  currentRevision?: number;
  asset?: { name: string; assetTag: string } | null;
  vehicle?: { registrationNo: string; make: string; vehicleModel: string } | null;
  workOrders?: Array<{ id: string; woNumber: string; status: string }>;
  triggers?: Array<{
    id: string;
    kind: string;
    intervalDays?: number | null;
    intervalValue?: number | null;
    unit?: string | null;
  }>;
};

export type PmPlanList = {
  items: PmPlan[];
  summary: { active: number; dueIn7: number; overdue: number; needsAttention: number };
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export async function listPmPlans(params?: Record<string, string | number | undefined>) {
  const response = await apiClient.get("/planning/pm-plans", { params });
  const body = response.data as {
    data: PmPlan[];
    meta?: PmPlanList["meta"] & { summary?: PmPlanList["summary"] };
  };
  return {
    items: body.data ?? [],
    summary: body.meta?.summary ?? { active: 0, dueIn7: 0, overdue: 0, needsAttention: 0 },
    meta: {
      page: body.meta?.page ?? 1,
      pageSize: body.meta?.pageSize ?? 25,
      total: body.meta?.total ?? body.data?.length ?? 0,
      totalPages: body.meta?.totalPages ?? 1
    }
  };
}

export async function createPmPlan(body: Record<string, unknown>) {
  const response = await apiClient.post("/planning/pm-plans", body);
  return (response.data as { data: PmPlan }).data;
}

export async function revisePmPlan(planId: string, patch: Record<string, unknown>, changeReason: string) {
  const response = await apiClient.put(`/planning/pm-plans/${planId}/revise`, { patch, changeReason });
  return (response.data as { data: PmPlan }).data;
}

export async function listInspections(params?: Record<string, string | number | undefined>) {
  const response = await apiClient.get("/planning/inspections", { params });
  const body = response.data as {
    data: Array<Record<string, unknown>>;
    meta?: {
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
      summary?: { dueToday: number; overdue: number; failed: number; completedThisWeek: number };
    };
  };
  return {
    items: body.data ?? [],
    summary: body.meta?.summary ?? { dueToday: 0, overdue: 0, failed: 0, completedThisWeek: 0 },
    meta: {
      page: body.meta?.page ?? 1,
      total: body.meta?.total ?? body.data?.length ?? 0,
      totalPages: body.meta?.totalPages ?? 1
    }
  };
}

export async function scheduleInspection(body: Record<string, unknown>) {
  const response = await apiClient.post("/planning/inspections/schedule", body);
  return (response.data as { data: unknown }).data;
}

export async function completeInspection(body: Record<string, unknown>) {
  const response = await apiClient.post("/planning/inspections", body);
  return (response.data as { data: unknown }).data;
}

export async function autoCreatePmWorkOrder(planId: string, body?: Record<string, unknown>) {
  const response = await apiClient.post(`/planning/pm-plans/${planId}/auto-wo`, body ?? {});
  return (response.data as { data: unknown }).data;
}

export async function listInspectionTemplates() {
  const response = await apiClient.get("/planning/inspection-templates");
  return (response.data as { data: Array<Record<string, unknown>> }).data ?? [];
}
