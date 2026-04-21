import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AssetStatus, Prisma } from "@prisma/client";
import QRCode from "qrcode";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class AssetsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findAll(query: {
    category?: string;
    status?: string;
    location?: string;
    page?: number;
    limit?: number;
  }) {
    const rawPage = typeof query.page === "string" ? Number(query.page) : query.page;
    const rawLimit = typeof query.limit === "string" ? Number(query.limit) : query.limit;

    const page = Number.isFinite(rawPage) && Number(rawPage) > 0 ? Number(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && Number(rawLimit) > 0 ? Number(rawLimit) : 20;

    return this.prisma.asset.findMany({
      where: {
        category: query.category as Prisma.EnumAssetCategoryFilter | undefined,
        status: query.status as Prisma.EnumAssetStatusFilter | undefined,
        location: query.location
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });

    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    return asset;
  }

  async create(data: {
    assetTag: string;
    name: string;
    category: Prisma.AssetCreateInput["category"];
    status?: Prisma.AssetCreateInput["status"];
    location?: string;
    description?: string;
  }) {
    const existing = await this.prisma.asset.findUnique({ where: { assetTag: data.assetTag } });

    if (existing) {
      throw new BadRequestException("Asset tag must be unique across the system");
    }

    const asset = await this.prisma.asset.create({
      data: {
        ...data,
        status: data.status ?? AssetStatus.ACTIVE,
        images: [],
        documents: []
      }
    });

    const qrCodeData = await QRCode.toDataURL(`${process.env.FRONTEND_URL}/assets/${asset.id}`);

    return this.prisma.asset.update({
      where: { id: asset.id },
      data: {
        qrCodeUrl: qrCodeData
      }
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      status: AssetStatus;
      location: string;
      disposalReason: string;
    }>
  ) {
    const current = await this.findOne(id);

    if (data.status === AssetStatus.DISPOSED && !data.disposalReason) {
      throw new BadRequestException("Disposal requires a disposal reason");
    }

    if (current.status === AssetStatus.UNDER_MAINTENANCE && data.status === AssetStatus.DISPOSED) {
      throw new BadRequestException("Cannot dispose an asset that is UNDER_MAINTENANCE");
    }

    return this.prisma.asset.update({
      where: { id },
      data
    });
  }

  async remove(id: string) {
    const openWorkOrders = await this.prisma.workOrder.count({
      where: {
        assetId: id,
        status: {
          in: ["OPEN", "IN_PROGRESS", "ON_HOLD"]
        }
      }
    });

    if (openWorkOrders > 0) {
      throw new BadRequestException("Cannot delete an asset with open work orders");
    }

    await this.prisma.asset.delete({ where: { id } });

    return { deleted: true };
  }

  async getQrCode(id: string) {
    const asset = await this.findOne(id);
    return {
      assetId: id,
      qrCodeUrl: asset.qrCodeUrl
    };
  }

  maintenanceHistory(id: string) {
    return this.prisma.maintenanceLog.findMany({
      where: { assetId: id },
      orderBy: { performedAt: "desc" }
    });
  }

  async bulkImport(items: Array<{ assetTag: string; name: string; category: Prisma.AssetCreateInput["category"]; location?: string }>) {
    const created = await Promise.all(
      items.map((item) =>
        this.prisma.asset.upsert({
          where: { assetTag: item.assetTag },
          update: {
            name: item.name,
            category: item.category,
            location: item.location
          },
          create: {
            ...item,
            status: AssetStatus.ACTIVE,
            images: [],
            documents: []
          }
        })
      )
    );

    return {
      count: created.length,
      items: created
    };
  }
}
