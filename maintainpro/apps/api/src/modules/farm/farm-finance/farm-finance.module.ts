import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";
import { FarmCacheService } from "../farm-cache.service";

const FINANCE_SUMMARY_TTL_MS = 5 * 60 * 1000; // 5m

@Injectable()
export class FarmFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: FarmCacheService
  ) {}

  listExpenses(tenantId?: string, category?: string, from?: string, to?: string) {
    return this.prisma.farmExpense.findMany({
      where: {
        tenantId: tenantId ?? undefined,
        category: category as never,
        date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined
      },
      orderBy: { date: "desc" }
    });
  }

  createExpense(data: Prisma.FarmExpenseUncheckedCreateInput) {
    this.cache.invalidate(`finance:`);
    return this.prisma.farmExpense.create({ data });
  }

  updateExpense(id: string, data: Prisma.FarmExpenseUncheckedUpdateInput) {
    this.cache.invalidate(`finance:`);
    return this.prisma.farmExpense.update({ where: { id }, data });
  }

  removeExpense(id: string) {
    this.cache.invalidate(`finance:`);
    return this.prisma.farmExpense.delete({ where: { id } });
  }

  listIncome(tenantId?: string, source?: string, from?: string, to?: string) {
    return this.prisma.farmIncome.findMany({
      where: {
        tenantId: tenantId ?? undefined,
        source: source as never,
        date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined
      },
      orderBy: { date: "desc" }
    });
  }

  createIncome(data: Prisma.FarmIncomeUncheckedCreateInput) {
    this.cache.invalidate(`finance:`);
    return this.prisma.farmIncome.create({ data });
  }

  updateIncome(id: string, data: Prisma.FarmIncomeUncheckedUpdateInput) {
    this.cache.invalidate(`finance:`);
    return this.prisma.farmIncome.update({ where: { id }, data });
  }

  removeIncome(id: string) {
    this.cache.invalidate(`finance:`);
    return this.prisma.farmIncome.delete({ where: { id } });
  }

  async summary(tenantId: string, from?: string, to?: string) {
    return this.cache.wrap(`finance:summary:${tenantId}:${from ?? "_"}:${to ?? "_"}`, FINANCE_SUMMARY_TTL_MS, async () => {
      const dateFilter = from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined;
      const [expenses, income] = await Promise.all([
        this.prisma.farmExpense.findMany({ where: { tenantId, date: dateFilter }, select: { amountLkr: true, category: true } }),
        this.prisma.farmIncome.findMany({ where: { tenantId, date: dateFilter }, select: { totalLkr: true, source: true } })
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
    @Query("tenantId") tenantId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.service.summary(tenantId, from, to);
    return { data, message: "Finance summary fetched" };
  }

  @Get("expenses")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VIEWER")
  async listExpenses(
    @Query("tenantId") tenantId?: string,
    @Query("category") category?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.service.listExpenses(tenantId, category, from, to);
    return { data, message: "Expenses fetched" };
  }

  @Post("expenses")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async createExpense(@Body() body: Prisma.FarmExpenseUncheckedCreateInput) {
    const data = await this.service.createExpense(body);
    return { data, message: "Expense recorded" };
  }

  @Patch("expenses/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async updateExpense(@Param("id") id: string, @Body() body: Prisma.FarmExpenseUncheckedUpdateInput) {
    const data = await this.service.updateExpense(id, body);
    return { data, message: "Expense updated" };
  }

  @Delete("expenses/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async removeExpense(@Param("id") id: string) {
    const data = await this.service.removeExpense(id);
    return { data, message: "Expense removed" };
  }

  @Get("income")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VIEWER")
  async listIncome(
    @Query("tenantId") tenantId?: string,
    @Query("source") source?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.service.listIncome(tenantId, source, from, to);
    return { data, message: "Income fetched" };
  }

  @Post("income")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async createIncome(@Body() body: Prisma.FarmIncomeUncheckedCreateInput) {
    const data = await this.service.createIncome(body);
    return { data, message: "Income recorded" };
  }

  @Patch("income/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async updateIncome(@Param("id") id: string, @Body() body: Prisma.FarmIncomeUncheckedUpdateInput) {
    const data = await this.service.updateIncome(id, body);
    return { data, message: "Income updated" };
  }

  @Delete("income/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async removeIncome(@Param("id") id: string) {
    const data = await this.service.removeIncome(id);
    return { data, message: "Income removed" };
  }
}

@Module({
  controllers: [FarmFinanceController],
  providers: [FarmFinanceService, FarmCacheService],
  exports: [FarmFinanceService]
})
export class FarmFinanceModule {}
