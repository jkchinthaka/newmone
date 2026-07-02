import { apiClient } from "./api-client";

export type DeliveryItemStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "NOT_APPLICABLE"
  | "ACCEPTED_RISK";

export type DeliveryCategory =
  | "REQUIREMENTS"
  | "CORE_FUNCTIONS"
  | "VALIDATION"
  | "UI_UX"
  | "RESPONSIVE_DESIGN"
  | "SECURITY"
  | "DATABASE_DATA"
  | "PERFORMANCE"
  | "ERROR_HANDLING"
  | "DEPLOYMENT"
  | "USER_ROLES"
  | "REPORTS"
  | "NOTIFICATIONS"
  | "BACKUP_RECOVERY"
  | "DOCUMENTATION"
  | "FINAL_DEMO"
  | "CLIENT_SIGN_OFF";

export type DeliveryChecklistItem = {
  id: string;
  title: string;
  description?: string | null;
  category: DeliveryCategory;
  status: DeliveryItemStatus;
  evidence?: string | null;
  notes?: string | null;
  testedRole?: string | null;
  blocker: boolean;
  requiredForDelivery: boolean;
  signOffRequired: boolean;
  usabilityRating?: number | null;
  deviceSize?: string | null;
  responseTimeMs?: number | null;
};

export async function fetchDeliveryDashboard() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/delivery-readiness/dashboard");
  return response.data.data;
}

export async function fetchDeliveryCategories() {
  const response = await apiClient.get<{ data: Array<{ key: string; label: string; description: string }> }>(
    "/delivery-readiness/categories"
  );
  return response.data.data ?? [];
}

export async function fetchDeliveryItems(params: Record<string, string | undefined> = {}) {
  const response = await apiClient.get<{ data: DeliveryChecklistItem[]; meta?: { total: number } }>(
    "/delivery-readiness/items",
    { params: { pageSize: "200", ...params } }
  );
  return response.data.data ?? [];
}

export async function updateDeliveryItem(id: string, payload: Record<string, unknown>) {
  const response = await apiClient.patch<{ data: DeliveryChecklistItem }>(`/delivery-readiness/items/${id}`, payload);
  return response.data.data;
}

export async function completeDeliveryItem(id: string, payload: Record<string, unknown> = {}) {
  const response = await apiClient.post<{ data: DeliveryChecklistItem }>(
    `/delivery-readiness/items/${id}/complete`,
    payload
  );
  return response.data.data;
}

export async function failDeliveryItem(id: string, payload: { reason: string; blocker?: boolean }) {
  const response = await apiClient.post<{ data: DeliveryChecklistItem }>(
    `/delivery-readiness/items/${id}/fail`,
    payload
  );
  return response.data.data;
}

export async function acceptDeliveryRisk(id: string, payload: { reason: string }) {
  const response = await apiClient.post<{ data: DeliveryChecklistItem }>(
    `/delivery-readiness/items/${id}/accept-risk`,
    payload
  );
  return response.data.data;
}

export async function fetchDeliveryFinalReport() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/delivery-readiness/final-report");
  return response.data.data;
}

export async function signOffDelivery(payload: Record<string, unknown>) {
  const response = await apiClient.post<{ data: Record<string, unknown> }>("/delivery-readiness/sign-off", payload);
  return response.data.data;
}

export async function exportDeliveryReport() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/delivery-readiness/export");
  return response.data.data;
}

export const CATEGORY_LABELS: Record<DeliveryCategory, string> = {
  REQUIREMENTS: "Requirements",
  CORE_FUNCTIONS: "Core Functions",
  VALIDATION: "Validation",
  UI_UX: "UI / UX",
  RESPONSIVE_DESIGN: "Responsive Design",
  SECURITY: "Security",
  DATABASE_DATA: "Database & Data",
  PERFORMANCE: "Performance",
  ERROR_HANDLING: "Error Handling",
  DEPLOYMENT: "Deployment",
  USER_ROLES: "User Roles",
  REPORTS: "Reports",
  NOTIFICATIONS: "Notifications",
  BACKUP_RECOVERY: "Backup & Recovery",
  DOCUMENTATION: "Documentation",
  FINAL_DEMO: "Client Demo Flow",
  CLIENT_SIGN_OFF: "Client Sign-off"
};

export const STATUS_STYLES: Record<DeliveryItemStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  PASS: "bg-emerald-100 text-emerald-800",
  FAIL: "bg-rose-100 text-rose-800",
  BLOCKED: "bg-red-200 text-red-900",
  NOT_APPLICABLE: "bg-slate-200 text-slate-600",
  ACCEPTED_RISK: "bg-amber-100 text-amber-900"
};
