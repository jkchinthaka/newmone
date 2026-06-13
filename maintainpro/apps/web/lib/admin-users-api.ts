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
