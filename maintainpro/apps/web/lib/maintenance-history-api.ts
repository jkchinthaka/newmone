import { apiClient } from "./api-client";

export type MaintenanceHistoryRow = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  assetLabel: string;
  assetCode: string;
  category: string;
  finalizedAt: string | null;
  technician: string;
  cost: number | null;
  vendor: string;
};

export type MaintenanceHistoryList = {
  items: MaintenanceHistoryRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { includesCancelled: boolean };
};

export async function listMaintenanceHistory(params: Record<string, string | number>) {
  const response = await apiClient.get("/work-orders/history", { params });
  const body = response.data as { data?: MaintenanceHistoryList };
  const data = body.data;
  return {
    items: data?.items ?? [],
    meta: data?.meta ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    summary: data?.summary ?? { includesCancelled: false }
  };
}
