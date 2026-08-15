import { apiClient, getApiErrorMessage } from "@/lib/api-client";

export type ErpExcelColumnMapping = {
  itemCode: string;
  quantity: string;
  itemName?: string | null;
  warehouse?: string | null;
  uom?: string | null;
  businessDate?: string | null;
};

export type ErpExcelImportRun = {
  id: string;
  originalFilename: string;
  fileSha256: string;
  sheetName: string | null;
  warehouseScope: string | null;
  status: string;
  uploadedAt: string;
  validatedAt: string | null;
  appliedAt: string | null;
  totalRows: number;
  matchedRows: number;
  changedRows: number;
  unchangedRows: number;
  unmappedRows: number;
  duplicateRows: number;
  invalidRows: number;
  updatedRows: number;
  failedRows: number;
  mappingSnapshot?: {
    headers?: string[];
    suggestedMapping?: Partial<ErpExcelColumnMapping>;
    mapping?: ErpExcelColumnMapping;
    mappingConfidence?: string;
  } | null;
  sheetsDetected?: string[] | null;
  warehousesDetected?: string[] | null;
  errorSummary?: string | null;
  applyMessage?: string | null;
};

export type ErpExcelPreviewRow = {
  id: string;
  rowNumber: number;
  erpItemCode: string | null;
  itemName: string | null;
  erpQuantity: number | null;
  warehouseCode: string | null;
  maintainProItem: string | null;
  maintainProQuantity: number | null;
  difference: number | null;
  status: string;
  message: string | null;
};

export async function uploadErpExcelImport(file: File) {
  const form = new FormData();
  form.append("file", file);
  try {
    const response = await apiClient.post("/inventory/erp-import/upload", form, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data.data as {
      run: ErpExcelImportRun;
      reused: boolean;
      insight: {
        sheetNames: string[];
        selectedSheet: string;
        headers: string[];
        suggestedMapping: Partial<ErpExcelColumnMapping>;
        mappingConfidence: string;
        warehousesDetected: string[];
        sampleRowCount: number;
      };
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Upload failed"));
  }
}

export async function validateErpExcelImport(
  id: string,
  body: {
    sheetName?: string;
    mapping: ErpExcelColumnMapping;
    warehouseScope?: string | null;
    businessDate?: string | null;
  }
) {
  try {
    const response = await apiClient.post(`/inventory/erp-import/${id}/validate`, body);
    return response.data.data as {
      run: ErpExcelImportRun;
      preview: ErpExcelPreviewRow[];
      summary: {
        totalRows: number;
        matched: number;
        changed: number;
        unchanged: number;
        unmapped: number;
        duplicates: number;
        invalid: number;
      };
      blocked: boolean;
      applyAllowed: boolean;
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Validation failed"));
  }
}

export async function applyErpExcelImport(id: string) {
  try {
    const response = await apiClient.post(`/inventory/erp-import/${id}/apply`, { confirmed: true });
    return response.data.data as {
      run: ErpExcelImportRun;
      preview: ErpExcelPreviewRow[];
      reused: boolean;
      message: string;
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Apply failed"));
  }
}

export async function fetchErpExcelImportHistory() {
  try {
    const response = await apiClient.get("/inventory/erp-import/history");
    return response.data.data as { items: ErpExcelImportRun[] };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to load import history"));
  }
}

export async function fetchErpExcelImportRun(id: string) {
  try {
    const response = await apiClient.get(`/inventory/erp-import/${id}`);
    return response.data.data as { run: ErpExcelImportRun; preview: ErpExcelPreviewRow[] };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to load import run"));
  }
}
