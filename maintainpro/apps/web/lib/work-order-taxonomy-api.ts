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

export type WorkOrderTaxonomySuggestionResponse = {
  query: string;
  suggestion: TaxonomySuggestion | null;
  suggestions?: TaxonomySuggestion[];
  method: string;
  roadmapNote?: string;
};

export type TaxonomySearchResult = WorkOrderTaxonomyNode & {
  categoryId?: string;
  typeId?: string;
  issueId?: string;
  score: number;
  matchedKeywords: string[];
  pathLabel: string;
};

export type WorkOrderCategorySummaryRow = {
  categoryId?: string | null;
  categoryName: string;
  total: number;
  open: number;
  inProgress: number;
  overdue: number;
  highRisk: number;
  completed: number;
  cancelled: number;
  triage: number;
  evidenceMissing: number;
  partsPending: number;
  supervisorVerificationPending: number;
};

export type WorkOrderCategorySummaryResponse = {
  categories: WorkOrderCategorySummaryRow[];
  triageCount: number;
  totalWorkOrders: number;
  generatedAt: string;
  filters?: Record<string, unknown>;
};

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

export async function suggestWorkOrderTaxonomy(query: string): Promise<WorkOrderTaxonomySuggestionResponse> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { query: trimmed, suggestion: null, suggestions: [], method: "skipped_short_query" };
  }

  const response = await apiClient.get<ApiEnvelope<WorkOrderTaxonomySuggestionResponse>>(
    "/work-orders/taxonomy/suggest",
    { params: { q: trimmed } }
  );
  const data = unwrap<WorkOrderTaxonomySuggestionResponse>(response.data);
  return {
    ...data,
    suggestion: data.suggestion ?? null,
    suggestions: data.suggestions ?? []
  };
}

export async function searchWorkOrderTaxonomy(query: string, limit = 25): Promise<TaxonomySearchResult[]> {
  const response = await apiClient.get<ApiEnvelope<TaxonomySearchResult[]>>("/work-orders/taxonomy/search", {
    params: { q: query, limit }
  });
  return unwrap<TaxonomySearchResult[]>(response.data);
}

export async function fetchWorkOrderTaxonomy(params?: {
  includeInactive?: boolean;
  level?: WorkOrderTaxonomyLevel;
  parentId?: string;
}): Promise<WorkOrderTaxonomyNode[]> {
  const response = await apiClient.get<ApiEnvelope<WorkOrderTaxonomyNode[]>>("/work-orders/taxonomy", { params });
  return unwrap<WorkOrderTaxonomyNode[]>(response.data);
}

export async function createWorkOrderTaxonomy(
  payload: Record<string, unknown>
): Promise<WorkOrderTaxonomyNode> {
  const response = await apiClient.post<ApiEnvelope<WorkOrderTaxonomyNode>>("/work-orders/taxonomy", payload);
  return unwrap<WorkOrderTaxonomyNode>(response.data);
}

export async function updateWorkOrderTaxonomy(
  id: string,
  payload: Record<string, unknown>
): Promise<WorkOrderTaxonomyNode> {
  const response = await apiClient.patch<ApiEnvelope<WorkOrderTaxonomyNode>>(`/work-orders/taxonomy/${id}`, payload);
  return unwrap<WorkOrderTaxonomyNode>(response.data);
}

export async function deactivateWorkOrderTaxonomy(id: string): Promise<WorkOrderTaxonomyNode> {
  const response = await apiClient.patch<ApiEnvelope<WorkOrderTaxonomyNode>>(
    `/work-orders/taxonomy/${id}/deactivate`
  );
  return unwrap<WorkOrderTaxonomyNode>(response.data);
}

export async function fetchWorkOrderCategorySummary(
  params?: Record<string, string>
): Promise<WorkOrderCategorySummaryResponse> {
  const response = await apiClient.get<ApiEnvelope<WorkOrderCategorySummaryResponse>>(
    "/work-orders/category-summary",
    { params }
  );
  return unwrap<WorkOrderCategorySummaryResponse>(response.data);
}

export function formatTaxonomyPathLabel(suggestion: Pick<TaxonomySuggestion, "pathLabel" | "categoryName" | "typeName" | "issueName">): string {
  if (suggestion.pathLabel?.trim()) {
    return suggestion.pathLabel.trim();
  }
  return [suggestion.categoryName, suggestion.typeName, suggestion.issueName].filter(Boolean).join(" → ");
}
