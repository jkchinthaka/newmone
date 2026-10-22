import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { assertTenantEntityExists, requireTenantId } from "../../../common/utils/tenant-scope.util";
import { PrismaService } from "../../../database/prisma.service";
import { FarmCacheService } from "../farm-cache.service";

interface AuthedRequest {
  user?: { sub: string; role: string; tenantId?: string | null };
}

const FINANCE_SUMMARY_TTL_MS = 5 * 60 * 1000; // 5m

@Injectable()
export class FarmFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: FarmCacheService
  ) {}

  private async validateFinanceRelations(
    tenantId: string,
    data: { cropCycleId?: unknown; fieldId?: unknown }
  ) {
    if (typeof data.cropCycleId === "string" && data.cropCycleId) {
      await assertTenantEntityExists(this.prisma.cropCycle, data.cropCycleId, { tenantId, entityName: "Crop cycle" });
    }
    if (typeof data.fieldId === "string" && data.fieldId) {
      await assertTenantEntityExists(this.prisma.field, data.fieldId, { tenantId, entityName: "Field" });
    }
  }

  listExpenses(tenantId: string | null, category?: string, from?: string, to?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.farmExpense.findMany({
      where: {
        tenantId: scopedTenantId,
        category: category as never,
        date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined
      },
      orderBy: { date: "desc" }
    });
  }

  async createExpense(tenantId: string | null, data: Prisma.FarmExpenseUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await this.validateFinanceRelations(scopedTenantId, data);
    this.cache.invalidate(`finance:summary:${scopedTenantId}`);
    return this.prisma.farmExpense.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async updateExpense(id: string, tenantId: string | null, data: Prisma.FarmExpenseUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.farmExpense, id, { tenantId: scopedTenantId, entityName: "Expense" });
    await this.validateFinanceRelations(scopedTenantId, data as { cropCycleId?: unknown; fieldId?: unknown });
    this.cache.invalidate(`finance:summary:${scopedTenantId}`);
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.farmExpense.update({ where: { id }, data: safe as Prisma.FarmExpenseUncheckedUpdateInput });
  }

  async removeExpense(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.farmExpense, id, { tenantId: scopedTenantId, entityName: "Expense" });
    this.cache.invalidate(`finance:summary:${scopedTenantId}`);
    return this.prisma.farmExpense.delete({ where: { id } });
  }

  listIncome(tenantId: string | null, source?: string, from?: string, to?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.farmIncome.findMany({
      where: {
        tenantId: scopedTenantId,
        source: source as never,
        date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined
      },
      orderBy: { date: "desc" }
    });
  }

  async createIncome(tenantId: string | null, data: Prisma.FarmIncomeUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await this.validateFinanceRelations(scopedTenantId, data);
    this.cache.invalidate(`finance:summary:${scopedTenantId}`);
    return this.prisma.farmIncome.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async updateIncome(id: string, tenantId: string | null, data: Prisma.FarmIncomeUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.farmIncome, id, { tenantId: scopedTenantId, entityName: "Income" });
    await this.validateFinanceRelations(scopedTenantId, data as { cropCycleId?: unknown; fieldId?: unknown });
    this.cache.invalidate(`finance:summary:${scopedTenantId}`);
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.farmIncome.update({ where: { id }, data: safe as Prisma.FarmIncomeUncheckedUpdateInput });
  }

  async removeIncome(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.farmIncome, id, { tenantId: scopedTenantId, entityName: "Income" });
    this.cache.invalidate(`finance:summary:${scopedTenantId}`);
    return this.prisma.farmIncome.delete({ where: { id } });
  }

  async summary(tenantId: string | null, from?: string, to?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.cache.wrap(`finance:summary:${scopedTenantId}:${from ?? "_"}:${to ?? "_"}`, FINANCE_SUMMARY_TTL_MS, async () => {
      const dateFilter = from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined;
      const [expenses, income] = await Promise.all([
        this.prisma.farmExpense.findMany({ where: { tenantId: scopedTenantId, date: dateFilter }, select: { amountLkr: true, category: true } }),
        this.prisma.farmIncome.findMany({ where: { tenantId: scopedTenantId, date: dateFilter }, select: { totalLkr: true, source: true } })
      ]);
      const totalExpense = expenses.reduce((s, e) => s + (e.amountLkr ?? 0), 0);
      const totalIncome = income.reduce((s, i) => s + (i.totalLkr ?? 0), 0);
      const expenseByCategory: Record<string, number> = {};
      for (const e of expenses) expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + (e.amountLkr ?? 0);
      const incomeBySource: Record<string, number> = {};
      for (const i of income) incomeBySource[i.source] = (incomeBySource[i.source] ?? 0) + (i.totalLkr ?? 0);
      return {
        totalExpense,
        totalIncome,
        netProfit: totalIncome - totalExpense,
        expenseByCategory,
        incomeBySource
      };
    });
  }
}

@ApiTags("Farm / Finance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/finance")
export class FarmFinanceController {
  constructor(private readonly service: FarmFinanceService) {}

  @Get("summary")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VIEWER")
  async summary(
    @Req() req: AuthedRequest,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.service.summary(req.user?.tenantId ?? null, from, to);
    return { data, message: "Finance summary fetched" };
  }

  @Get("expenses")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VIEWER")
  async listExpenses(
    @Req() req: AuthedRequest,
    @Query("category") category?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.service.listExpenses(req.user?.tenantId ?? null, category, from, to);
    return { data, message: "Expenses fetched" };
  }

  @Post("expenses")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async createExpense(@Req() req: AuthedRequest, @Body() body: Prisma.FarmExpenseUncheckedCreateInput) {
    const data = await this.service.createExpense(req.user?.tenantId ?? null, body);
    return { data, message: "Expense recorded" };
  }

  @Patch("expenses/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async updateExpense(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.FarmExpenseUncheckedUpdateInput) {
    const data = await this.service.updateExpense(id, req.user?.tenantId ?? null, body);
    return { data, message: "Expense updated" };
  }

  @Delete("expenses/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async removeExpense(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.removeExpense(id, req.user?.tenantId ?? null);
    return { data, message: "Expense removed" };
  }

  @Get("income")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VIEWER")
  async listIncome(
    @Req() req: AuthedRequest,
    @Query("source") source?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.service.listIncome(req.user?.tenantId ?? null, source, from, to);
    return { data, message: "Income fetched" };
  }

  @Post("income")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async createIncome(@Req() req: AuthedRequest, @Body() body: Prisma.FarmIncomeUncheckedCreateInput) {
    const data = await this.service.createIncome(req.user?.tenantId ?? null, body);
    return { data, message: "Income recorded" };
  }

  @Patch("income/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async updateIncome(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.FarmIncomeUncheckedUpdateInput) {
    const data = await this.service.updateIncome(id, req.user?.tenantId ?? null, body);
    return { data, message: "Income updated" };
  }

  @Delete("income/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async removeIncome(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.removeIncome(id, req.user?.tenantId ?? null);
    return { data, message: "Income removed" };
  }
}

@Module({
  controllers: [FarmFinanceController],
  providers: [FarmFinanceService, FarmCacheService],
  exports: [FarmFinanceService]
})
export class FarmFinanceModule {}
