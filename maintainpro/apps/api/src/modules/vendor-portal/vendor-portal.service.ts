import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

@Injectable()
export class VendorPortalService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveSupplierIds(actor: Actor): Promise<string[]> {
    const tenantId = requireTenantId(actor.tenantId);
    const links = await this.prisma.vendorPortalAccess.findMany({
      where: { tenantId, userId: actor.sub, active: true },
      select: { supplierId: true }
    });
    return links.map((l) => l.supplierId);
  }

  async grantAccess(actor: Actor, input: { supplierId: string; userId: string }) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.vendorPortalAccess.upsert({
      where: {
        tenantId_supplierId_userId: {
          tenantId,
          supplierId: input.supplierId,
          userId: input.userId
        }
      },
      create: {
        tenantId,
        supplierId: input.supplierId,
        userId: input.userId,
        active: true
      },
      update: { active: true }
    });
  }

  async listAssignedJobs(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const supplierIds = await this.resolveSupplierIds(actor);
    if (supplierIds.length === 0) {
      throw new ForbiddenException("No vendor portal access for this user");
    }

    const cases = await this.prisma.vendorRepairCase.findMany({
      where: { tenantId, supplierId: { in: supplierIds } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        workOrderId: true,
        status: true,
        supplierId: true,
        requestedAt: true,
        vendorCompletedAt: true,
        workOrder: {
          select: {
            id: true,
            woNumber: true,
            title: true,
            status: true,
            priority: true,
            description: true
          }
        },
        quotations: {
          select: {
            id: true,
            quotationNo: true,
            quotedAmount: true,
            status: true,
            currency: true
          }
        }
      }
    });

    // Never expose internal confidential fields (cost rates, internal notes)
    return cases.map((c) => ({
      id: c.id,
      supplierId: c.supplierId,
      status: c.status,
      requestedAt: c.requestedAt,
      vendorCompletedAt: c.vendorCompletedAt,
      workOrder: c.workOrder
        ? {
            id: c.workOrder.id,
            number: c.workOrder.woNumber,
            title: c.workOrder.title,
            status: c.workOrder.status,
            priority: c.workOrder.priority,
            problem: c.workOrder.description
          }
        : null,
      quotations: c.quotations
    }));
  }

  async getAssignedJob(actor: Actor, caseId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const supplierIds = await this.resolveSupplierIds(actor);
    const item = await this.prisma.vendorRepairCase.findFirst({
      where: { id: caseId, tenantId, supplierId: { in: supplierIds } },
      include: {
        workOrder: { select: { id: true, woNumber: true, title: true, status: true, description: true } },
        quotations: true
      }
    });
    if (!item) throw new NotFoundException("Assigned job not found");
    return item;
  }

  async uploadQuotation(
    actor: Actor,
    caseId: string,
    input: { quotationNo: string; quotedAmount: number; currency?: string; validityDate?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const supplierIds = await this.resolveSupplierIds(actor);
    const repairCase = await this.prisma.vendorRepairCase.findFirst({
      where: { id: caseId, tenantId, supplierId: { in: supplierIds } }
    });
    if (!repairCase) throw new NotFoundException("Assigned job not found");
    if (!repairCase.supplierId) throw new BadRequestException("Case has no supplier");
    if (!input.quotationNo?.trim()) throw new BadRequestException("quotationNo required");

    return this.prisma.vendorQuotation.create({
      data: {
        tenantId,
        vendorRepairCaseId: caseId,
        workOrderId: repairCase.workOrderId,
        supplierId: repairCase.supplierId,
        quotationNo: input.quotationNo.trim(),
        quotationDate: new Date(),
        quotedAmount: input.quotedAmount,
        currency: input.currency ?? "LKR",
        validityDate: input.validityDate ? new Date(input.validityDate) : null,
        status: "SUBMITTED",
        submittedById: actor.sub,
        submittedAt: new Date()
      }
    });
  }

  async updateProgress(actor: Actor, caseId: string, input: { status: string; note?: string }) {
    const tenantId = requireTenantId(actor.tenantId);
    const supplierIds = await this.resolveSupplierIds(actor);
    const repairCase = await this.prisma.vendorRepairCase.findFirst({
      where: { id: caseId, tenantId, supplierId: { in: supplierIds } }
    });
    if (!repairCase) throw new NotFoundException("Assigned job not found");

    const allowed = ["IN_VENDOR_REPAIR", "VENDOR_COMPLETED", "AWAITING_PARTS"];
    const status = input.status.toUpperCase();
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Vendor may only set: ${allowed.join(", ")}`);
    }

    return this.prisma.vendorRepairCase.update({
      where: { id: caseId },
      data: {
        status,
        ...(status === "VENDOR_COMPLETED" ? { vendorCompletedAt: new Date() } : {})
      }
    });
  }
}
