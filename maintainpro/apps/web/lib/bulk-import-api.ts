import { apiClient, getApiErrorMessage } from "@/lib/api-client";

/**
 * Client for the generic master-data Bulk Import framework
 * (docs/BULK_IMPORT_ARCHITECTURE.md). SUPER_ADMIN only — the server
 * independently re-verifies this on every call regardless of what the UI
 * shows.
 */
export type BulkImportEntitySlug = "vehicle" | "asset" | "department" | "supplier" | "job-code";

export type BulkImportMode = "CREATE_NEW_SKIP_EXISTING" | "UPDATE_EXISTING";

export type BulkImportRowAction = "CREATE" | "UPDATE" | "SKIP_EXISTING" | "SKIP_DUPLICATE_FILE_ROW" | "ERROR";

export interface BulkImportFieldIssue {
  field: string;
  code: string;
  message: string;
}

export interface BulkImportRun {
  id: string;
  entityType: string;
  mode: BulkImportMode;
  status: "UPLOADED" | "VALIDATED" | "BLOCKED" | "COMMITTING" | "COMPLETED" | "PARTIAL" | "FAILED" | "EXPIRED";
  originalFilename: string;
  fileFormat: string;
  fileSha256: string;
  fileSizeBytes: number;
  actorEmail: string;
  totalRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  errorSummary: string | null;
  createdAt: string;
  validatedAt: string | null;
  committedAt: string | null;
  expiresAt: string;
}

export interface BulkImportPreviewRow {
  id: string;
  rowNumber: number;
  naturalKey: string | null;
  data: Record<string, unknown>;
  action: BulkImportRowAction;
  errors: BulkImportFieldIssue[];
  warnings: BulkImportFieldIssue[];
  createdEntityId: string | null;
}

export interface BulkImportSummary {
  totalRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
}

export interface BulkImportPreviewResult {
  run: BulkImportRun;
  rows: BulkImportPreviewRow[];
  summary: BulkImportSummary;
  blocked: boolean;
  commitAllowed: boolean;
}

export interface BulkImportCommitResult {
  run: BulkImportRun;
  reused: boolean;
  message: string;
}

export async function downloadBulkImportTemplate(entity: BulkImportEntitySlug, format: "csv" | "xlsx" = "csv") {
  try {
    const response = await apiClient.get(`/bulk-import/${entity}/template`, {
      params: { format },
      responseType: "blob"
    });
    return response.data as Blob;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to download the template"));
  }
}

export async function previewBulkImport(entity: BulkImportEntitySlug, file: File, mode?: BulkImportMode) {
  const form = new FormData();
  form.append("file", file);
  if (mode) form.append("mode", mode);
  try {
    const response = await apiClient.post(`/bulk-import/${entity}/preview`, form, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data.data as BulkImportPreviewResult;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Preview failed"));
  }
}

export async function commitBulkImport(entity: BulkImportEntitySlug, importId: string) {
  try {
    const response = await apiClient.post(`/bulk-import/${entity}/${importId}/commit`, { confirmed: true });
    return response.data.data as BulkImportCommitResult;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Import commit failed"));
  }
}

export async function fetchBulkImportRun(entity: BulkImportEntitySlug, importId: string) {
  try {
    const response = await apiClient.get(`/bulk-import/${entity}/${importId}`);
    return response.data.data as { run: BulkImportRun; rows: BulkImportPreviewRow[] };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to load import run"));
  }
}

export async function fetchBulkImportHistory(params: { page?: number; pageSize?: number; entity?: BulkImportEntitySlug } = {}) {
  try {
    const response = await apiClient.get("/bulk-import", { params });
    return {
      items: response.data.data as BulkImportRun[],
      meta: response.data.meta as { page: number; pageSize: number; total: number; totalPages: number }
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to load bulk import history"));
  }
}

export async function downloadBulkImportErrors(entity: BulkImportEntitySlug, importId: string) {
  try {
    const response = await apiClient.get(`/bulk-import/${entity}/${importId}/errors`, { responseType: "blob" });
    return response.data as Blob;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to download the error report"));
  }
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
