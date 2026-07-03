import { apiClient } from "./api-client";

export type SupportTicketRow = {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  severity: string;
  status: string;
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  firstResponseBreached?: boolean;
  resolutionBreached?: boolean;
  createdAt: string;
};

export async function fetchOperationsDashboard() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/post-go-live/dashboard");
  return response.data.data;
}

export async function fetchMonitoringDashboard() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/post-go-live/monitoring/dashboard");
  return response.data.data;
}

export async function fetchSupportTickets(params: Record<string, string | undefined> = {}) {
  const response = await apiClient.get<{ data: SupportTicketRow[] }>("/support/tickets", { params });
  return response.data.data ?? [];
}

export async function createSupportTicket(payload: Record<string, unknown>) {
  const response = await apiClient.post<{ data: SupportTicketRow }>("/support/tickets", payload);
  return response.data.data;
}

export async function fetchSlaDashboard() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/support/sla/dashboard");
  return response.data.data;
}

export async function fetchTrainingSessions() {
  const response = await apiClient.get<{ data: unknown[] }>("/post-go-live/training");
  return response.data.data ?? [];
}

export async function fetchChangeRequests() {
  const response = await apiClient.get<{ data: unknown[] }>("/change-requests");
  return response.data.data ?? [];
}

export async function fetchReleases() {
  const response = await apiClient.get<{ data: unknown[] }>("/releases");
  return response.data.data ?? [];
}

export async function fetchHypercarePlans() {
  const response = await apiClient.get<{ data: unknown[] }>("/post-go-live/hypercare");
  return response.data.data ?? [];
}

export async function fetchSupportHandover() {
  const response = await apiClient.get<{ data: Record<string, string> }>("/post-go-live/handover");
  return response.data.data;
}

export async function fetchPostGoLiveReport() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/post-go-live/report");
  return response.data.data;
}

export async function fetchEscalationMatrix() {
  const response = await apiClient.get<{ data: unknown[] }>("/support/escalation-matrix");
  return response.data.data ?? [];
}
