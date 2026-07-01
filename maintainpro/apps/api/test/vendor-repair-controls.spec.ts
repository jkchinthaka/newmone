import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RoleName, VendorInvoiceStatus, VendorQuotationStatus, VendorRepairStatus, WorkOrderVerificationStatus } from "@prisma/client";

import { VendorRepairService } from "../src/modules/work-orders/vendor-repair.service";

describe("vendor repair controls", () => {
  const actor = { sub: "user-1", email: "supervisor@test.com", role: RoleName.SUPERVISOR, tenantId: "tenant-1" };
  const financeActor = { sub: "user-2", email: "manager@test.com", role: RoleName.MANAGER, tenantId: "tenant-1" };
  const technician = { sub: "tech-1", email: "tech@test.com", role: RoleName.TECHNICIAN, tenantId: "tenant-1" };

  function buildService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          tenantId: "tenant-1",
          status: "IN_PROGRESS",
          verificationStatus: WorkOrderVerificationStatus.PENDING,
          actualCost: 0
        })
      },
      supplier: {
        findFirst: jest.fn().mockResolvedValue({
          id: "vendor-1",
          isActive: true,
          blacklisted: false
        })
      },
      vendorRepairCase: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn()
      },
      vendorQuotation: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1)
      },
      vendorInvoice: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      workOrderPart: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalCost: 0 } })
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" })
      },
      ...overrides
    };

    return { service: new VendorRepairService(prisma as never), prisma };
  }

  it("requires reason when requesting vendor repair", async () => {
    const { service } = buildService();
    await expect(service.requestVendorRepair("wo-1", { externalRepairReason: "  " }, actor)).rejects.toThrow(
      new BadRequestException("Vendor repair request requires a reason.")
    );
  });

  it("blocks blacklisted vendor without override", async () => {
    const { service, prisma } = buildService({
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: "vendor-1", isActive: true, blacklisted: true })
      }
    });
    await expect(
      service.requestVendorRepair("wo-1", { externalRepairReason: "Engine failure", supplierId: "vendor-1" }, actor)
    ).rejects.toThrow(new BadRequestException("Blacklisted vendor cannot be selected."));
    expect(prisma.vendorRepairCase.upsert).not.toHaveBeenCalled();
  });

  it("requires emergency override reason", async () => {
    const { service } = buildService();
    await expect(
      service.requestVendorRepair("wo-1", { externalRepairReason: "Urgent", isEmergency: true }, actor)
    ).rejects.toThrow(new BadRequestException("Emergency vendor repair requires override reason."));
  });

  it("blocks technician from approving invoice", async () => {
    const { service, prisma } = buildService({
      vendorRepairCase: {
        findUnique: jest.fn().mockResolvedValue({
          id: "case-1",
          tenantId: "tenant-1",
          status: VendorRepairStatus.INVOICE_SUBMITTED
        })
      },
      vendorInvoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: "inv-1",
          totalAmount: 10_000,
          evidenceAttachmentId: "evidence-1",
          submittedById: "user-3"
        }),
        update: jest.fn(),
        create: jest.fn()
      }
    });

    await expect(service.approveInvoice("wo-1", "inv-1", undefined, technician)).rejects.toThrow(ForbiddenException);
    expect(prisma.vendorInvoice.update).not.toHaveBeenCalled();
  });

  it("blocks duplicate vendor invoice numbers", async () => {
    const { service, prisma } = buildService({
      vendorRepairCase: {
        findUnique: jest.fn().mockResolvedValue({ id: "case-1", tenantId: "tenant-1", approvedQuotationAmount: 50_000 })
      },
      vendorInvoice: {
        findFirst: jest.fn().mockResolvedValue({ id: "existing" }),
        create: jest.fn(),
        update: jest.fn()
      }
    });

    await expect(
      service.submitInvoice(
        "wo-1",
        {
          supplierId: "vendor-1",
          invoiceNo: "INV-001",
          invoiceDate: new Date().toISOString(),
          invoiceAmount: 10_000
        },
        actor
      )
    ).rejects.toThrow(new BadRequestException("Duplicate vendor invoice detected."));
    expect(prisma.vendorInvoice.create).not.toHaveBeenCalled();
  });

  it("blocks vendor authorization without approved quotation", async () => {
    const { service } = buildService({
      vendorRepairCase: {
        findUnique: jest.fn().mockResolvedValue({
          id: "case-1",
          tenantId: "tenant-1",
          status: VendorRepairStatus.QUOTATION_REQUIRED,
          emergencyOverride: false
        })
      },
      vendorQuotation: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    });

    await expect(service.authorizeVendorWork("wo-1", undefined, actor)).rejects.toThrow(
      new BadRequestException("Quotation is required before vendor authorization.")
    );
  });

  it("writes audit event when quotation is approved", async () => {
    const vendorCasePayload = {
      id: "case-1",
      tenantId: "tenant-1",
      workOrderId: "wo-1",
      quotations: [],
      invoices: [],
      supplier: null
    };
    const { service, prisma } = buildService({
      vendorQuotation: {
        findFirst: jest.fn().mockResolvedValue({
          id: "q-1",
          vendorRepairCaseId: "case-1",
          quotedAmount: 8_000,
          requiredApprovalLevel: null,
          submittedById: "user-3"
        }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0)
      },
      vendorRepairCase: {
        findUnique: jest.fn().mockResolvedValue(vendorCasePayload),
        update: jest.fn()
      }
    });

    await service.approveQuotation("wo-1", "q-1", "Approved", financeActor);
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.vendorQuotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: VendorQuotationStatus.APPROVED })
      })
    );
  });
});
