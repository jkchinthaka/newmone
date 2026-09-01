import { apiClient, getApiErrorMessage } from "@/lib/api-client";

import type { AdminUserAccessRow } from "./admin-users";

type ApiEnvelope<T> = {
  data?: T;
  message?: string;
};

export type AdminUserDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  tenantId: string | null;
  departmentId: string | null;
  designation: string | null;
  mustChangePassword: boolean;
  role: { id: string; name: string };
};

export interface CreateAdminUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  phone?: string;
  tenantId?: string;
  departmentId?: string;
  designation?: string;
  password?: string;
}

export interface UpdateAdminUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  roleId?: string;
  tenantId?: string;
  departmentId?: string;
  designation?: string;
}

export interface SetAdminUserPasswordPayload {
  newPassword?: string;
  mustChangePassword?: boolean;
}

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

export async function createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUserDetail & { temporaryPassword?: string }> {
  try {
    const response = await apiClient.post<ApiEnvelope<AdminUserDetail & { temporaryPassword?: string }>>("/admin/users", payload);
    return response.data.data as AdminUserDetail & { temporaryPassword?: string };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to create user"));
  }
}

export async function updateAdminUser(userId: string, payload: UpdateAdminUserPayload): Promise<AdminUserDetail> {
  try {
    const response = await apiClient.patch<ApiEnvelope<AdminUserDetail>>(`/admin/users/${userId}`, payload);
    return response.data.data as AdminUserDetail;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to update user"));
  }
}

export async function setAdminUserPassword(
  userId: string,
  payload: SetAdminUserPasswordPayload
): Promise<{ updated: boolean; temporaryPassword?: string; mustChangePassword: boolean }> {
  try {
    const response = await apiClient.patch<ApiEnvelope<{ updated: boolean; temporaryPassword?: string; mustChangePassword: boolean }>>(
      `/admin/users/${userId}/password`,
      payload
    );
    return response.data.data as { updated: boolean; temporaryPassword?: string; mustChangePassword: boolean };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to update password"));
  }
}
