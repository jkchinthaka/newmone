import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { assertTenantEntityExists, requireTenantId } from "../../../common/utils/tenant-scope.util";
import { PrismaService } from "../../../database/prisma.service";

interface AuthedRequest {
  user?: { sub: string; role: string; tenantId?: string | null };
}

@Injectable()
export class LivestockService {
  constructor(private readonly prisma: PrismaService) {}

  listAnimals(tenantId: string | null, species?: string, status?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.livestockAnimal.findMany({
      where: { tenantId: scopedTenantId, species: species as never, status: status as never },
      orderBy: { createdAt: "desc" }
    });
  }

  getAnimal(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.livestockAnimal.findFirst({
      where: { id, tenantId: scopedTenantId },
      include: { healthRecords: true, productionLogs: true, feedingLogs: true }
    });
  }

  createAnimal(tenantId: string | null, data: Prisma.LivestockAnimalUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.livestockAnimal.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async updateAnimal(id: string, tenantId: string | null, data: Prisma.LivestockAnimalUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.livestockAnimal, id, { tenantId: scopedTenantId, entityName: "Animal" });
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.livestockAnimal.update({ where: { id }, data: safe as Prisma.LivestockAnimalUncheckedUpdateInput });
  }

  async removeAnimal(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.livestockAnimal, id, { tenantId: scopedTenantId, entityName: "Animal" });
    return this.prisma.livestockAnimal.delete({ where: { id } });
  }

  // Health
  async listHealth(animalId: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.livestockAnimal, animalId, { tenantId: scopedTenantId, entityName: "Animal" });
    return this.prisma.animalHealthRecord.findMany({ where: { animalId, tenantId: scopedTenantId }, orderBy: { date: "desc" } });
  }

  listAllHealth(tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.animalHealthRecord.findMany({
      where: { tenantId: scopedTenantId },
      include: { animal: true },
      orderBy: { date: "desc" }
    });
  }

  async createHealth(tenantId: string | null, data: Prisma.AnimalHealthRecordUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    // Cross-tenant FK validation: the animal must belong to the active tenant.
    await assertTenantEntityExists(this.prisma.livestockAnimal, data.animalId, { tenantId: scopedTenantId, entityName: "Animal" });
    return this.prisma.animalHealthRecord.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  // Production
  async listProduction(animalId: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.livestockAnimal, animalId, { tenantId: scopedTenantId, entityName: "Animal" });
    return this.prisma.animalProductionLog.findMany({ where: { animalId, tenantId: scopedTenantId }, orderBy: { date: "desc" } });
  }

  async createProduction(tenantId: string | null, data: Prisma.AnimalProductionLogUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.livestockAnimal, data.animalId, { tenantId: scopedTenantId, entityName: "Animal" });
    return this.prisma.animalProductionLog.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  // Feeding
  listFeeding(tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.feedingLog.findMany({
      where: { tenantId: scopedTenantId },
      orderBy: { date: "desc" }
    });
  }

  async createFeeding(tenantId: string | null, data: Prisma.FeedingLogUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    if (typeof data.animalId === "string" && data.animalId) {
      await assertTenantEntityExists(this.prisma.livestockAnimal, data.animalId, { tenantId: scopedTenantId, entityName: "Animal" });
    }
    return this.prisma.feedingLog.create({ data: { ...data, tenantId: scopedTenantId } });
  }
}

@ApiTags("Farm / Livestock")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/livestock")
export class LivestockController {
  constructor(private readonly service: LivestockService) {}

  @Get("animals")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "VIEWER")
  async listAnimals(
    @Req() req: AuthedRequest,
    @Query("species") species?: string,
    @Query("status") status?: string
  ) {
    const data = await this.service.listAnimals(req.user?.tenantId ?? null, species, status);
    return { data, message: "Animals fetched" };
  }

  @Get("animals/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "VIEWER")
  async getAnimal(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.getAnimal(id, req.user?.tenantId ?? null);
    return { data, message: "Animal fetched" };
  }

  @Post("animals")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN")
  async createAnimal(@Req() req: AuthedRequest, @Body() body: Prisma.LivestockAnimalUncheckedCreateInput) {
    const data = await this.service.createAnimal(req.user?.tenantId ?? null, body);
    return { data, message: "Animal created" };
  }

  @Patch("animals/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN")
  async updateAnimal(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.LivestockAnimalUncheckedUpdateInput) {
    const data = await this.service.updateAnimal(id, req.user?.tenantId ?? null, body);
    return { data, message: "Animal updated" };
  }

  @Delete("animals/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async removeAnimal(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.removeAnimal(id, req.user?.tenantId ?? null);
    return { data, message: "Animal removed" };
  }

  @Get("animals/:id/health")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN")
  async listHealth(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.listHealth(id, req.user?.tenantId ?? null);
    return { data, message: "Health records fetched" };
  }

  @Get("health")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "VIEWER")
  async listAllHealth(@Req() req: AuthedRequest) {
    const data = await this.service.listAllHealth(req.user?.tenantId ?? null);
    return { data, message: "Health records fetched" };
  }

  @Post("animals/:id/health")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN")
  async createHealth(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Omit<Prisma.AnimalHealthRecordUncheckedCreateInput, "animalId" | "tenantId">) {
    const data = await this.service.createHealth(req.user?.tenantId ?? null, { ...body, animalId: id } as Prisma.AnimalHealthRecordUncheckedCreateInput);
    return { data, message: "Health record created" };
  }

  @Get("animals/:id/production")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "VIEWER")
  async listProduction(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.listProduction(id, req.user?.tenantId ?? null);
    return { data, message: "Production logs fetched" };
  }

  @Post("animals/:id/production")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "FARM_WORKER")
  async createProduction(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Omit<Prisma.AnimalProductionLogUncheckedCreateInput, "animalId" | "tenantId">) {
    const data = await this.service.createProduction(req.user?.tenantId ?? null, { ...body, animalId: id } as Prisma.AnimalProductionLogUncheckedCreateInput);
    return { data, message: "Production log created" };
  }

  @Get("feeding")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "VIEWER")
  async listFeeding(@Req() req: AuthedRequest) {
    const data = await this.service.listFeeding(req.user?.tenantId ?? null);
    return { data, message: "Feeding logs fetched" };
  }

  @Post("feeding")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "FARM_WORKER")
  async createFeeding(@Req() req: AuthedRequest, @Body() body: Prisma.FeedingLogUncheckedCreateInput) {
    const data = await this.service.createFeeding(req.user?.tenantId ?? null, body);
    return { data, message: "Feeding log created" };
  }
}

@Module({
  controllers: [LivestockController],
  providers: [LivestockService],
  exports: [LivestockService]
})
export class LivestockModule {}
