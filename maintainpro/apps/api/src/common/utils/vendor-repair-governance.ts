import { BadRequestException } from "@nestjs/common";
import { RoleName, VendorApprovalLevel, VendorInvoiceStatus, VendorQuotationStatus, VendorRepairStatus, WorkOrderStatus, WorkOrderVerificationStatus } from "@prisma/client";

export const VENDOR_APPROVAL_SUPERVISOR_MAX = Number(process.env.VENDOR_APPROVAL_SUPERVISOR_MAX ?? 10_000);
export const VENDOR_APPROVAL_MANAGER_MAX = Number(process.env.VENDOR_APPROVAL_MANAGER_MAX ?? 50_000);
export const VENDOR_APPROVAL_OPERATIONS_MAX = Number(process.env.VENDOR_APPROVAL_OPERATIONS_MAX ?? 250_000);
export const VENDOR_HIGH_COST_QUOTATIONS_REQUIRED = Number(process.env.VENDOR_HIGH_COST_QUOTATIONS_REQUIRED ?? 2);

export function resolveVendorApprovalLevel(amount: number): VendorApprovalLevel {
  if (amount > VENDOR_APPROVAL_OPERATIONS_MAX) {
    return VendorApprovalLevel.FINANCE;
  }
  if (amount > VENDOR_APPROVAL_MANAGER_MAX) {
    return VendorApprovalLevel.OPERATIONS;
  }
  if (amount > VENDOR_APPROVAL_SUPERVISOR_MAX) {
    return VendorApprovalLevel.MANAGER;
  }
  return VendorApprovalLevel.SUPERVISOR;
}

export function roleCanApproveVendorLevel(role: RoleName | string | undefined, level: VendorApprovalLevel): boolean {
  const r = role as RoleName;
  if (r === RoleName.SUPER_ADMIN || r === RoleName.ADMIN) return true;
  switch (level) {
    case VendorApprovalLevel.SUPERVISOR:
      return ([RoleName.SUPERVISOR, RoleName.MANAGER, RoleName.OPERATIONS_MANAGER, RoleName.ASSET_MANAGER] as RoleName[]).includes(r);
    case VendorApprovalLevel.MANAGER:
      return ([RoleName.MANAGER, RoleName.OPERATIONS_MANAGER, RoleName.ASSET_MANAGER] as RoleName[]).includes(r);
    case VendorApprovalLevel.OPERATIONS:
      return r === RoleName.OPERATIONS_MANAGER || r === RoleName.MANAGER;
    case VendorApprovalLevel.FINANCE:
      return r === RoleName.MANAGER || r === RoleName.OPERATIONS_MANAGER;
    default:
      return false;
  }
}

export function roleCanFinanceApprove(role: RoleName | string | undefined): boolean {
  const r = role as RoleName;
  return ([RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGER, RoleName.OPERATIONS_MANAGER] as RoleName[]).includes(r);
}

export function assertPositiveAmount(label: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestException(`${label} must be greater than 0.`);
  }
}

export function assertQuotationRequired(status: VendorRepairStatus, hasApprovedQuotation: boolean, emergencyOverride: boolean, overrideReason?: string) {
  if (hasApprovedQuotation || emergencyOverride) return;
  if (!overrideReason?.trim()) {
    throw new BadRequestException("Quotation is required before vendor authorization.");
  }
  const authorizedWithoutQuotation: VendorRepairStatus[] = [
    VendorRepairStatus.QUOTATION_APPROVED,
    VendorRepairStatus.EMERGENCY_VENDOR_REPAIR,
    VendorRepairStatus.MANAGER_OVERRIDE_REQUIRED
  ];
  if (!authorizedWithoutQuotation.includes(status)) {
    throw new BadRequestException("Quotation is required before vendor authorization.");
  }
}

export function assertSupervisorVerifiedForInvoice(input: {
  workOrderStatus: WorkOrderStatus;
  verificationStatus: WorkOrderVerificationStatus;
  vendorRepairStatus: VendorRepairStatus;
}) {
  const supervisorOk =
    input.verificationStatus === WorkOrderVerificationStatus.VERIFIED ||
    input.vendorRepairStatus === VendorRepairStatus.SUPERVISOR_VERIFIED ||
    input.workOrderStatus === WorkOrderStatus.COMPLETED;
  if (!supervisorOk) {
    throw new BadRequestException("Invoice cannot be approved before supervisor verification.");
  }
}

export function assertInvoiceAttachment(evidenceAttachmentId?: string | null) {
  if (!evidenceAttachmentId?.trim()) {
    throw new BadRequestException("Invoice attachment is required.");
  }
}

export function calculateCostVariance(approvedQuotation: number | null | undefined, invoiceTotal: number) {
  const approved = approvedQuotation ?? 0;
  const varianceAmount = invoiceTotal - approved;
  const variancePercentage = approved > 0 ? (varianceAmount / approved) * 100 : invoiceTotal > 0 ? 100 : 0;
  return { approvedQuotationTotal: approved, invoiceTotal, varianceAmount, variancePercentage };
}

export function assertInvoiceWithinQuotation(invoiceTotal: number, approvedQuotation: number | null | undefined, reason?: string) {
  if (!approvedQuotation || invoiceTotal <= approvedQuotation) return;
  if (!reason?.trim()) {
    throw new BadRequestException("Invoice amount exceeds approved quotation.");
  }
}

export const VENDOR_REPAIR_TERMINAL_STATUSES = new Set<VendorRepairStatus>([
  VendorRepairStatus.CLOSED,
  VendorRepairStatus.CANCELLED
]);

export function isHighCostVendorRepair(amount: number): boolean {
  return amount > VENDOR_APPROVAL_MANAGER_MAX;
}

export function quotationIsApproved(status: VendorQuotationStatus): boolean {
  return status === VendorQuotationStatus.APPROVED;
}

export function invoiceIsFinanceApproved(status: VendorInvoiceStatus): boolean {
  return status === VendorInvoiceStatus.APPROVED || status === VendorInvoiceStatus.PAID;
}
