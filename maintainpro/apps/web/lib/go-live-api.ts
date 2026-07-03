import { apiClient } from "./api-client";

export async function fetchGoLiveDashboard() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/go-live/dashboard");
  return response.data.data;
}

export async function fetchPilotRollouts() {
  const response = await apiClient.get<{ data: unknown[] }>("/go-live/pilots");
  return response.data.data ?? [];
}

export async function fetchCutoverChecklist() {
  const response = await apiClient.get<{ data: unknown[] }>("/go-live/cutover-checklist");
  return response.data.data ?? [];
}

export async function fetchRolloutWaves() {
  const response = await apiClient.get<{ data: unknown[] }>("/go-live/waves");
  return response.data.data ?? [];
}

export async function fetchDecisionBoard() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/go-live/decision-board");
  return response.data.data;
}

export async function fetchRollbackPlans() {
  const response = await apiClient.get<{ data: unknown[] }>("/go-live/rollback-plan");
  return response.data.data ?? [];
}

export async function fetchLiveIssues() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/go-live/live-issues");
  return response.data.data;
}

export async function fetchSignOffs() {
  const response = await apiClient.get<{ data: unknown[] }>("/go-live/signoff");
  return response.data.data ?? [];
}

export async function fetchGoLiveReport() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/go-live/final-report");
  return response.data.data;
}
