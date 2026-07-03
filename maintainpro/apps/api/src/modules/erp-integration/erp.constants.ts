export type ErpReadinessVerdict =
  | "NOT_READY"
  | "WAITING_FOR_BILEETA"
  | "READY_FOR_TEST_API"
  | "READY_FOR_LIVE_API";

export const ERP_LIVE_NOT_CONFIGURED_MESSAGE =
  "ERP live integration is not configured. Please configure approved ERP API credentials first.";

export const DEFAULT_FIELD_MAPPINGS = [
  { sourceField: "employeeCode", targetModel: "Employee", targetField: "employeeNo", required: true },
  { sourceField: "name", targetModel: "Employee", targetField: "fullName", required: true },
  { sourceField: "department", targetModel: "Employee", targetField: "departmentId", required: false },
  { sourceField: "branch", targetModel: "Employee", targetField: "branchId", required: false },
  { sourceField: "designation", targetModel: "Employee", targetField: "designation", required: false },
  { sourceField: "vendorCode", targetModel: "Supplier", targetField: "vendorCode", required: true },
  { sourceField: "vendorName", targetModel: "Supplier", targetField: "vendorName", required: true },
  { sourceField: "contact", targetModel: "Supplier", targetField: "contactDetails", required: false },
  { sourceField: "itemCode", targetModel: "SparePart", targetField: "itemCode", required: true },
  { sourceField: "itemName", targetModel: "SparePart", targetField: "itemName", required: true },
  { sourceField: "unit", targetModel: "SparePart", targetField: "unit", required: false },
  { sourceField: "stockBalance", targetModel: "SparePart", targetField: "quantity", required: false },
  { sourceField: "warehouse", targetModel: "SparePart", targetField: "warehouse", required: false },
  { sourceField: "assetCode", targetModel: "Asset", targetField: "assetCode", required: true },
  { sourceField: "vehicleNo", targetModel: "Vehicle", targetField: "vehicleNo", required: true },
  { sourceField: "invoiceNo", targetModel: "VendorInvoice", targetField: "invoiceNo", required: true },
  { sourceField: "amount", targetModel: "VendorInvoice", targetField: "amount", required: true },
  { sourceField: "paymentStatus", targetModel: "VendorInvoice", targetField: "paymentStatus", required: false }
] as const;

export const ERP_ACCESS_CHECKLIST = [
  { itemKey: "bileeta.approval", title: "Bileeta approval received" },
  { itemKey: "bileeta.api_docs", title: "API documentation received" },
  { itemKey: "bileeta.base_url", title: "API base URL received" },
  { itemKey: "bileeta.auth_method", title: "Authentication method confirmed" },
  { itemKey: "bileeta.api_user", title: "API user created" },
  { itemKey: "bileeta.permissions", title: "API permissions confirmed" },
  { itemKey: "bileeta.test_env", title: "Test environment access received" },
  { itemKey: "bileeta.prod_env", title: "Production environment access approved" },
  { itemKey: "bileeta.ip_allowlist", title: "IP allowlist completed if required" },
  { itemKey: "bileeta.rate_limits", title: "Rate limits confirmed" },
  { itemKey: "bileeta.data_fields", title: "Data fields confirmed" },
  { itemKey: "bileeta.error_format", title: "Error response format confirmed" },
  { itemKey: "bileeta.sync_frequency", title: "Sync frequency approved" },
  { itemKey: "bileeta.rollback", title: "Rollback process approved" },
  { itemKey: "bileeta.security_review", title: "Security review completed" }
] as const;

export const MOCK_ERP_SAMPLE = {
  employees: [{ employeeCode: "EMP-001", name: "Sample Employee", department: "Maintenance" }],
  vendors: [{ vendorCode: "VND-001", vendorName: "Sample Vendor Ltd" }],
  items: [{ itemCode: "SP-001", itemName: "Sample Spare Part", unit: "EA", stockBalance: 10 }],
  stockBalances: [{ itemCode: "SP-001", warehouse: "MAIN", quantity: 10 }],
  assets: [{ assetCode: "AST-001", department: "Operations" }],
  vehicles: [{ vehicleNo: "ABC-1234", department: "Fleet" }],
  purchaseOrders: [{ poNumber: "PO-001", vendorCode: "VND-001", totalAmount: 1500 }],
  invoices: [{ invoiceNo: "INV-001", vendorCode: "VND-001", amount: 1500, status: "PENDING" }]
};
