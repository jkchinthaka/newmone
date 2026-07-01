import { apiClient } from "@/lib/api-client";

export type WorkOrderTaxonomyLevel = "CATEGORY" | "TYPE" | "ISSUE";

export type WorkOrderTaxonomyNode = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  level: WorkOrderTaxonomyLevel;
  active: boolean;
  sortOrder: number;
  aliases: string[];
  keywords: string[];
  sinhalaKeywords: string[];
  defaultPriority?: string | null;
  requiresAsset: boolean;
  requiresVehicle: boolean;
  requiresLocation: boolean;
  requiresEvidence: boolean;
  gateOutBlockingRisk: boolean;
  usage?: {
    totalWorkOrders: number;
    activeWorkOrders: number;
    completedWorkOrders: number;
  };
};

export type TaxonomySuggestion = {
  categoryId?: string;
  typeId?: string;
  issueId?: string;
  categoryName?: string;
  typeName?: string;
  issueName?: string;
  pathLabel: string;
  confidence: number;
  matchedKeywords: string[];
  defaultPriority?: string;
  requiresAsset: boolean;
  requiresVehicle: boolean;
  requiresLocation: boolean;
  requiresEvidence: boolean;
  gateOutBlockingRisk: boolean;
  warnings: string[];
};

export type TaxonomySearchResult = WorkOrderTaxonomyNode & {
  score: number;
  matchedKeywords: string[];
  pathLabel: string;
};

interface ApiEnvelope<T> {
  data: T;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

export async function suggestWorkOrderTaxonomy(query: string) {
  const response = await apiClient.get<ApiEnvelope<{ suggestion: TaxonomySuggestion | null; method: string }>>(
    "/work-orders/taxonomy/suggest",
    { params: { q: query } }
  );
  return unwrap(response.data);
}

export async function searchWorkOrderTaxonomy(query: string, limit = 25) {
  const response = await apiClient.get<ApiEnvelope<TaxonomySearchResult[]>>("/work-orders/taxonomy/search", {
    params: { q: query, limit }
  });
  return unwrap(response.data);
}

export async function fetchWorkOrderTaxonomy(params?: {
  includeInactive?: boolean;
  level?: WorkOrderTaxonomyLevel;
  parentId?: string;
}) {
  const response = await apiClient.get<ApiEnvelope<WorkOrderTaxonomyNode[]>>("/work-orders/taxonomy", { params });
  return unwrap(response.data);
}

export async function createWorkOrderTaxonomy(payload: Record<string, unknown>) {
  const response = await apiClient.post<ApiEnvelope<WorkOrderTaxonomyNode>>("/work-orders/taxonomy", payload);
  return unwrap(response.data);
}

export async function updateWorkOrderTaxonomy(id: string, payload: Record<string, unknown>) {
  const response = await apiClient.patch<ApiEnvelope<WorkOrderTaxonomyNode>>(`/work-orders/taxonomy/${id}`, payload);
  return unwrap(response.data);
}

export async function deactivateWorkOrderTaxonomy(id: string) {
  const response = await apiClient.patch<ApiEnvelope<WorkOrderTaxonomyNode>>(`/work-orders/taxonomy/${id}/deactivate`);
  return unwrap(response.data);
}

export async function fetchWorkOrderCategorySummary(params?: Record<string, string>) {
  const response = await apiClient.get<ApiEnvelope<{ categories: Array<Record<string, unknown>>; triageCount: number }>>(
    "/work-orders/category-summary",
    { params }
  );
  return unwrap(response.data);
}
