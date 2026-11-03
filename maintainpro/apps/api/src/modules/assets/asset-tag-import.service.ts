import { createHash } from "crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { parse as parseCsvSync } from "csv-parse/sync";
import ExcelJS from "exceljs";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import { previewAssetTagImport, type AssetTagImportRow, type AssetTagPreviewRow } from "./asset-tag-import";

const TEMPLATE_HEADERS = ["assetTag", "assetCode", "serialNumber", "erpCode", "vehicleRegistrationNo", "note"];

@Injectable()
export class AssetTagImportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  templateCsv() {
    return `${TEMPLATE_HEADERS.join(",")}\nAST-ABCD,,,,,\n`;
  }

  async templateXlsx() {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("asset-tags").addRow(TEMPLATE_HEADERS);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(tenantId: string | null, file: { originalname?: string; buffer: Buffer }) {
    const rows = await this.parseFile(file);
    const candidates = await this.candidates(requireTenantId(tenantId));
    return previewAssetTagImport(rows, candidates);
  }

  async apply(
    tenantId: string | null,
    actorId: string,
    file: { originalname?: string; buffer: Buffer },
    options: { allowReplace?: boolean; replaceReason?: string; actorEmail?: string }
  ) {
    const scopedTenantId = requireTenantId(tenantId);
    const preview = await this.preview(scopedTenantId, file);
    const reason = options.replaceReason?.trim() ?? "";
    if (preview.some((row) => row.action === "replace") && (!options.allowReplace || reason.length < 3)) {
      throw new BadRequestException("Replacing an existing asset tag requires Allow replace and a reason.");
    }
    const applied = await this.prisma.$transaction(async (tx) => {
      const changed: AssetTagPreviewRow[] = [];
      for (const row of preview) {
        if (row.status !== "valid" || !row.entityId || row.action === "skip") continue;
        if (row.action === "unchanged") {
          changed.push(row);
          continue;
        }
        if (row.entityKind === "vehicle") {
          const current = await tx.vehicle.findFirst({
            where: { id: row.entityId, tenantId: scopedTenantId },
            select: { assetTag: true }
          });
          if (!current) continue;
          if ((current.assetTag ?? "").toUpperCase() === row.assetTag) {
            changed.push({ ...row, action: "unchanged", message: "Already applied." });
            continue;
          }
          await tx.vehicle.update({ where: { id: row.entityId }, data: { assetTag: row.assetTag } });
        } else {
          const current = await tx.asset.findFirst({
            where: { id: row.entityId, tenantId: scopedTenantId },
            select: { assetTag: true }
          });
          if (!current) continue;
          if (current.assetTag.toUpperCase() === row.assetTag) {
            changed.push({ ...row, action: "unchanged", message: "Already applied." });
            continue;
          }
          await tx.asset.update({ where: { id: row.entityId }, data: { assetTag: row.assetTag } });
        }
        await tx.auditLog.create({
          data: {
            tenantId: scopedTenantId,
            actorId,
            entity: row.entityKind === "vehicle" ? "VEHICLE" : "ASSET",
            entityId: row.entityId,
            action: AuditAction.UPDATE,
            beforeData: JSON.stringify({ assetTag: row.previousTag ?? null }),
            afterData: JSON.stringify({ assetTag: row.assetTag, reason: reason || null })
          }
        });
        changed.push(row);
      }
      await tx.bulkImportRun.create({
        data: {
          tenantId: scopedTenantId,
          entityType: "asset-tag",
          mode: "update",
          status: "COMMITTED",
          originalFilename: file.originalname ?? "asset-tags.csv",
          fileFormat: String(file.originalname ?? "").toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv",
          fileSha256: createHash("sha256").update(file.buffer).digest("hex"),
          fileSizeBytes: file.buffer.length,
          actorUserId: actorId,
          actorEmail: options.actorEmail || actorId,
          totalRows: preview.length,
          updateCount: changed.filter((row) => row.action === "assign" || row.action === "replace").length,
          skipCount: changed.filter((row) => row.action === "unchanged").length,
          errorCount: preview.filter((row) => row.status === "invalid").length,
          committedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      return changed;
    });
    return {
      applied,
      invalid: preview.filter((row) => row.status === "invalid"),
      printableTags: applied.filter((row) => row.action !== "skip").map((row) => row.assetTag)
    };
  }

  errorCsv(rows: AssetTagPreviewRow[]) {
    const lines = ["rowNumber,assetTag,matchTarget,message", ...rows.map((row) =>
      [row.rowNumber, row.assetTag, row.matchTarget, row.message].map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(",")
    )];
    return lines.join("\n");
  }

  private async candidates(tenantId: string) {
    const [assets, vehicles] = await Promise.all([
      this.prisma.asset.findMany({
        where: { tenantId },
        select: { id: true, assetTag: true, name: true, serialNumber: true, fixedAssetCode: true }
      }),
      this.prisma.vehicle.findMany({
        where: { tenantId },
        select: { id: true, assetTag: true, registrationNo: true }
      })
    ]);
    return [
      ...assets.map((asset) => ({
        id: asset.id,
        kind: "asset" as const,
        label: asset.name,
        assetTag: asset.assetTag,
        assetCode: asset.assetTag,
        serialNumber: asset.serialNumber,
        erpCode: asset.fixedAssetCode
      })),
      ...vehicles.map((vehicle) => ({
        id: vehicle.id,
        kind: "vehicle" as const,
        label: vehicle.registrationNo,
        assetTag: vehicle.assetTag,
        registrationNo: vehicle.registrationNo
      }))
    ];
  }

  private async parseFile(file: { originalname?: string; buffer: Buffer }): Promise<AssetTagImportRow[]> {
    const name = String(file.originalname ?? "").toLowerCase();
    const records = name.endsWith(".xlsx") ? await this.readXlsx(file.buffer) : this.readCsv(file.buffer);
    return records.map((record, index) => ({
      rowNumber: index + 2,
      assetTag: String(record.assettag ?? record.assettag ?? ""),
      assetCode: String(record.assetcode ?? ""),
      serialNumber: String(record.serialnumber ?? ""),
      erpCode: String(record.erpcode ?? ""),
      vehicleRegistrationNo: String(record.vehicleregistrationno ?? ""),
      note: String(record.note ?? "")
    }));
  }

  private readCsv(buffer: Buffer) {
    const rows = parseCsvSync(buffer, { columns: true, skip_empty_lines: true, bom: true }) as Record<string, unknown>[];
    return rows.map((row) => this.normalizeRecord(row));
  }

  private async readXlsx(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    const header = (sheet.getRow(1).values as unknown[]).slice(1).map((value) => this.headerKey(value));
    const records: Record<string, string>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = (row.values as unknown[]).slice(1);
      const record: Record<string, string> = {};
      header.forEach((column, index) => {
        record[column] = String(values[index] ?? "");
      });
      records.push(record);
    });
    return records;
  }

  private normalizeRecord(row: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(row).map(([name, value]) => [this.headerKey(name), String(value ?? "")]));
  }

  private headerKey(value: unknown) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }
}
