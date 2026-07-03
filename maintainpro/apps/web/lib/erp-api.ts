import { apiClient } from "./api-client";

export async function fetchErpDashboard() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/erp/readiness");
  return response.data.data;
}

export async function fetchErpStatus() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/erp/status");
  return response.data.data;
}

export async function fetchErpMappings() {
  const response = await apiClient.get<{ data: unknown[] }>("/erp/mappings");
  return response.data.data ?? [];
}

export async function fetchErpMockStatus() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/erp/mock/status");
  return response.data.data;
}

export async function fetchErpImportBatches() {
  const response = await apiClient.get<{ data: unknown[] }>("/erp/import/batches");
  return response.data.data ?? [];
}

export async function fetchErpReconciliation() {
  const response = await apiClient.get<{ data: unknown[] }>("/erp/reconciliation");
  return response.data.data ?? [];
}

export async function fetchErpAccessChecklist() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/erp/access-checklist");
  return response.data.data;
}

export async function fetchErpReport() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/erp/report");
  return response.data.data;
}
