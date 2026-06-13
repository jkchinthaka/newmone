import { apiClient } from "./api-client";
import type { AdminInvitationCreateResponse, AdminInvitationReviewRow } from "./admin-invitations";

type ApiEnvelope<T> = {
  data: T;
};

export async function fetchAdminInvitationReviewList(): Promise<AdminInvitationReviewRow[]> {
  const response = await apiClient.get<ApiEnvelope<AdminInvitationReviewRow[]>>("/admin/invitations");
  return response.data.data ?? [];
}

export type CreateAdminInvitationPayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  membershipRole: AdminInvitationCreateResponse["membershipRole"];
  tenantId?: string;
};

export async function createAdminInvitation(
  payload: CreateAdminInvitationPayload
): Promise<AdminInvitationCreateResponse> {
  const response = await apiClient.post<ApiEnvelope<AdminInvitationCreateResponse>>("/admin/invitations", payload);
  return response.data.data;
}
