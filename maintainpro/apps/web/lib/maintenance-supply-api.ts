import { apiClient } from "./api-client";

export type SparePartMappingRow = {
  id: string;
  partNumber: string;
  name: string;
  classification: string;
  erpCode?: string | null;
  maintenanceAlias?: string | null;
  criticalSpare?: boolean;
  referenceStock?: number | null;
  mapped: boolean;
  stockBoundary?: { source: string; message: string };
};

export type OutstandingToolRow = {
  id: string;
  quantity: number;
  quantityReturned: number;
  outstandingQuantity: number;
  workOrderId: string;
  part?: { partNumber: string; name: string; classification: string };
};

export async function listSparePartsMapping() {
  const response = await apiClient.get("/maintenance-supply/parts");
  return (response.data as { data: SparePartMappingRow[] }).data;
}

export async function listOutstandingTools() {
  const response = await apiClient.get("/maintenance-supply/outstanding-tools");
  return (response.data as { data: OutstandingToolRow[] }).data;
}

export async function mapErpItem(partId: string, erpCode: string) {
  const response = await apiClient.post("/maintenance-supply/map-erp-item", { partId, erpCode });
  return (response.data as { data: unknown }).data;
}
