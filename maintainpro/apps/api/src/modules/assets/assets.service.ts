import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AssetCategory,
  AssetCondition,
  AssetStatus,
  AuditAction,
  Prisma
} from "@prisma/client";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import { QrCodeService } from "../../common/services/qr-code.service";
import type {
  AssetExportQueryDto,
  AssetListQueryDto,
  BulkAssetActionDto,
  BulkImportAssetItemDto,
  CreateAssetDto,
  UpdateAssetDto,
  UpdateAssetStatusDto
} from "./dto/assets.dto";
import { PrismaService } from "../../database/prisma.service";

interface AssetDocumentRecord {
  id: string;
  name: string;
  storedName?: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
  externalUrl?: string;
}

export interface ParsedAssetDocument extends AssetDocumentRecord {
  downloadUrl?: string;
}

interface AssetMutationInput {
  assetTag?: string;
  name?: string;
  description?: string | null;
  category?: Prisma.AssetUncheckedCreateInput["category"];
  condition?: AssetCondition;
  status?: AssetStatus;
  purchaseDate?: Date | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  supplier?: string | null;
  department?: string | null;
  ownerName?: string | null;
  location?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  meterReading?: number | null;
  lastServiceDate?: Date | null;
  nextServiceDate?: Date | null;
  warrantyExpiry?: Date | null;
  disposalDate?: Date | null;
  disposalReason?: string | null;
}

const OPEN_WORK_ORDER_STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD", "OVERDUE"] as const;

@Injectable()
export class AssetsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(QrCodeService) private readonly qrCodeService: QrCodeService
  ) {}

  async findAll(tenantId: string | null | undefined, query: AssetListQueryDto) {
    const page = this.toPositiveInt(query.page, 1);
    const limit = this.toPositiveInt(query.limit, 20);
    const where = this.buildWhere(tenantId, query);
    const orderBy = this.buildOrderBy(query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          workOrders: {
            where: {
              status: {
                in: [...OPEN_WORK_ORDER_STATUSES]
              }
            },
            select: {
              id: true
            }
          },
          _count: {
            select: {
              maintenanceLogs: true,
              workOrders: true
            }
          }
        }
      })
    ]);

    return {
      items: items.map((asset) => this.toAssetListItem(asset)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async summary(tenantId: string | null | undefined, query: AssetListQueryDto) {
    const where = this.buildWhere(tenantId, query);
    const now = new Date();
    const dueCutoff = new Date();
    dueCutoff.setDate(dueCutoff.getDate() + 30);

    const [
      totalAssets,
      activeAssets,
      underMaintenanceAssets,
      dueSoonAssets,
      criticalAssets,
      archivedAssets,
      byCategory,
      byCondition
    ] = await this.prisma.$transaction([
      this.prisma.asset.count({ where }),
      this.prisma.asset.count({ where: { ...where, status: AssetStatus.ACTIVE } }),
      this.prisma.asset.count({
        where: { ...where, status: AssetStatus.UNDER_MAINTENANCE }
      }),
      this.prisma.asset.count({
        where: {
          ...where,
          nextServiceDate: {
            gte: now,
            lte: dueCutoff
          }
        }
      }),
      this.prisma.asset.count({
        where: {
          ...where,
          condition: {
            in: [AssetCondition.POOR, AssetCondition.CRITICAL]
          }
        }
      }),
      this.prisma.asset.count({
        where: {
          ...(tenantId ? { tenantId } : {}),
          archivedAt: {
            not: null
          }
        }
      }),
      this.prisma.asset.groupBy({
        by: ["category"],
        orderBy: {
          category: "asc"
        },
        _count: {
          _all: true
        },
        where
      }),
      this.prisma.asset.groupBy({
        by: ["condition"],
        orderBy: {
          condition: "asc"
        },
        _count: {
          _all: true
        },
        where
      })
    ]);

    return {
      totalAssets,
      activeAssets,
      underMaintenanceAssets,
      dueSoonAssets,
      criticalAssets,
      archivedAssets,
      byCategory: byCategory.map((item) => ({
        key: item.category,
        count: Number((item._count as { _all?: number } | undefined)?._all ?? 0)
      })),
      byCondition: byCondition.map((item) => ({
        key: item.condition,
        count: Number((item._count as { _all?: number } | undefined)?._all ?? 0)
      }))
    };
  }

  async filterOptions(tenantId: string | null | undefined) {
    const locations = await this.prisma.asset.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        location: {
          not: null
        }
      },
      select: {
        location: true
      },
      distinct: ["location"],
      orderBy: {
        location: "asc"
      }
    });

    return {
      locations: locations
        .map((item) => item.location?.trim())
        .filter((item): item is string => Boolean(item))
    };
  }

  async validateAssetTag(
    _tenantId: string | null | undefined,
    assetTag: string,
    excludeId?: string
  ) {
    const normalizedTag = assetTag.trim();
    if (!normalizedTag) {
      return { exists: false };
    }

    const existing = await this.prisma.asset.findUnique({
      where: { assetTag: normalizedTag },
      select: {
        id: true,
        assetTag: true,
        name: true
      }
    });

    const exists = Boolean(existing && existing.id !== excludeId);

    return {
      exists,
      assetId: exists ? existing?.id : null,
      assetTag: exists ? existing?.assetTag : null,
      name: exists ? existing?.name : null
    };
  }

  async findOne(id: string, tenantId?: string | null) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {})
      },
      include: {
        maintenanceLogs: {
          orderBy: {
            performedAt: "desc"
          },
          take: 12,
          select: {
            id: true,
            description: true,
            performedBy: true,
            performedAt: true,
            cost: true,
            notes: true,
            attachments: true,
            workOrderId: true
          }
        },
        workOrders: {
          orderBy: {
            createdAt: "desc"
          },
          take: 12,
          select: {
            id: true,
            woNumber: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            dueDate: true,
            estimatedCost: true,
            actualCost: true,
            createdAt: true,
            technician: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            maintenanceLogs: true,
            workOrders: true
          }
        }
      }
    });

    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    const [openWorkOrders, maintenanceCost, activity] = await this.prisma.$transaction([
      this.prisma.workOrder.count({
        where: {
          assetId: id,
          status: {
            in: [...OPEN_WORK_ORDER_STATUSES]
          }
        }
      }),
      this.prisma.maintenanceLog.aggregate({
        where: { assetId: id },
        _sum: { cost: true }
      }),
      this.prisma.auditLog.findMany({
        where: {
          entity: "ASSET",
          entityId: id
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 30,
        include: {
          actor: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })
    ]);

    const documents = this.parseDocuments(asset.documents, asset.id);

    return {
      ...asset,
      documents,
      isArchived: Boolean(asset.archivedAt),
      openWorkOrders,
      totalMaintenanceCost: maintenanceCost._sum.cost,
      activity: activity.map((event) => ({
        id: event.id,
        action: event.action,
        createdAt: event.createdAt,
        actorName:
          (event.actor
            ? `${event.actor.firstName} ${event.actor.lastName}`.trim() || event.actor.email
            : undefined) ?? "System",
        beforeData: event.beforeData,
        afterData: event.afterData
      }))
    };
  }

  async create(tenantId: string | null | undefined, actorId: string, data: CreateAssetDto) {
    await this.ensureUniqueAssetTag(data.assetTag);

    const created = await this.prisma.asset.create({
      data: {
        ...this.buildAssetCreateInput(tenantId, data)
      }
    });

    const asset = await this.prisma.asset.update({
      where: { id: created.id },
      data: {
        qrCodeUrl: await this.qrCodeService.toDataUrl(this.getAssetScanUrl(created.id), {
          margin: 1,
          errorCorrectionLevel: "H"
        })
      }
    });

    await this.recordAudit({
      tenantId: asset.tenantId,
      actorId,
      entityId: asset.id,
      action: AuditAction.CREATE,
      afterData: asset
    });

    return this.findOne(asset.id, tenantId);
  }

  async update(
    id: string,
    tenantId: string | null | undefined,
    actorId: string,
    data: UpdateAssetDto
  ) {
    const current = await this.findOne(id, tenantId);

    if (data.assetTag && data.assetTag !== current.assetTag) {
      await this.ensureUniqueAssetTag(data.assetTag, id);
    }

    this.validateStatusTransition(current.status, data.status, data.disposalReason ?? current.disposalReason ?? undefined);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: this.buildAssetMutationInput(data)
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      actorId,
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: current,
      afterData: updated
    });

    return this.findOne(id, tenantId);
  }

  async updateStatus(
    id: string,
    tenantId: string | null | undefined,
    actorId: string,
    data: UpdateAssetStatusDto
  ) {
    const current = await this.findOne(id, tenantId);
    this.validateStatusTransition(current.status, data.status, data.disposalReason ?? current.disposalReason ?? undefined);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        status: data.status,
        disposalReason:
          data.status === AssetStatus.DISPOSED
            ? this.toNullableString(data.disposalReason)
            : null,
        disposalDate:
          data.status === AssetStatus.DISPOSED
            ? this.toNullableDate(data.disposalDate ?? new Date().toISOString())
            : null
      }
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      actorId,
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: current,
      afterData: updated
    });

    return this.findOne(id, tenantId);
  }

  async remove(
    id: string,
    tenantId: string | null | undefined,
    actorId: string,
    permanent = false
  ) {
    const current = await this.findOne(id, tenantId);
    const currentRecord = await this.requireAssetRecord(id, tenantId);
    await this.ensureNoOpenWorkOrders(id);

    if (permanent) {
      await this.cleanupDocumentFiles(this.parseDocuments(currentRecord.documents, id));
      await this.prisma.asset.delete({ where: { id } });
      await this.recordAudit({
        tenantId: current.tenantId,
        actorId,
        entityId: id,
        action: AuditAction.DELETE,
        beforeData: current
      });
      return { deleted: true, archived: false };
    }

    if (current.archivedAt) {
      return { deleted: false, archived: true };
    }

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        status:
          current.status === AssetStatus.DISPOSED ? AssetStatus.DISPOSED : AssetStatus.RETIRED
      }
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      actorId,
      entityId: id,
      action: AuditAction.DELETE,
      beforeData: current,
      afterData: updated
    });

    return { deleted: false, archived: true };
  }

  async restore(id: string, tenantId: string | null | undefined, actorId: string) {
    const current = await this.findOne(id, tenantId);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        archivedAt: null,
        status: current.status === AssetStatus.RETIRED ? AssetStatus.ACTIVE : current.status
      }
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      actorId,
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: current,
      afterData: updated
    });

    return this.findOne(id, tenantId);
  }

  async bulkAction(
    tenantId: string | null | undefined,
    actorId: string,
    body: BulkAssetActionDto
  ) {
    const ids = Array.from(new Set(body.ids.map((item) => item.trim()).filter(Boolean)));

    if (ids.length === 0) {
      throw new BadRequestException("Select at least one asset");
    }

    if (body.action === "UPDATE_STATUS" && !body.status) {
      throw new BadRequestException("Bulk status update requires a target status");
    }

    if (body.action === "ASSIGN_LOCATION" && !body.location?.trim()) {
      throw new BadRequestException("Bulk location assignment requires a location");
    }

    if (body.action === "ASSIGN_CATEGORY" && !body.category) {
      throw new BadRequestException("Bulk category assignment requires a category");
    }

    const results = [];

    for (const id of ids) {
      if (body.action === "ARCHIVE") {
        results.push(await this.remove(id, tenantId, actorId, false));
        continue;
      }

      if (body.action === "RESTORE") {
        results.push(await this.restore(id, tenantId, actorId));
        continue;
      }

      if (body.action === "ASSIGN_LOCATION") {
        results.push(
          await this.update(id, tenantId, actorId, {
            location: body.location
          })
        );
        continue;
      }

      if (body.action === "ASSIGN_CATEGORY") {
        results.push(
          await this.update(id, tenantId, actorId, {
            category: body.category
          })
        );
        continue;
      }

      results.push(
        await this.updateStatus(id, tenantId, actorId, {
          status: body.status!,
          disposalReason: body.disposalReason
        })
      );
    }

    return {
      count: results.length,
      items: results
    };
  }

  async getQrCode(id: string, tenantId?: string | null) {
    const asset = await this.findOne(id, tenantId);
    return {
      assetId: id,
      assetTag: asset.assetTag,
      qrCodeUrl: asset.qrCodeUrl,
      scanUrl: this.getAssetScanUrl(id),
      downloadUrl: `/assets/${id}/qr-code/download?format=png`
    };
  }

  async getQrCodeFile(id: string, tenantId?: string | null, format: "png" | "svg" = "png") {
    const asset = await this.findOne(id, tenantId);
    if (format === "svg") {
      const svgMarkup = await QRCode.toString(this.getAssetScanUrl(id), {
        errorCorrectionLevel: "H",
        margin: 1,
        type: "svg"
      });

      return {
        buffer: Buffer.from(svgMarkup, "utf8"),
        filename: `${this.slugify(asset.assetTag)}-qr.svg`,
        contentType: "image/svg+xml"
      };
    }

    const pngBuffer = await this.qrCodeService.toBuffer(this.getAssetScanUrl(id), {
      errorCorrectionLevel: "H",
      margin: 1,
      scale: 8
    });

    return {
      buffer: pngBuffer,
      filename: `${this.slugify(asset.assetTag)}-qr.png`,
      contentType: "image/png"
    };
  }

  async regenerateQrCode(id: string, tenantId: string | null | undefined, actorId: string) {
    const current = await this.findOne(id, tenantId);
    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        qrCodeUrl: await this.qrCodeService.toDataUrl(this.getAssetScanUrl(id), {
          margin: 1,
          errorCorrectionLevel: "H"
        })
      }
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      actorId,
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: current,
      afterData: updated
    });

    return this.getQrCode(id, tenantId);
  }

  async exportAssets(tenantId: string | null | undefined, query: AssetExportQueryDto) {
    const selectedIds = query.ids
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const where = this.buildWhere(tenantId, query);

    if (selectedIds?.length) {
      where.id = {
        in: selectedIds
      };
    }

    const assets = await this.prisma.asset.findMany({
      where,
      orderBy: this.buildOrderBy(query)
    });

    const exportColumns = {
      assetTag: {
        header: "Asset Tag",
        getValue: (asset: (typeof assets)[number]) => asset.assetTag
      },
      name: {
        header: "Name",
        getValue: (asset: (typeof assets)[number]) => asset.name
      },
      category: {
        header: "Category",
        getValue: (asset: (typeof assets)[number]) => asset.category
      },
      status: {
        header: "Status",
        getValue: (asset: (typeof assets)[number]) => asset.status
      },
      condition: {
        header: "Condition",
        getValue: (asset: (typeof assets)[number]) => asset.condition
      },
      location: {
        header: "Location",
        getValue: (asset: (typeof assets)[number]) => asset.location ?? ""
      },
      supplier: {
        header: "Supplier",
        getValue: (asset: (typeof assets)[number]) => asset.supplier ?? ""
      },
      department: {
        header: "Department",
        getValue: (asset: (typeof assets)[number]) => asset.department ?? ""
      },
      ownerName: {
        header: "Owner",
        getValue: (asset: (typeof assets)[number]) => asset.ownerName ?? ""
      },
      lastServiceDate: {
        header: "Last Service Date",
        getValue: (asset: (typeof assets)[number]) => asset.lastServiceDate?.toISOString() ?? ""
      },
      nextServiceDate: {
        header: "Next Service Date",
        getValue: (asset: (typeof assets)[number]) => asset.nextServiceDate?.toISOString() ?? ""
      },
      purchaseDate: {
        header: "Purchase Date",
        getValue: (asset: (typeof assets)[number]) => asset.purchaseDate?.toISOString() ?? ""
      },
      warrantyExpiry: {
        header: "Warranty Expiry",
        getValue: (asset: (typeof assets)[number]) => asset.warrantyExpiry?.toISOString() ?? ""
      },
      meterReading: {
        header: "Meter Reading",
        getValue: (asset: (typeof assets)[number]) => asset.meterReading?.toString() ?? ""
      },
      createdAt: {
        header: "Created Date",
        getValue: (asset: (typeof assets)[number]) => asset.createdAt.toISOString()
      }
    } as const;

    type ExportColumnKey = keyof typeof exportColumns;
    const availableColumnKeys = Object.keys(exportColumns) as ExportColumnKey[];
    const requestedColumnKeys = (query.visibleColumns ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is ExportColumnKey => availableColumnKeys.includes(item as ExportColumnKey));
    const selectedColumnKeys = requestedColumnKeys.length > 0 ? requestedColumnKeys : availableColumnKeys;
    const headers = selectedColumnKeys.map((key) => exportColumns[key].header);
    const rows = assets.map((asset) => selectedColumnKeys.map((key) => exportColumns[key].getValue(asset)));

    const format = query.format ?? "xlsx";
    if (format === "csv") {
      const csv = [
        headers.join(","),
        ...rows.map((row) => row.map((column) => this.escapeCsv(column)).join(","))
      ].join("\n");

      return {
        buffer: Buffer.from(csv, "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename: `assets-${this.timestampSlug()}.csv`
      };
    }

    if (format === "pdf") {
      return {
        buffer: await this.buildAssetsPdfExport(headers, rows),
        contentType: "application/pdf",
        filename: `assets-${this.timestampSlug()}.pdf`
      };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Assets");
    sheet.columns = headers.map((header, index) => ({
      header,
      key: `c_${index}`,
      width: Math.max(18, header.length + 4)
    }));
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };

    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `assets-${this.timestampSlug()}.xlsx`
    };
  }

  async maintenanceHistory(id: string, tenantId?: string | null) {
    await this.findOne(id, tenantId);

    return this.prisma.maintenanceLog.findMany({
      where: { assetId: id },
      orderBy: { performedAt: "desc" }
    });
  }

  async uploadDocument(
    id: string,
    tenantId: string | null | undefined,
    actorId: string,
    file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException("Document file is required");
    }

    const current = await this.findOne(id, tenantId);
    const currentRecord = await this.requireAssetRecord(id, tenantId);
    const uploadDirectory = this.getDocumentDirectory();
    await mkdir(uploadDirectory, { recursive: true });

    const documentId = randomUUID();
    const originalName = this.sanitizeFilename(file.originalname || `asset-document-${documentId}`);
    const cloudinaryRecord = await this.uploadDocumentToCloudinary(id, documentId, originalName, file);
    const documentRecord =
      cloudinaryRecord ??
      (await this.storeDocumentLocally(id, documentId, originalName, file, uploadDirectory));

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        documents: [...currentRecord.documents, JSON.stringify(documentRecord)]
      }
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      actorId,
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: current,
      afterData: updated
    });

    return this.parseDocuments(updated.documents, id);
  }

  async downloadDocument(id: string, tenantId: string | null | undefined, documentId: string) {
    const asset = await this.requireAssetRecord(id, tenantId);
    const document = this.parseDocuments(asset.documents, id).find((item) => item.id === documentId);

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    if (document.externalUrl) {
      throw new BadRequestException("External documents must be opened from their source URL");
    }

    if (!document.storedName) {
      throw new NotFoundException("Stored file is not available for this document");
    }

    const buffer = await readFile(join(this.getDocumentDirectory(), document.storedName));

    return {
      buffer,
      filename: document.name,
      mimeType: document.mimeType ?? "application/octet-stream"
    };
  }

  async deleteDocument(
    id: string,
    tenantId: string | null | undefined,
    actorId: string,
    documentId: string
  ) {
    const current = await this.findOne(id, tenantId);
    const currentRecord = await this.requireAssetRecord(id, tenantId);
    const parsedDocuments = this.parseDocuments(currentRecord.documents, id);
    const document = parsedDocuments.find((item) => item.id === documentId);

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    if (document.storedName) {
      try {
        await unlink(join(this.getDocumentDirectory(), document.storedName));
      } catch {
        // Ignore missing files; the source of truth is the database entry.
      }
    }

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        documents: parsedDocuments
          .filter((item) => item.id !== documentId)
          .map((item) => JSON.stringify(this.toDocumentStorageRecord(item)))
      }
    });

    await this.recordAudit({
      tenantId: updated.tenantId,
      actorId,
      entityId: id,
      action: AuditAction.UPDATE,
      beforeData: current,
      afterData: updated
    });

    return this.parseDocuments(updated.documents, id);
  }

  async bulkImport(
    tenantId: string | null | undefined,
    actorId: string,
    items: BulkImportAssetItemDto[]
  ) {
    const created = [];
    const updated = [];

    for (const item of items) {
      const existing = await this.prisma.asset.findUnique({
        where: { assetTag: item.assetTag.trim() }
      });

      if (existing) {
        if (tenantId && existing.tenantId && existing.tenantId !== tenantId) {
          throw new BadRequestException(
            `Asset tag ${item.assetTag.trim()} already exists for another tenant`
          );
        }

        const before = await this.findOne(existing.id, tenantId);
        const next = await this.prisma.asset.update({
          where: { id: existing.id },
          data: {
            ...this.buildAssetMutationInput(item),
            archivedAt: null
          }
        });

        await this.recordAudit({
          tenantId: next.tenantId,
          actorId,
          entityId: next.id,
          action: AuditAction.UPDATE,
          beforeData: before,
          afterData: next
        });

        updated.push(next);
        continue;
      }

      const base = await this.prisma.asset.create({
        data: {
          ...this.buildAssetCreateInput(tenantId, item)
        }
      });

      const next = await this.prisma.asset.update({
        where: { id: base.id },
        data: {
          qrCodeUrl: await this.qrCodeService.toDataUrl(this.getAssetScanUrl(base.id), {
            margin: 1,
            errorCorrectionLevel: "H"
          })
        }
      });

      await this.recordAudit({
        tenantId: next.tenantId,
        actorId,
        entityId: next.id,
        action: AuditAction.CREATE,
        afterData: next
      });

      created.push(next);
    }

    return {
      createdCount: created.length,
      updatedCount: updated.length,
      items: [...created, ...updated]
    };
  }

  private buildWhere(
    tenantId: string | null | undefined,
    query: Pick<
      AssetListQueryDto,
      | "search"
      | "category"
      | "status"
      | "condition"
      | "location"
      | "department"
      | "supplier"
      | "ownerName"
      | "includeArchived"
      | "archivedOnly"
    >
  ): Prisma.AssetWhereInput {
    const where: Prisma.AssetWhereInput = {
      ...(tenantId ? { tenantId } : {})
    };

    if (query.archivedOnly) {
      where.archivedAt = { not: null };
    } else if (!query.includeArchived) {
      where.archivedAt = null;
    }

    if (query.category) {
      where.category = query.category;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.condition) {
      where.condition = query.condition;
    }
    if (query.location) {
      where.location = { contains: query.location, mode: "insensitive" };
    }
    if (query.department) {
      where.department = { contains: query.department, mode: "insensitive" };
    }
    if (query.supplier) {
      where.supplier = { contains: query.supplier, mode: "insensitive" };
    }
    if (query.ownerName) {
      where.ownerName = { contains: query.ownerName, mode: "insensitive" };
    }
    if (query.search) {
      const matchingCategories = this.matchCategoriesForSearch(query.search);
      where.OR = [
        { assetTag: { contains: query.search, mode: "insensitive" } },
        { name: { contains: query.search, mode: "insensitive" } },
        { location: { contains: query.search, mode: "insensitive" } },
        { manufacturer: { contains: query.search, mode: "insensitive" } },
        { model: { contains: query.search, mode: "insensitive" } },
        { serialNumber: { contains: query.search, mode: "insensitive" } },
        { supplier: { contains: query.search, mode: "insensitive" } },
        { department: { contains: query.search, mode: "insensitive" } },
        { ownerName: { contains: query.search, mode: "insensitive" } }
      ];
      if (matchingCategories.length > 0) {
        where.OR.push({
          category: {
            in: matchingCategories
          }
        });
      }
    }

    return where;
  }

  private buildOrderBy(query: Pick<AssetListQueryDto, "sortBy" | "sortOrder">) {
    const sortBy = query.sortBy ?? "updatedAt";
    const sortOrder = query.sortOrder ?? "desc";

    return [
      { [sortBy]: sortOrder } as Prisma.AssetOrderByWithRelationInput,
      { updatedAt: "desc" as const }
    ];
  }

  private buildAssetMutationInput(data: Partial<CreateAssetDto>): AssetMutationInput {
    return {
      assetTag: data.assetTag ? data.assetTag.trim() : undefined,
      name: data.name ? data.name.trim() : undefined,
      description: this.toNullableString(data.description),
      category: data.category,
      condition: data.condition,
      status: data.status,
      purchaseDate: this.toNullableDate(data.purchaseDate),
      purchasePrice: this.toNullableNumber(data.purchasePrice),
      currentValue: this.toNullableNumber(data.currentValue),
      supplier: this.toNullableString(data.supplier),
      department: this.toNullableString(data.department),
      ownerName: this.toNullableString(data.ownerName),
      location: this.toNullableString(data.location),
      manufacturer: this.toNullableString(data.manufacturer),
      model: this.toNullableString(data.model),
      serialNumber: this.toNullableString(data.serialNumber),
      meterReading: this.toNullableNumber(data.meterReading),
      lastServiceDate: this.toNullableDate(data.lastServiceDate),
      nextServiceDate: this.toNullableDate(data.nextServiceDate),
      warrantyExpiry: this.toNullableDate(data.warrantyExpiry),
      disposalDate: this.toNullableDate(data.disposalDate),
      disposalReason: this.toNullableString(data.disposalReason)
    };
  }

  private buildAssetCreateInput(
    tenantId: string | null | undefined,
    data: CreateAssetDto | BulkImportAssetItemDto
  ): Prisma.AssetUncheckedCreateInput {
    return {
      tenantId: tenantId ?? null,
      assetTag: data.assetTag.trim(),
      name: data.name.trim(),
      category: data.category,
      condition: data.condition ?? AssetCondition.GOOD,
      status: data.status ?? AssetStatus.ACTIVE,
      description: this.toNullableString(data.description) ?? null,
      purchaseDate: this.toNullableDate(data.purchaseDate) ?? null,
      purchasePrice: this.toNullableNumber(data.purchasePrice) ?? null,
      currentValue: this.toNullableNumber(data.currentValue) ?? null,
      supplier: this.toNullableString(data.supplier) ?? null,
      department: this.toNullableString(data.department) ?? null,
      ownerName: this.toNullableString(data.ownerName) ?? null,
      location: this.toNullableString(data.location) ?? null,
      manufacturer: this.toNullableString(data.manufacturer) ?? null,
      model: this.toNullableString(data.model) ?? null,
      serialNumber: this.toNullableString(data.serialNumber) ?? null,
      meterReading: this.toNullableNumber(data.meterReading) ?? null,
      lastServiceDate: this.toNullableDate(data.lastServiceDate) ?? null,
      nextServiceDate: this.toNullableDate(data.nextServiceDate) ?? null,
      warrantyExpiry: this.toNullableDate(data.warrantyExpiry) ?? null,
      disposalDate: this.toNullableDate(data.disposalDate) ?? null,
      disposalReason: this.toNullableString(data.disposalReason) ?? null,
      archivedAt: null,
      images: [],
      documents: []
    };
  }

  private async ensureUniqueAssetTag(assetTag: string, excludeId?: string) {
    const existing = await this.prisma.asset.findUnique({
      where: { assetTag: assetTag.trim() }
    });

    if (existing && existing.id !== excludeId) {
      throw new BadRequestException("Asset tag must be unique across the system");
    }
  }

  private async requireAssetRecord(id: string, tenantId?: string | null) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {})
      }
    });

    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    return asset;
  }

  private validateStatusTransition(
    currentStatus: AssetStatus,
    nextStatus?: AssetStatus,
    disposalReason?: string
  ) {
    if (!nextStatus) {
      return;
    }

    if (nextStatus === AssetStatus.DISPOSED && !disposalReason?.trim()) {
      throw new BadRequestException("Disposal requires a disposal reason");
    }

    if (currentStatus === AssetStatus.UNDER_MAINTENANCE && nextStatus === AssetStatus.DISPOSED) {
      throw new BadRequestException("Cannot dispose an asset that is UNDER_MAINTENANCE");
    }
  }

  private async ensureNoOpenWorkOrders(id: string) {
    const openWorkOrders = await this.prisma.workOrder.count({
      where: {
        assetId: id,
        status: {
          in: [...OPEN_WORK_ORDER_STATUSES]
        }
      }
    });

    if (openWorkOrders > 0) {
      throw new BadRequestException("Cannot delete - asset has open work orders.");
    }
  }

  private async recordAudit(input: {
    tenantId?: string | null;
    actorId?: string | null;
    entityId: string;
    action: AuditAction;
    beforeData?: unknown;
    afterData?: unknown;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorId: input.actorId ?? null,
        entity: "ASSET",
        entityId: input.entityId,
        action: input.action,
        beforeData: this.toAuditJson(input.beforeData),
        afterData: this.toAuditJson(input.afterData)
      }
    });
  }

  private toAssetListItem(
    asset: Prisma.AssetGetPayload<{
      include: {
        workOrders: {
          select: {
            id: true;
          };
        };
        _count: {
          select: {
            maintenanceLogs: true;
            workOrders: true;
          };
        };
      };
    }>
  ) {
    const documents = this.parseDocuments(asset.documents, asset.id);

    return {
      ...asset,
      documents,
      isArchived: Boolean(asset.archivedAt),
      documentCount: documents.length,
      maintenanceLogCount: asset._count.maintenanceLogs,
      workOrderCount: asset._count.workOrders,
      openWorkOrderCount: asset.workOrders.length
    };
  }

  private parseDocuments(entries: string[], assetId: string): ParsedAssetDocument[] {
    return entries.map((entry, index) => {
      try {
        const parsed = JSON.parse(entry) as AssetDocumentRecord;
        return {
          ...parsed,
          downloadUrl: parsed.externalUrl
            ? parsed.externalUrl
            : `/assets/${assetId}/documents/${parsed.id}`
        };
      } catch {
        const fallbackId = `${assetId}-legacy-${index}`;
        const isExternalUrl = /^https?:\/\//i.test(entry);

        return {
          id: fallbackId,
          name: entry.split("/").pop() || `document-${index + 1}`,
          storedName: undefined,
          mimeType: undefined,
          size: undefined,
          uploadedAt: new Date(0).toISOString(),
          externalUrl: isExternalUrl ? entry : undefined,
          downloadUrl: isExternalUrl ? entry : undefined
        };
      }
    });
  }

  private serializeDocumentEntry(entry: string) {
    try {
      JSON.parse(entry);
      return entry;
    } catch {
      return JSON.stringify({
        id: randomUUID(),
        name: entry.split("/").pop() || entry,
        uploadedAt: new Date().toISOString(),
        externalUrl: entry
      } satisfies AssetDocumentRecord);
    }
  }

  private toDocumentStorageRecord(document: {
    id: string;
    name: string;
    storedName?: string;
    mimeType?: string;
    size?: number;
    uploadedAt: string;
    externalUrl?: string;
  }): AssetDocumentRecord {
    return {
      id: document.id,
      name: document.name,
      storedName: document.storedName,
      mimeType: document.mimeType,
      size: document.size,
      uploadedAt: document.uploadedAt,
      externalUrl: document.externalUrl
    };
  }

  private async cleanupDocumentFiles(entries: Array<{ storedName?: string } | string>) {
    const documents = entries.map((entry) =>
      typeof entry === "string" ? this.parseDocuments([entry], "temp")[0] : entry
    );

    for (const document of documents) {
      if (!document?.storedName) {
        continue;
      }

      try {
        await unlink(join(this.getDocumentDirectory(), document.storedName));
      } catch {
        // Ignore cleanup failures for already-missing files.
      }
    }
  }

  private getAssetScanUrl(assetId: string) {
    const frontendBaseUrl = (
      this.configService.get<string>("FRONTEND_URL") ?? "http://localhost:3001"
    ).replace(/\/$/, "");
    return `${frontendBaseUrl}/assets?assetId=${encodeURIComponent(assetId)}`;
  }

  private getDocumentDirectory() {
    return join(process.cwd(), "uploads", "asset-documents");
  }

  private async storeDocumentLocally(
    id: string,
    documentId: string,
    originalName: string,
    file: Express.Multer.File,
    uploadDirectory: string
  ): Promise<AssetDocumentRecord> {
    const extension = originalName.includes(".")
      ? originalName.slice(originalName.lastIndexOf("."))
      : "";
    const storedName = `${id}-${documentId}${extension}`;
    await writeFile(join(uploadDirectory, storedName), file.buffer);

    return {
      id: documentId,
      name: originalName,
      storedName,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString()
    };
  }

  private async uploadDocumentToCloudinary(
    id: string,
    documentId: string,
    originalName: string,
    file: Express.Multer.File
  ): Promise<AssetDocumentRecord | null> {
    const cloudName = this.getConfigValue("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.getConfigValue("CLOUDINARY_API_KEY");
    const apiSecret = this.getConfigValue("CLOUDINARY_API_SECRET");

    if (!cloudName || !apiKey || !apiSecret) {
      return null;
    }

    const folder = this.getConfigValue("CLOUDINARY_ASSET_FOLDER") || "maintainpro/asset-documents";
    const publicId = `${id}-${documentId}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signaturePayload = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHash("sha1").update(signaturePayload).digest("hex");
    const formData = new FormData();
    const fileBytes = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength
    ) as ArrayBuffer;

    formData.append(
      "file",
      new Blob([fileBytes], { type: file.mimetype || "application/octet-stream" }),
      originalName
    );
    formData.append("api_key", apiKey);
    formData.append("folder", folder);
    formData.append("public_id", publicId);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: "POST",
      body: formData
    });
    const body = (await response.json().catch(() => ({}))) as {
      bytes?: number;
      error?: { message?: string };
      secure_url?: string;
    };

    if (!response.ok || !body.secure_url) {
      throw new BadRequestException(body.error?.message ?? "Cloudinary upload failed");
    }

    return {
      id: documentId,
      name: originalName,
      mimeType: file.mimetype,
      size: body.bytes ?? file.size,
      uploadedAt: new Date().toISOString(),
      externalUrl: body.secure_url
    };
  }

  private getConfigValue(key: string) {
    return this.configService.get<string>(key)?.trim() ?? "";
  }

  private async buildAssetsPdfExport(headers: string[], rows: string[][]) {
    return await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 36 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      doc.on("error", reject);
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.fontSize(16).fillColor("#0f172a").text("Assets Export", { align: "left" });
      doc.moveDown(0.4);
      doc
        .fontSize(9)
        .fillColor("#64748b")
        .text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown(0.8);
      doc.fontSize(10).fillColor("#1e293b").text(headers.join(" | "));
      doc.moveDown(0.4);

      rows.forEach((row) => {
        if (doc.y > doc.page.height - 48) {
          doc.addPage();
        }
        doc.fontSize(8).fillColor("#334155").text(row.join(" | "));
      });

      doc.end();
    });
  }

  private matchCategoriesForSearch(search: string): AssetCategory[] {
    const token = search.trim().toLowerCase();
    if (!token) {
      return [];
    }

    const candidates: Array<{ label: string; value: AssetCategory }> = [
      { label: "machine", value: AssetCategory.MACHINE },
      { label: "equipment", value: AssetCategory.EQUIPMENT },
      { label: "vehicle", value: AssetCategory.VEHICLE },
      { label: "facility", value: AssetCategory.INFRASTRUCTURE },
      { label: "infrastructure", value: AssetCategory.INFRASTRUCTURE },
      { label: "tool", value: AssetCategory.TOOL },
      { label: "other", value: AssetCategory.OTHER }
    ];

    return Array.from(
      new Set(
        candidates
          .filter((candidate) =>
            candidate.label.includes(token) || token.includes(candidate.label)
          )
          .map((candidate) => candidate.value)
      )
    );
  }

  private toNullableString(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private toNullableDate(value?: string | Date | null) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === "") {
      return null;
    }
    return value instanceof Date ? value : new Date(value);
  }

  private toNullableNumber(value?: number | null) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || Number.isNaN(value)) {
      return null;
    }
    return value;
  }

  private toPositiveInt(value: unknown, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private toAuditJson(value: unknown) {
    if (value === undefined || value === null) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  private sanitizeFilename(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  }

  private escapeCsv(value: unknown) {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private timestampSlug() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }
}
