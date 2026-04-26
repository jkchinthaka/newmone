import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class LivestockService {
  constructor(private readonly prisma: PrismaService) {}

  listAnimals(tenantId?: string, species?: string, status?: string) {
    return this.prisma.livestockAnimal.findMany({
      where: { tenantId: tenantId ?? undefined, species: species as never, status: status as never },
      orderBy: { createdAt: "desc" }
    });
  }

  getAnimal(id: string) {
    return this.prisma.livestockAnimal.findUnique({
      where: { id },
      include: { healthRecords: true, productionLogs: true, feedingLogs: true }
    });
  }

  createAnimal(data: Prisma.LivestockAnimalUncheckedCreateInput) {
    return this.prisma.livestockAnimal.create({ data });
  }

  updateAnimal(id: string, data: Prisma.LivestockAnimalUncheckedUpdateInput) {
    return this.prisma.livestockAnimal.update({ where: { id }, data });
  }

  removeAnimal(id: string) {
    return this.prisma.livestockAnimal.delete({ where: { id } });
  }

  // Health
  listHealth(animalId: string) {
    return this.prisma.animalHealthRecord.findMany({ where: { animalId }, orderBy: { date: "desc" } });
  }

  createHealth(data: Prisma.AnimalHealthRecordUncheckedCreateInput) {
    return this.prisma.animalHealthRecord.create({ data });
  }

  // Production
  listProduction(animalId: string) {
    return this.prisma.animalProductionLog.findMany({ where: { animalId }, orderBy: { date: "desc" } });
  }

  createProduction(data: Prisma.AnimalProductionLogUncheckedCreateInput) {
    return this.prisma.animalProductionLog.create({ data });
  }

  // Feeding
  listFeeding(tenantId?: string) {
    return this.prisma.feedingLog.findMany({
      where: { tenantId: tenantId ?? undefined },
      orderBy: { date: "desc" }
    });
  }

  createFeeding(data: Prisma.FeedingLogUncheckedCreateInput) {
    return this.prisma.feedingLog.create({ data });
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
    @Query("tenantId") tenantId?: string,
    @Query("species") species?: string,
    @Query("status") status?: string
  ) {
    const data = await this.service.listAnimals(tenantId, species, status);
    return { data, message: "Animals fetched" };
  }

  @Get("animals/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "VIEWER")
  async getAnimal(@Param("id") id: string) {
    const data = await this.service.getAnimal(id);
    return { data, message: "Animal fetched" };
  }

  @Post("animals")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN")
  async createAnimal(@Body() body: Prisma.LivestockAnimalUncheckedCreateInput) {
    const data = await this.service.createAnimal(body);
    return { data, message: "Animal created" };
  }

  @Patch("animals/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN")
  async updateAnimal(@Param("id") id: string, @Body() body: Prisma.LivestockAnimalUncheckedUpdateInput) {
    const data = await this.service.updateAnimal(id, body);
    return { data, message: "Animal updated" };
  }

  @Delete("animals/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async removeAnimal(@Param("id") id: string) {
    const data = await this.service.removeAnimal(id);
    return { data, message: "Animal removed" };
  }

  @Get("animals/:id/health")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN")
  async listHealth(@Param("id") id: string) {
    const data = await this.service.listHealth(id);
    return { data, message: "Health records fetched" };
  }

  @Post("animals/:id/health")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN")
  async createHealth(@Param("id") id: string, @Body() body: Omit<Prisma.AnimalHealthRecordUncheckedCreateInput, "animalId">) {
    const data = await this.service.createHealth({ ...body, animalId: id });
    return { data, message: "Health record created" };
  }

  @Get("animals/:id/production")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "VIEWER")
  async listProduction(@Param("id") id: string) {
    const data = await this.service.listProduction(id);
    return { data, message: "Production logs fetched" };
  }

  @Post("animals/:id/production")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "FARM_WORKER")
  async createProduction(@Param("id") id: string, @Body() body: Omit<Prisma.AnimalProductionLogUncheckedCreateInput, "animalId">) {
    const data = await this.service.createProduction({ ...body, animalId: id });
    return { data, message: "Production log created" };
  }

  @Get("feeding")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "VIEWER")
  async listFeeding(@Query("tenantId") tenantId?: string) {
    const data = await this.service.listFeeding(tenantId);
    return { data, message: "Feeding logs fetched" };
  }

  @Post("feeding")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VETERINARIAN", "FARM_WORKER")
  async createFeeding(@Body() body: Prisma.FeedingLogUncheckedCreateInput) {
    const data = await this.service.createFeeding(body);
    return { data, message: "Feeding log created" };
  }
}

@Module({
  controllers: [LivestockController],
  providers: [LivestockService],
  exports: [LivestockService]
})
export class LivestockModule {}
