import { apiClient } from "@/lib/api-client";

export type EnterpriseKpi = {
  value: number | null;
  href?: string;
  coverage?: string;
};

export type EnterpriseDashboard = {
  fleetAvailability: EnterpriseKpi;
  criticalVehicles: EnterpriseKpi;
  maintenanceDue: EnterpriseKpi;
  maintenanceOverdue: EnterpriseKpi;
  openCriticalWorkOrders: EnterpriseKpi;
  lowStock: EnterpriseKpi;
  outOfStock: EnterpriseKpi;
  forecastShortages: EnterpriseKpi;
  erpVariances: EnterpriseKpi;
  openExceptions: EnterpriseKpi;
  warrantyOpportunities: EnterpriseKpi;
  procurementRecommendations: EnterpriseKpi;
  monthlyFleetCost: EnterpriseKpi;
};

export async function fetchEnterpriseDashboard() {
  const response = await apiClient.get<{ data: EnterpriseDashboard }>("/enterprise-ops/dashboard");
  return response.data.data;
}

export async function fetchBusinessExceptions(params?: Record<string, string | number | undefined>) {
  const response = await apiClient.get<{ data: { items: Array<Record<string, unknown>>; total: number } }>(
    "/enterprise-ops/exceptions",
    { params }
  );
  return response.data.data;
}

export async function resolveBusinessException(id: string, body: { status: string; resolution: string }) {
  const response = await apiClient.post(`/enterprise-ops/exceptions/${id}/resolve`, body);
  return response.data.data;
}

export async function fetchMaintenanceForecasts() {
  const response = await apiClient.get<{ data: Array<Record<string, unknown>> }>("/enterprise-ops/forecasts");
  return response.data.data ?? [];
}

export async function refreshMaintenanceForecasts() {
  const response = await apiClient.post("/enterprise-ops/forecasts/refresh");
  return response.data.data;
}

export async function fetchVehicleCosts() {
  const response = await apiClient.get<{ data: Array<Record<string, unknown>> }>("/enterprise-ops/costs");
  return response.data.data ?? [];
}

export async function fetchVehicleHealth() {
  const response = await apiClient.get<{ data: Array<Record<string, unknown>> }>("/enterprise-ops/health");
  return response.data.data ?? [];
}

export async function fetchWarrantyOpportunities() {
  const response = await apiClient.get<{ data: Array<Record<string, unknown>> }>("/enterprise-ops/warranty");
  return response.data.data ?? [];
}

export async function fetchProcurementRecommendations() {
  const response = await apiClient.get<{ data: Array<Record<string, unknown>> }>("/enterprise-ops/procurement");
  return response.data.data ?? [];
}

export async function evaluateProcurementRecommendations() {
  const response = await apiClient.post("/enterprise-ops/procurement/evaluate");
  return response.data.data;
}

export async function reviewProcurementRecommendation(id: string) {
  const response = await apiClient.post(`/enterprise-ops/procurement/${id}/review`);
  return response.data.data;
}

export async function convertProcurementRecommendation(id: string) {
  const response = await apiClient.post(`/enterprise-ops/procurement/${id}/create-po`);
  return response.data.data;
}
