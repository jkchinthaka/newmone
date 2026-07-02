import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  RoleName,
  VendorApprovalLevel,
  VendorInvoiceStatus,
  VendorQuotationStatus,
  VendorRepairStatus,
  WorkOrderStatus,
  WorkOrderVerificationStatus
} from "@prisma/client";

import { calculateWorkOrderRiskScore } from "../src/common/utils/maintenance-risk-score";
import {
  assertInvoiceAttachment,
  assertInvoiceWithinQuotation,
  assertPositiveAmount,
  assertQuotationRequired,
  assertSupervisorVerifiedForInvoice,
  calculateCostVariance,
  isHighCostVendorRepair,
  resolveVendorApprovalLevel,
  roleCanApproveVendorLevel,
  roleCanFinanceApprove
} from "../src/common/utils/vendor-repair-governance";

describe("vendor repair governance", () => {
  it("requires positive quotation amount", () => {
    expect(() => assertPositiveAmount("Quotation amount", 0)).toThrow(
      new BadRequestException("Quotation amount must be greater than 0.")
    );
  });

  it("requires positive invoice amount", () => {
    expect(() => assertPositiveAmount("Invoice amount", -1)).toThrow(
      new BadRequestException("Invoice amount must be greater than 0.")
    );
  });

  it("blocks vendor authorization without approved quotation", () => {
    expect(() =>
      assertQuotationRequired(VendorRepairStatus.QUOTATION_REQUIRED, false, false, undefined)
    ).toThrow(new BadRequestException("Quotation is required before vendor authorization."));
  });

  it("allows emergency override without approved quotation when reason provided", () => {
    expect(() =>
      assertQuotationRequired(VendorRepairStatus.EMERGENCY_VENDOR_REPAIR, false, true, "Breakdown on highway")
    ).not.toThrow();
  });

  it("blocks invoice approval before supervisor verification", () => {
    expect(() =>
      assertSupervisorVerifiedForInvoice({
        workOrderStatus: WorkOrderStatus.IN_PROGRESS,
        verificationStatus: WorkOrderVerificationStatus.PENDING,
        vendorRepairStatus: VendorRepairStatus.VENDOR_COMPLETED
      })
    ).toThrow(new BadRequestException("Invoice cannot be approved before supervisor verification."));
  });

  it("requires invoice attachment for finance approval", () => {
    expect(() => assertInvoiceAttachment(null)).toThrow(
      new BadRequestException("Invoice attachment is required.")
    );
  });

  it("blocks invoice exceeding quotation without reason", () => {
    expect(() => assertInvoiceWithinQuotation(120_000, 100_000, undefined)).toThrow(
      new BadRequestException("Invoice amount exceeds approved quotation.")
    );
  });

  it("resolves approval levels by amount thresholds", () => {
    expect(resolveVendorApprovalLevel(5_000)).toBe(VendorApprovalLevel.SUPERVISOR);
    expect(resolveVendorApprovalLevel(25_000)).toBe(VendorApprovalLevel.MANAGER);
    expect(resolveVendorApprovalLevel(100_000)).toBe(VendorApprovalLevel.OPERATIONS);
    expect(resolveVendorApprovalLevel(300_000)).toBe(VendorApprovalLevel.FINANCE);
  });

  it("restricts technician from approving quotations", () => {
    expect(roleCanApproveVendorLevel(RoleName.TECHNICIAN, VendorApprovalLevel.SUPERVISOR)).toBe(false);
    expect(roleCanFinanceApprove(RoleName.TECHNICIAN)).toBe(false);
  });

  it("allows manager finance approval", () => {
    expect(roleCanFinanceApprove(RoleName.MANAGER)).toBe(true);
  });

  it("calculates vendor cost variance", () => {
    const summary = calculateCostVariance(100_000, 125_000);
    expect(summary.varianceAmount).toBe(25_000);
    expect(summary.variancePercentage).toBe(25);
  });

  it("flags high-cost vendor repair", () => {
    expect(isHighCostVendorRepair(75_000)).toBe(true);
    expect(isHighCostVendorRepair(5_000)).toBe(false);
  });

  it("adds vendor risk score factors without breaking existing scoring", () => {
    const base = calculateWorkOrderRiskScore({ overdue: true });
    const withVendor = calculateWorkOrderRiskScore({
      overdue: true,
      invoiceExceedsQuotation: true,
      vendorRepairWithoutQuotation: true
    });
    expect(withVendor).toBe(base + 40);
  });
});
