import { Injectable } from "@nestjs/common";
import { EmployeeAvailabilityStatus, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { matchesWorkforceDesignation } from "../../common/utils/workforce-designation";
import { PrismaService } from "../../database/prisma.service";
import { WorkforcePlanningService } from "../workforce/workforce-planning.service";

@Injectable()
export class TechniciansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workforcePlanning: WorkforcePlanningService
  ) {}

  private tenantIdFromContext(): string | null {
    const ctx = requestContext.get();
    if (ctx?.actorRole === RoleName.SUPER_ADMIN) return ctx.tenantId ?? null;
    return ctx?.tenantId ?? null;
  }

  async listAssignable(tenantId: string | null | undefined, designation?: string) {
    const scopedTenant = tenantId ?? this.tenantIdFromContext();
    const rows = await this.prisma.employee.findMany({
      where: {
        active: true,
        canReceiveWorkOrders: true,
        availabilityStatus: EmployeeAvailabilityStatus.AVAILABLE,
        ...(scopedTenant !== undefined && scopedTenant !== null ? { tenantId: scopedTenant } : {})
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        designation: true,
        skills: true,
        workCategories: true,
        dailyCapacityHours: true,
        departmentId: true,
        branchName: true,
        canLogin: true,
        linkedUserId: true,
        availabilityStatus: true,
        canReceiveWorkOrders: true,
        department: { select: { id: true, name: true, code: true } },
        linkedUser: { select: { id: true, isActive: true, role: { select: { name: true } } } }
      },
      orderBy: [{ designation: "asc" }, { fullName: "asc" }]
    });

    const eligible = rows.filter((row) => {
      if (!row.linkedUserId) return true;
      return row.linkedUser?.isActive !== false;
    });

    const enriched = await Promise.all(
      eligible.map(async (row) => {
        const todayAllocatedHours = await this.workforcePlanning.getAllocatedHoursForDay({
          tenantId: scopedTenant,
          employeeId: row.id,
          day: new Date()
        });
        const capacity = row.dailyCapacityHours ?? 8;
        const workloadPercentage = Math.min(100, Math.round((todayAllocatedHours / capacity) * 100));

        return {
          id: row.id,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          designation: row.designation,
          skills: row.skills,
          workCategories: row.workCategories,
          dailyCapacityHours: row.dailyCapacityHours,
          departmentId: row.departmentId,
          branchName: row.branchName,
          canLogin: row.canLogin,
          linkedUserId: row.linkedUserId,
          availabilityStatus: row.availabilityStatus,
          canReceiveWorkOrders: row.canReceiveWorkOrders,
          department: row.department,
          roleName: row.linkedUser?.role.name ?? null,
          todayAllocatedHours,
          workloadPercentage,
          availabilityLabel:
            workloadPercentage >= 90 ? "High load" : workloadPercentage >= 70 ? "Busy" : "Available"
        };
      })
    );

    return enriched.filter((row) => matchesWorkforceDesignation({ designation: row.designation }, designation));
  }

  async listAll(
    tenantId: string | null | undefined,
    filters: { search?: string; branchName?: string; departmentId?: string; page?: number; pageSize?: number } = {}
  ) {
    const scopedTenant = tenantId ?? this.tenantIdFromContext();
    const page = filters.page ?? 1;
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
    const skip = (page - 1) * pageSize;
    const q = filters.search?.trim();

    const andClauses: Record<string, unknown>[] = [
      ...(scopedTenant ? [{ tenantId: scopedTenant }] : []),
      ...(filters.branchName?.trim()
        ? [{ branchName: { equals: filters.branchName.trim(), mode: "insensitive" } }]
        : []),
      ...(filters.departmentId?.trim() ? [{ departmentId: filters.departmentId.trim() }] : []),
      ...(q
        ? [
            {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { employeeNo: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } }
              ]
            }
          ]
        : []),
      {
        OR: [
          { designation: { contains: "TECHNICIAN", mode: "insensitive" } },
          { designation: { contains: "MECHANIC", mode: "insensitive" } },
          { canReceiveWorkOrders: true }
        ]
      }
    ];

    const where = { AND: andClauses };

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: {
          department: { select: { id: true, name: true, code: true } },
          linkedUser: { select: { id: true, email: true, isActive: true, role: { select: { name: true } } } }
        },
        orderBy: [{ active: "desc" }, { fullName: "asc" }],
        skip,
        take: pageSize
      }),
      this.prisma.employee.count({ where })
    ]);

    return { items, total, page, pageSize };
  }
}
