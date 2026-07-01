export type VendorRepairStatus =
  | "INTERNAL_REVIEW"
  | "VENDOR_REPAIR_REQUESTED"
  | "QUOTATION_REQUIRED"
  | "QUOTATION_SUBMITTED"
  | "QUOTATION_APPROVED"
  | "VENDOR_WORK_AUTHORIZED"
  | "SENT_TO_VENDOR"
  | "VENDOR_IN_PROGRESS"
  | "VENDOR_COMPLETED"
  | "SUPERVISOR_VERIFIED"
  | "INVOICE_SUBMITTED"
  | "FINANCE_REVIEW"
  | "FINANCE_APPROVED"
  | "EMERGENCY_VENDOR_REPAIR"
  | "MANAGER_OVERRIDE_REQUIRED"
  | "CLOSED"
  | "CANCELLED";

export type VendorQuotationStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXPIRED";
export type VendorInvoiceStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";

export type VendorSupplier = {
  id: string;
  name: string;
  vendorCode?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  blacklisted?: boolean;
  blacklistReason?: string | null;
  isActive?: boolean;
};

export type VendorQuotation = {
  id: string;
  quotationNo: string;
  quotationDate: string;
  quotedAmount: number;
  currency: string;
  status: VendorQuotationStatus;
  rejectionReason?: string | null;
  approvalNote?: string | null;
};

export type VendorInvoice = {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: VendorInvoiceStatus;
  rejectionReason?: string | null;
  financeNote?: string | null;
};

export type VendorRepairCase = {
  id: string;
  status: VendorRepairStatus;
  externalRepairReason?: string | null;
  emergencyOverride?: boolean;
  emergencyOverrideReason?: string | null;
  supplier?: VendorSupplier | null;
  quotations: VendorQuotation[];
  invoices: VendorInvoice[];
};

export type VendorRepairCostSummary = {
  approvedQuotationTotal: number;
  invoiceTotal: number;
  varianceAmount: number;
  variancePercentage: number;
  partsCost: number;
  laborCost: number;
  totalMaintenanceCost: number;
};

export type VendorRepairResponse = {
  workOrderId: string;
  workOrderStatus: string;
  verificationStatus: string;
  vendorCase: VendorRepairCase | null;
  costSummary: VendorRepairCostSummary;
};

const REQUEST_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR"]);
const FINANCE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"]);
const APPROVE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR"]);

export function canRequestVendorRepair(role?: string | null) {
  return Boolean(role && REQUEST_ROLES.has(role));
}

export function canApproveVendorQuotation(role?: string | null) {
  return Boolean(role && APPROVE_ROLES.has(role));
}

export function canFinanceApproveVendorInvoice(role?: string | null) {
  return Boolean(role && FINANCE_ROLES.has(role));
}

export function canUploadVendorEvidence(role?: string | null) {
  return Boolean(role && role !== "VIEWER" && role !== "DRIVER");
}

export function vendorStatusLabel(status?: string | null) {
  if (!status) return "Not started";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCurrency(amount: number, currency = "LKR") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}
