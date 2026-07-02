import { apiClient } from "./api-client";

export type PersonRow = {
  id: string;
  employeeNo?: string | null;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  branchName?: string | null;
  departmentId?: string | null;
  designation: string;
  skills: string[];
  workCategories: string[];
  active: boolean;
  canLogin: boolean;
  linkedUserId?: string | null;
  loginStatus: "ACTIVE" | "DISABLED" | "NO_LOGIN";
  inviteStatus?: string | null;
  role?: { id: string; name: string } | null;
  department?: { id: string; name: string; code: string } | null;
  linkedUser?: {
    id: string;
    email: string;
    isActive: boolean;
    mustChangePassword: boolean;
    role: { id: string; name: string };
  } | null;
};

export type PeopleListResponse = {
  data: PersonRow[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
};

export type CreatePersonPayload = {
  employeeNo?: string;
  fullName: string;
  phone?: string;
  email?: string;
  branchName?: string;
  departmentId?: string;
  designation: string;
  active?: boolean;
  isTechnician?: boolean;
  skills?: string[];
  workCategories?: string[];
  dailyCapacityHours?: number;
  shift?: string;
  canReceiveWorkOrders?: boolean;
  availabilityStatus?: string;
  canLogin?: boolean;
  roleId?: string;
  branchScope?: string;
  inviteMethod?: "INVITE_EMAIL" | "TEMP_PASSWORD" | "COPY_LINK";
};

export async function fetchPeople(params: Record<string, string | number | undefined> = {}) {
  const response = await apiClient.get<PeopleListResponse>("/people", { params });
  return { items: response.data.data ?? [], meta: response.data.meta };
}

export async function createPerson(payload: CreatePersonPayload) {
  const response = await apiClient.post<{
    data: {
      person: PersonRow;
      temporaryPassword?: string;
      inviteLink?: string;
      emailProviderConfigured?: boolean;
    };
  }>("/people", payload);
  return response.data.data;
}

export async function deactivatePerson(id: string) {
  const response = await apiClient.post<{ data: PersonRow }>(`/people/${id}/deactivate`);
  return response.data.data;
}

export async function reactivatePerson(id: string) {
  const response = await apiClient.post<{ data: PersonRow }>(`/people/${id}/reactivate`);
  return response.data.data;
}

export async function enablePersonLogin(
  id: string,
  payload: { email: string; roleId: string; branchScope?: string; inviteMethod?: string }
) {
  const response = await apiClient.post<{
    data: { person: PersonRow; temporaryPassword?: string; inviteLink?: string };
  }>(`/people/${id}/enable-login`, payload);
  return response.data.data;
}

export async function disablePersonLogin(id: string) {
  const response = await apiClient.post<{ data: PersonRow }>(`/people/${id}/disable-login`);
  return response.data.data;
}

export async function sendUserInvite(userId: string) {
  const response = await apiClient.post<{
    data: { inviteLink: string; emailSent: boolean; emailProviderConfigured: boolean };
  }>(`/users/${userId}/send-invite`);
  return response.data.data;
}

export async function resendUserInvite(userId: string) {
  const response = await apiClient.post<{ data: { inviteLink: string; emailSent: boolean } }>(
    `/users/${userId}/resend-invite`
  );
  return response.data.data;
}

export async function revokeUserInvite(userId: string) {
  await apiClient.post(`/users/${userId}/revoke-invite`);
}

export async function resetUserPassword(
  userId: string,
  inviteMethod: "TEMP_PASSWORD" | "INVITE_EMAIL" | "COPY_LINK" = "TEMP_PASSWORD"
) {
  const response = await apiClient.post<{ data: { temporaryPassword?: string; inviteLink?: string } }>(
    `/users/${userId}/reset-password`,
    { inviteMethod }
  );
  return response.data.data;
}

export async function verifyInviteToken(token: string) {
  const response = await apiClient.get<{ data: { email: string; fullName: string; expiresAt: string } }>(
    "/auth/invite/verify",
    { params: { token } }
  );
  return response.data.data;
}

export async function acceptInvite(token: string, password: string) {
  const response = await apiClient.post("/auth/invite/accept", { token, password });
  return response.data;
}
