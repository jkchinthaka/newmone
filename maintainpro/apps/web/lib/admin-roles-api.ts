import { apiClient } from "./api-client";
import type { AdminRolesPermissionsMatrix } from "./admin-roles";

type ApiEnvelope<T> = {
  data: T;
};

export async function fetchAdminRolesPermissionsMatrix(): Promise<AdminRolesPermissionsMatrix> {
  const response = await apiClient.get<ApiEnvelope<AdminRolesPermissionsMatrix>>("/admin/roles-permissions");
  return response.data.data;
}
