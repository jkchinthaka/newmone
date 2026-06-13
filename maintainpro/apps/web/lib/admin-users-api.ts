import { apiClient } from "@/lib/api-client";

import type { AdminUserAccessRow } from "./admin-users";

type ApiEnvelope<T> = {
  data?: T;
  message?: string;
};

export async function fetchAdminUserAccessList(): Promise<AdminUserAccessRow[]> {
  const response = await apiClient.get<ApiEnvelope<AdminUserAccessRow[]>>("/admin/users");
  return response.data.data ?? [];
}

export async function updateAdminUserStatus(userId: string, isActive: boolean): Promise<AdminUserAccessRow> {
  const response = await apiClient.patch<ApiEnvelope<AdminUserAccessRow>>(`/admin/users/${userId}/status`, {
    isActive
  });
  return response.data.data as AdminUserAccessRow;
}
