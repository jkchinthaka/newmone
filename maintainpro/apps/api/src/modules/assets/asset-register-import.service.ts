import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import ExcelJS from "exceljs";

import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";
import {
  ASSET_IMPORT_COLUMNS,
  ASSET_IMPORT_CRITICALITIES,
  ASSET_IMPORT_MAX_ROWS,
  ASSET_IMPORT_SAVE_CHUNK,
  autoTagPrefixes,
  importLookupKeys,
  planAssetImport,
  saveOrder,
  type AssetImportLine,
  type AssetImportMasterData,
  type AssetImportRowInput
} from "./asset-register-import";
import { AssetsService } from "./assets.service";
import type { CreateAssetDto, UpdateAssetDto } from "./dto/assets.dto";

type Actor = Pick<JwtPayload, "sub" | "tenantId"> & Partial<Pick<JwtPayload, "email" | "role">>;

export type AssetImportSaveResult = {
  row: number;
  status: "CREATED" | "UPDATED" | "SKIPPED" | "ERROR";
  assetId?: string;
  assetTag: string;
  name: string;
  message?: string;
};

/** SQL Server allows about 2,100 parameters per query; look values up in slices. */
const LOOKUP_SLICE = 500;

const STATUS_LABELS = ["Draft", "Active", "Inactive", "Under maintenance", "Out of service"];

function slices<T>(values: T[], size = LOOKUP_SLICE): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += size) out.push(values.slice(index, index + size));
  return out;
}

function readRows(raw: unknown, max: number): AssetImportRowInput[] {
  if (!Array.isArray(raw)) throw new BadRequestException("No rows were sent.");
  if (raw.length === 0) throw new BadRequestException("The file has no asset rows.");
  if (raw.length > max) {
    throw new BadRequestException(`A file can have up to ${max} assets. Split it into smaller files (for example one per site).`);
  }
  return raw.map((entry, index) => {
    const row = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const out: AssetImportRowInput = { row: Number(row.row) || index + 2, autoTag: row.autoTag === true };
    for (const column of ASSET_IMPORT_COLUMNS) {
      const value = row[column.key];
      if (value !== undefined && value !== null) (out as Record<string, unknown>)[column.key] = String(value).slice(0, 1000);
    }
    return out;
  });
}

/**
 * Whole-company asset register from Excel: template with drop-downs, preview, save.
 * Rows are checked against the master data (no auto-created sites, locations, departments or
 * categories) and saved one by one through AssetsService, so each asset gets the same checks,
 * QR code and audit entry as one added on the form.
 */
@Injectable()
export class AssetRegisterImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssetsService) private readonly assets: AssetsService
  ) {}

  async preview(actor: Actor, rawRows: unknown, options: { updateExisting?: boolean } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    const rows = readRows(rawRows, ASSET_IMPORT_MAX_ROWS);
    const plan = planAssetImport(rows, await this.masterData(tenantId, rows), options);
    // The browser needs what to show, not the resolved ids.
    return {
      ...plan,
      lines: plan.lines.map(({ payload: _payload, ...line }) => line)
    };
  }

  async save(actor: Actor, rawRows: unknown, options: { updateExisting?: boolean } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    const rows = readRows(rawRows, ASSET_IMPORT_SAVE_CHUNK);
    // Checked again on save: master data or assets may have changed since the preview.
    const plan = planAssetImport(rows, await this.masterData(tenantId, rows), options);
    const createdByTag = new Map<string, string>();
    const results: AssetImportSaveResult[] = [];

    for (const line of saveOrder(plan.lines)) {
      const base = { row: line.row, assetTag: line.assetTag, name: line.name };
      if (line.status === "ERROR" || !line.payload) {
        results.push({ ...base, status: "ERROR", message: line.messages.join(" ") });
        continue;
      }
      if (line.status === "SKIP") {
        results.push({ ...base, status: "SKIPPED", assetId: line.existingAssetId, message: line.messages.join(" ") });
        continue;
      }
      const payload = { ...line.payload };
      if (line.parentRowTag) {
        const parentId = createdByTag.get(line.parentRowTag);
        if (!parentId) {
          results.push({ ...base, status: "ERROR", message: `Parent ${line.parentRowTag} was not saved.` });
          continue;
        }
        payload.parentAssetId = parentId;
      }
      try {
        if (line.status === "NEW") {
          const created = (await this.assets.create(tenantId, actor.sub, payload as unknown as CreateAssetDto)) as { id: string; assetTag: string };
          createdByTag.set(created.assetTag.toUpperCase(), created.id);
          results.push({ ...base, status: "CREATED", assetId: created.id, assetTag: created.assetTag });
        } else {
          await this.assets.update(line.existingAssetId!, tenantId, actor.sub, this.updateBody(payload));
          results.push({ ...base, status: "UPDATED", assetId: line.existingAssetId, message: line.warnings.join(" ") || undefined });
        }
      } catch (error) {
        results.push({ ...base, status: "ERROR", message: error instanceof Error ? error.message : "Could not be saved." });
      }
    }

    const counts = { created: 0, updated: 0, skipped: 0, errors: 0 };
    for (const result of results) {
      if (result.status === "CREATED") counts.created += 1;
      else if (result.status === "UPDATED") counts.updated += 1;
      else if (result.status === "SKIPPED") counts.skipped += 1;
      else counts.errors += 1;
    }
    await this.prisma.auditLog
      .create({
        data: {
          tenantId,
          actorId: actor.sub,
          action: AuditAction.CREATE,
          module: "assets",
          entity: "AssetRegisterImport",
          entityId: `rows-${rows[0]?.row ?? 0}-${rows[rows.length - 1]?.row ?? 0}`,
          reason: "Asset register Excel import",
          metadata: JSON.stringify({ ...counts, updateExisting: Boolean(options.updateExisting) })
        }
      })
      .catch(() => undefined);
    results.sort((left, right) => left.row - right.row);
    return { results, counts };
  }

  /** Update only what the file fills in; tag, site, location and status stay as they are. */
  private updateBody(payload: NonNullable<AssetImportLine["payload"]>): UpdateAssetDto {
    const body: Record<string, unknown> = {};
    const keep = [
      "name",
      "category",
      "domainId",
      "categoryMasterId",
      "typeMasterId",
      "departmentId",
      "serialNumber",
      "manufacturer",
      "model",
      "criticalityLevel",
      "parentAssetId",
      "fixedAssetCode",
      "purchaseDate",
      "purchasePrice",
      "warrantyExpiry",
      "supplier",
      "responsiblePersonId",
      "description"
    ] as const;
    for (const key of keep) {
      const value = payload[key];
      if (value !== undefined && value !== null && value !== "") body[key] = value;
    }
    return body as UpdateAssetDto;
  }

  private async masterData(tenantId: string, rows: AssetImportRowInput[]): Promise<AssetImportMasterData> {
    const keys = importLookupKeys(rows);
    const [sites, locations, departments, domains, categories, types, users, taken] = await Promise.all([
      this.prisma.site.findMany({ where: { tenantId, isActive: true }, select: { id: true, code: true, name: true } }),
      this.prisma.functionalLocation.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, code: true, name: true, siteId: true }
      }),
      this.prisma.department.findMany({ where: { tenantId, isActive: true }, select: { id: true, code: true, name: true } }),
      this.prisma.assetDomain.findMany({ where: { tenantId, isActive: true }, select: { id: true, code: true, name: true } }),
      this.prisma.assetCategoryMaster.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, code: true, name: true, domainId: true, legacyEnum: true }
      }),
      this.prisma.assetTypeMaster.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, code: true, name: true, categoryId: true }
      }),
      this.prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, email: true, firstName: true, lastName: true }
      }),
      this.prisma.asset.findMany({
        where: { tenantId, OR: autoTagPrefixes().map((prefix) => ({ assetTag: { startsWith: prefix } })) },
        select: { assetTag: true }
      })
    ]);

    const existingSelect = {
      id: true,
      assetTag: true,
      name: true,
      serialNumber: true,
      fixedAssetCode: true,
      siteId: true,
      functionalLocationId: true
    } as const;
    const existing = new Map<string, AssetImportMasterData["existing"][number]>();
    const lookups = [
      ...slices(keys.tags).map((part) => ({ assetTag: { in: part } })),
      ...slices(keys.serials).map((part) => ({ serialNumber: { in: part } })),
      ...slices(keys.fixedAssetCodes).map((part) => ({ fixedAssetCode: { in: part } }))
    ];
    for (const where of lookups) {
      const found = await this.prisma.asset.findMany({ where: { tenantId, ...where }, select: existingSelect });
      for (const asset of found) existing.set(asset.id, asset);
    }

    return {
      sites,
      locations,
      departments,
      domains,
      categories,
      types,
      users: users.map((user) => ({ id: user.id, email: user.email, name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() })),
      existing: Array.from(existing.values()),
      takenTags: taken.map((asset) => asset.assetTag)
    };
  }

  /** Excel template: an Assets sheet with drop-downs fed from this company's master data. */
  async template(actor: Actor): Promise<Buffer> {
    const tenantId = requireTenantId(actor.tenantId);
    const data = await this.masterData(tenantId, []);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MaintainPro";

    const sheet = workbook.addWorksheet("Assets", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = ASSET_IMPORT_COLUMNS.map((column) => ({
      header: column.required ? `${column.header} *` : column.header,
      key: column.key,
      width: Math.max(14, column.header.length + 6)
    }));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
    header.height = 22;

    const groupById = new Map(data.domains.map((domain) => [domain.id, domain.name]));
    const siteById = new Map(data.sites.map((site) => [site.id, site]));
    const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const lists: Record<string, string[]> = {
      assetGroup: unique(data.domains.map((domain) => domain.name)),
      category: unique(data.categories.map((category) => category.name)),
      type: unique(data.types.map((type) => type.name)),
      site: unique(data.sites.map((site) => site.name)),
      functionalLocation: unique(data.locations.map((location) => `${location.code} — ${location.name}`)),
      department: unique(data.departments.map((department) => department.name)),
      criticality: ASSET_IMPORT_CRITICALITIES.map((value) => value.charAt(0) + value.slice(1).toLowerCase()),
      status: STATUS_LABELS
    };

    const listSheet = workbook.addWorksheet("Lists");
    const listKeys = Object.keys(lists);
    listKeys.forEach((key, index) => {
      const column = listSheet.getColumn(index + 1);
      column.width = 30;
      listSheet.getCell(1, index + 1).value = ASSET_IMPORT_COLUMNS.find((entry) => entry.key === key)?.header ?? key;
      listSheet.getCell(1, index + 1).font = { bold: true };
      lists[key].forEach((value, row) => {
        listSheet.getCell(row + 2, index + 1).value = value;
      });
    });

    const lastRow = ASSET_IMPORT_MAX_ROWS + 1;
    // Range validations (one rule per column, not one per cell). Present in exceljs 4.x, missing from its typings.
    const validations = (sheet as unknown as { dataValidations: { add(range: string, rule: ExcelJS.DataValidation): void } })
      .dataValidations;
    listKeys.forEach((key, index) => {
      const values = lists[key];
      if (!values.length) return;
      const letter = listSheet.getColumn(index + 1).letter;
      const columnIndex = ASSET_IMPORT_COLUMNS.findIndex((entry) => entry.key === key) + 1;
      const columnLetter = sheet.getColumn(columnIndex).letter;
      // Drop-down to choose from; other text is still allowed (it is checked on upload).
      validations.add(`${columnLetter}2:${columnLetter}${lastRow}`, {
        type: "list",
        allowBlank: true,
        formulae: [`Lists!$${letter}$2:$${letter}$${values.length + 1}`],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Not in the list",
        error: "This value is not in the list. It will be checked when you upload the file."
      });
    });
    for (const key of ["purchaseDate", "warrantyExpiry"]) {
      const columnIndex = ASSET_IMPORT_COLUMNS.findIndex((entry) => entry.key === key) + 1;
      sheet.getColumn(columnIndex).numFmt = "yyyy-mm-dd";
    }

    const categories = workbook.addWorksheet("Groups and categories");
    categories.columns = [
      { header: "Asset group", key: "group", width: 28 },
      { header: "Category", key: "category", width: 28 },
      { header: "Types", key: "types", width: 60 }
    ];
    categories.getRow(1).font = { bold: true };
    for (const category of [...data.categories].sort((a, b) =>
      `${groupById.get(a.domainId)}${a.name}`.localeCompare(`${groupById.get(b.domainId)}${b.name}`)
    )) {
      categories.addRow({
        group: groupById.get(category.domainId) ?? "",
        category: category.name,
        types: data.types.filter((type) => type.categoryId === category.id).map((type) => type.name).join(", ")
      });
    }

    const places = workbook.addWorksheet("Sites and locations");
    places.columns = [
      { header: "Site", key: "site", width: 28 },
      { header: "Location code", key: "code", width: 18 },
      { header: "Location name", key: "name", width: 40 }
    ];
    places.getRow(1).font = { bold: true };
    for (const location of data.locations) {
      places.addRow({ site: siteById.get(location.siteId)?.name ?? "", code: location.code, name: location.name });
    }

    const help = workbook.addWorksheet("How to fill");
    help.getColumn(1).width = 110;
    [
      "How to fill the Assets sheet",
      "",
      "• One row = one asset. Columns with * must be filled: Asset group, Category, Name, Site.",
      "• Choose Asset group, Category, Type, Site, Functional location, Department, Criticality and Status from the drop-downs.",
      "• Category must belong to the Asset group (see 'Groups and categories'). Location must be at the Site (see 'Sites and locations').",
      "• Asset tag: leave empty and MaintainPro gives the next number (e.g. AST-MCH0012). You can change it before saving.",
      "• Parent asset tag: the tag of the asset this one is part of (e.g. a motor that is part of a production line).",
      "• Dates: 2024-03-15 or 15/03/2024. Purchase price: numbers only.",
      "• Responsible person: their MaintainPro login email.",
      "• Status: leave empty to save as Draft (a manager approves it later).",
      `• Up to ${ASSET_IMPORT_MAX_ROWS} assets per file. For the whole company, upload one site or department at a time.`,
      "• Names that are not in MaintainPro (site, location, department, category) are shown as errors with a suggestion; add them in MaintainPro first."
    ].forEach((line, index) => {
      help.getCell(index + 1, 1).value = line;
      if (index === 0) help.getCell(1, 1).font = { bold: true, size: 14 };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
