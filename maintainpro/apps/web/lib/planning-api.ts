import { apiClient } from "./api-client";

export type PmPlan = {
  id: string;
  code: string;
  name: string;
  status: string;
  nextDueAt?: string | null;
  combineMode?: string;
  assetId?: string | null;
  functionalLocationId?: string | null;
  autoCreateWorkOrder?: boolean;
  currentRevision?: number;
  triggers?: Array<{ id: string; kind: string; intervalDays?: number | null }>;
};

export async function listPmPlans(params?: { status?: string }) {
  const response = await apiClient.get("/planning/pm-plans", { params });
  return (response.data as { data: PmPlan[] }).data;
}

export async function createPmPlan(body: Record<string, unknown>) {
  const response = await apiClient.post("/planning/pm-plans", body);
  return (response.data as { data: PmPlan }).data;
}

export async function autoCreatePmWorkOrder(planId: string, body?: Record<string, unknown>) {
  const response = await apiClient.post(`/planning/pm-plans/${planId}/auto-wo`, body ?? {});
  return (response.data as { data: unknown }).data;
}
