import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const clampPct = (value: number) => Math.min(100, Math.max(0, value));

const CLOSED_JOB_STATUSES = ["CLOSED", "CANCELLED", "COMPLETED"];
const RETIRED_ASSET_STATUSES = ["RETIRED", "DISPOSED", "DECOMMISSIONED", "INACTIVE"];

export type PinState = "OPEN_JOB" | "OK" | "RETIRED";

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
      select: { id: true, name: true, siteId: true, createdAt: true, pins: { select: { assetId: true, x: true, y: true } } }
    });
    const states = await this.pinStates(tenantId, rows.flatMap((row) => row.pins.map((pin) => pin.assetId)));
    const siteNames = await this.siteNames(tenantId, rows.map((row) => row.siteId));
    return rows.map(({ pins, ...row }) => ({
      ...row,
      siteName: row.siteId ? siteNames.get(row.siteId) ?? null : null,
      pinCount: pins.length,
      openJobPins: pins.filter((pin) => states.get(pin.assetId) === "OPEN_JOB").length,
      dots: pins.slice(0, 40).map((pin) => ({ x: pin.x, y: pin.y, state: states.get(pin.assetId) ?? "OK" }))
    }));
  }

  async get(tenantIdRaw: string | null, id: string) {
    const tenantId = requireTenantId(tenantIdRaw);
    const plan = await this.prisma.floorPlan.findFirst({ where: { id, tenantId, isActive: true }, include: { pins: true } });
    if (!plan) throw new NotFoundException("Floor plan not found.");
    const assetIds = plan.pins.map((pin) => pin.assetId);
    const assets = assetIds.length
      ? await this.prisma.asset.findMany({
          where: { tenantId, id: { in: assetIds } },
          select: { id: true, name: true, assetTag: true, location: true }
        })
      : [];
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const states = await this.pinStates(tenantId, assetIds);
    const jobs = assetIds.length
      ? await this.prisma.workOrder.findMany({
          where: { tenantId, assetId: { in: assetIds }, status: { notIn: CLOSED_JOB_STATUSES } },
          orderBy: { createdAt: "desc" },
          select: { id: true, woNumber: true, title: true, assetId: true }
        })
      : [];
    const jobByAsset = new Map<string, { id: string; woNumber: string | null; title: string | null; count: number }>();
    for (const job of jobs) {
      if (!job.assetId) continue;
      const existing = jobByAsset.get(job.assetId);
      if (existing) existing.count += 1;
      else jobByAsset.set(job.assetId, { id: job.id, woNumber: job.woNumber ?? null, title: job.title ?? null, count: 1 });
    }
    const siteNames = await this.siteNames(tenantId, [plan.siteId]);
    return {
      ...plan,
      siteName: plan.siteId ? siteNames.get(plan.siteId) ?? null : null,
      pins: plan.pins.map((pin) => {
        const asset = byId.get(pin.assetId);
        const job = jobByAsset.get(pin.assetId);
        return {
          id: pin.id,
          assetId: pin.assetId,
          x: pin.x,
          y: pin.y,
          assetName: asset?.name ?? "Unknown asset",
          assetTag: asset?.assetTag ?? null,
          assetLocation: asset?.location ?? null,
          state: states.get(pin.assetId) ?? "OK",
          openJobs: job?.count ?? 0,
          latestJob: job ? { id: job.id, woNumber: job.woNumber, title: job.title } : null
        };
      })
    };
  }

  /** Where is this asset? Used by the asset and job pages. Null when it is not on any plan. */
  async byAsset(tenantIdRaw: string | null, assetId: string) {
    const tenantId = requireTenantId(tenantIdRaw);
    const pin = await this.prisma.floorPlanPin.findFirst({
      where: { assetId, floorPlan: { tenantId, isActive: true } },
      select: { x: true, y: true, floorPlan: { select: { id: true, name: true, siteId: true } } }
    });
    if (!pin) return null;
    const siteNames = await this.siteNames(tenantId, [pin.floorPlan.siteId]);
    const states = await this.pinStates(tenantId, [assetId]);
    return {
      planId: pin.floorPlan.id,
      planName: pin.floorPlan.name,
      siteName: pin.floorPlan.siteId ? siteNames.get(pin.floorPlan.siteId) ?? null : null,
      x: pin.x,
      y: pin.y,
      state: states.get(assetId) ?? "OK"
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
        siteId: await this.validSiteId(tenantId, input.siteId),
        imageData: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
      },
      select: { id: true, name: true }
    });
  }

  async update(tenantIdRaw: string | null, id: string, input: { name?: string; siteId?: string | null }) {
    const tenantId = requireTenantId(tenantIdRaw);
    await this.assertPlan(tenantId, id);
    const data: { name?: string; siteId?: string | null } = {};
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new BadRequestException("Enter a floor plan name.");
      data.name = trimmed;
    }
    if (input.siteId !== undefined) data.siteId = await this.validSiteId(tenantId, input.siteId);
    return this.prisma.floorPlan.update({ where: { id }, data, select: { id: true, name: true, siteId: true } });
  }

  async replaceImage(tenantIdRaw: string | null, id: string, file?: Express.Multer.File) {
    const tenantId = requireTenantId(tenantIdRaw);
    await this.assertPlan(tenantId, id);
    if (!file) throw new BadRequestException("Choose a floor plan image.");
    if (!ALLOWED_TYPES.has(file.mimetype)) throw new BadRequestException("Use a PNG, JPG or WEBP image.");
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException("Image is too large. Keep it under 3 MB.");
    return this.prisma.floorPlan.update({
      where: { id },
      data: { imageData: `data:${file.mimetype};base64,${file.buffer.toString("base64")}` },
      select: { id: true }
    });
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

  private async validSiteId(tenantId: string, siteId?: string | null): Promise<string | null> {
    const value = siteId?.trim();
    if (!value) return null;
    const site = await this.prisma.site.findFirst({ where: { id: value, tenantId }, select: { id: true } });
    if (!site) throw new BadRequestException("Site not found.");
    return site.id;
  }

  private async siteNames(tenantId: string, ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map<string, string>();
    const sites = await this.prisma.site.findMany({ where: { tenantId, id: { in: unique } }, select: { id: true, name: true } });
    return new Map(sites.map((site) => [site.id, site.name]));
  }

  /** Pin colour: open job (red), retired (grey) or fine (green). */
  private async pinStates(tenantId: string, assetIds: string[]): Promise<Map<string, PinState>> {
    const unique = [...new Set(assetIds)];
    const result = new Map<string, PinState>();
    if (unique.length === 0) return result;
    const [assets, openJobs] = await Promise.all([
      this.prisma.asset.findMany({ where: { tenantId, id: { in: unique } }, select: { id: true, status: true, isActive: true } }),
      this.prisma.workOrder.findMany({
        where: { tenantId, assetId: { in: unique }, status: { notIn: CLOSED_JOB_STATUSES } },
        select: { assetId: true },
        distinct: ["assetId"]
      })
    ]);
    const withJob = new Set(openJobs.map((job) => job.assetId));
    for (const asset of assets) {
      const retired = !asset.isActive || RETIRED_ASSET_STATUSES.includes((asset.status ?? "").toUpperCase());
      result.set(asset.id, retired ? "RETIRED" : withJob.has(asset.id) ? "OPEN_JOB" : "OK");
    }
    return result;
  }

  private async assertPlan(tenantId: string, id: string) {
    const plan = await this.prisma.floorPlan.findFirst({ where: { id, tenantId, isActive: true }, select: { id: true } });
    if (!plan) throw new NotFoundException("Floor plan not found.");
  }
}
