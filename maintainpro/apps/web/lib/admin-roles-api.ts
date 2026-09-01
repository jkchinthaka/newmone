import { apiClient, getApiErrorMessage } from "./api-client";
import type { AdminRolesPermissionsMatrix } from "./admin-roles";

type ApiEnvelope<T> = {
  data: T;
};

export async function fetchAdminRolesPermissionsMatrix(): Promise<AdminRolesPermissionsMatrix> {
  const response = await apiClient.get<ApiEnvelope<AdminRolesPermissionsMatrix>>("/admin/roles-permissions");
  return response.data.data;
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]) {
  try {
    const response = await apiClient.patch<ApiEnvelope<{ id: string; name: string; permissionCount: number }>>(
      `/admin/roles/${roleId}/permissions`,
      { permissionIds }
    );
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to update role permissions"));
  }
}
