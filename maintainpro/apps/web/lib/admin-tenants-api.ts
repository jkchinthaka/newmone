import { apiClient } from "./api-client";
import type { AdminTenantOverviewRow } from "./admin-tenants";

type ApiEnvelope<T> = {
  data: T;
};

export async function fetchAdminTenantOverviewList(): Promise<AdminTenantOverviewRow[]> {
  const response = await apiClient.get<ApiEnvelope<AdminTenantOverviewRow[]>>("/admin/tenants");
  return response.data.data ?? [];
}
