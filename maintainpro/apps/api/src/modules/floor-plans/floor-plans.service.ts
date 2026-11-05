import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const clampPct = (value: number) => Math.min(100, Math.max(0, value));

/** Floor plans: one uploaded image per plan with asset pins stored as percentage positions. */
@Injectable()
export class FloorPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantIdRaw: string | null, q?: string) {
    const tenantId = requireTenantId(tenantIdRaw);
    const term = q?.trim();
    const rows = await this.prisma.floorPlan.findMany({
      where: { tenantId, isActive: true, ...(term ? { name: { contains: term } } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, siteId: true, createdAt: true, _count: { select: { pins: true } } }
    });
    return rows.map(({ _count, ...row }) => ({ ...row, pinCount: _count.pins }));
  }

  async get(tenantIdRaw: string | null, id: string) {
    const tenantId = requireTenantId(tenantIdRaw);
    const plan = await this.prisma.floorPlan.findFirst({ where: { id, tenantId, isActive: true }, include: { pins: true } });
    if (!plan) throw new NotFoundException("Floor plan not found.");
    const assets = plan.pins.length
      ? await this.prisma.asset.findMany({
          where: { tenantId, id: { in: plan.pins.map((pin) => pin.assetId) } },
          select: { id: true, name: true, assetTag: true }
        })
      : [];
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    return {
      ...plan,
      pins: plan.pins.map((pin) => ({
        id: pin.id,
        assetId: pin.assetId,
        x: pin.x,
        y: pin.y,
        assetName: byId.get(pin.assetId)?.name ?? "Unknown asset",
        assetTag: byId.get(pin.assetId)?.assetTag ?? null
      }))
    };
  }

  async create(tenantIdRaw: string | null, input: { name?: string; siteId?: string }, file?: Express.Multer.File) {
    const tenantId = requireTenantId(tenantIdRaw);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Enter a floor plan name.");
    if (!file) throw new BadRequestException("Choose a floor plan image.");
    if (!ALLOWED_TYPES.has(file.mimetype)) throw new BadRequestException("Use a PNG, JPG or WEBP image.");
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException("Image is too large. Keep it under 3 MB.");
    return this.prisma.floorPlan.create({
      data: {
        tenantId,
        name,
        siteId: input.siteId?.trim() || null,
        imageData: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
      },
      select: { id: true, name: true }
    });
  }

  async rename(tenantIdRaw: string | null, id: string, name: string) {
    const tenantId = requireTenantId(tenantIdRaw);
    const trimmed = name?.trim();
    if (!trimmed) throw new BadRequestException("Enter a floor plan name.");
    await this.assertPlan(tenantId, id);
    return this.prisma.floorPlan.update({ where: { id }, data: { name: trimmed }, select: { id: true, name: true } });
  }

  async remove(tenantIdRaw: string | null, id: string) {
    const tenantId = requireTenantId(tenantIdRaw);
    await this.assertPlan(tenantId, id);
    await this.prisma.floorPlanPin.deleteMany({ where: { floorPlanId: id } });
    await this.prisma.floorPlan.update({ where: { id }, data: { isActive: false } });
    return { id };
  }

  async setPin(tenantIdRaw: string | null, id: string, input: { assetId?: string; x?: number; y?: number }) {
    const tenantId = requireTenantId(tenantIdRaw);
    await this.assertPlan(tenantId, id);
    if (!input.assetId) throw new BadRequestException("Choose an asset.");
    if (typeof input.x !== "number" || typeof input.y !== "number" || Number.isNaN(input.x) || Number.isNaN(input.y)) {
      throw new BadRequestException("Click the plan to place the pin.");
    }
    const asset = await this.prisma.asset.findFirst({ where: { id: input.assetId, tenantId }, select: { id: true } });
    if (!asset) throw new BadRequestException("Asset not found.");
    const x = clampPct(input.x);
    const y = clampPct(input.y);
    return this.prisma.floorPlanPin.upsert({
      where: { floorPlanId_assetId: { floorPlanId: id, assetId: input.assetId } },
      create: { floorPlanId: id, assetId: input.assetId, x, y },
      update: { x, y }
    });
  }

  async removePin(tenantIdRaw: string | null, id: string, pinId: string) {
    const tenantId = requireTenantId(tenantIdRaw);
    await this.assertPlan(tenantId, id);
    await this.prisma.floorPlanPin.deleteMany({ where: { id: pinId, floorPlanId: id } });
    return { id: pinId };
  }

  private async assertPlan(tenantId: string, id: string) {
    const plan = await this.prisma.floorPlan.findFirst({ where: { id, tenantId, isActive: true }, select: { id: true } });
    if (!plan) throw new NotFoundException("Floor plan not found.");
  }
}
