export type ErpConnectionStatus = {
  connected: boolean;
  mode: string;
  provider: string;
  message: string;
  lastTestedAt?: string | null;
};

export type ErpConnectorResult<T = unknown> = {
  entity: string;
  count: number;
  records: T[];
  readOnly: boolean;
};

export interface ErpConnector {
  getConnectionStatus(): Promise<ErpConnectionStatus>;
  fetchEmployees(): Promise<ErpConnectorResult>;
  fetchVendors(): Promise<ErpConnectorResult>;
  fetchItems(): Promise<ErpConnectorResult>;
  fetchStockBalances(): Promise<ErpConnectorResult>;
  fetchAssets(): Promise<ErpConnectorResult>;
  fetchVehicles(): Promise<ErpConnectorResult>;
  fetchPurchaseOrders(): Promise<ErpConnectorResult>;
  fetchInvoices(): Promise<ErpConnectorResult>;
  pushWorkOrderCost(): Promise<{ accepted: boolean; message: string }>;
  pushPartsIssue(): Promise<{ accepted: boolean; message: string }>;
  pushVendorRepairStatus(): Promise<{ accepted: boolean; message: string }>;
}
