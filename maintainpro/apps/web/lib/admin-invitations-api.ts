import { apiClient } from "./api-client";
import type { AdminInvitationReviewRow } from "./admin-invitations";

type ApiEnvelope<T> = {
  data: T;
};

export async function fetchAdminInvitationReviewList(): Promise<AdminInvitationReviewRow[]> {
  const response = await apiClient.get<ApiEnvelope<AdminInvitationReviewRow[]>>("/admin/invitations");
  return response.data.data ?? [];
}
