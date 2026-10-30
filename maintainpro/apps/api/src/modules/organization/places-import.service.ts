import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { FunctionalLocationType, SiteType } from "@prisma/client";
import ExcelJS from "exceljs";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { OrganizationService } from "./organization.service";
import {
  LOCATION_TYPE_VALUES,
  PLACES_IMPORT_COLUMNS,
  PLACES_IMPORT_MAX_ROWS,
  SITE_TYPE_VALUES,
  planPlacesImport,
  placesSaveOrder,
  type PlacesRowInput
} from "./places-import";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type PlacesSaveResult = { row: number; status: "CREATED" | "SKIPPED" | "ERROR"; message?: string };

const label = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");

function readRows(raw: unknown): PlacesRowInput[] {
  if (!Array.isArray(raw)) throw new BadRequestException("No rows were sent.");
  if (raw.length === 0) throw new BadRequestException("The file has no rows.");
  if (raw.length > PLACES_IMPORT_MAX_ROWS) {
    throw new BadRequestException(`A file can have up to ${PLACES_IMPORT_MAX_ROWS} rows. Split it (for example one file per site).`);
  }
  return raw.map((entry, index) => {
    const row = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const out: PlacesRowInput = { row: Number(row.row) || index + 2 };
    for (const column of PLACES_IMPORT_COLUMNS) {
      const value = row[column.key];
      if (value !== undefined && value !== null) (out as Record<string, unknown>)[column.key] = String(value).slice(0, 300);
    }
    return out;
  });
}

/**
 * Sites and functional locations from Excel (template, preview, save). Saves through
 * OrganizationService so codes, parents and audit work exactly as on the screen.
 */
@Injectable()
export class PlacesImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrganizationService) private readonly organization: OrganizationService
  ) {}

  private async existing(tenantId: string) {
    const [sites, locations] = await Promise.all([
      this.prisma.site.findMany({ where: { tenantId }, select: { id: true, code: true, name: true, isActive: true, type: true } }),
      this.prisma.functionalLocation.findMany({
        where: { tenantId },
        select: { id: true, siteId: true, code: true, name: true, isActive: true }
      })
    ]);
    return { sites, locations };
  }

  async preview(actor: Actor, rawRows: unknown) {
    const tenantId = requireTenantId(actor.tenantId);
    return planPlacesImport(readRows(rawRows), await this.existing(tenantId));
  }

  async save(actor: Actor, rawRows: unknown) {
    const tenantId = requireTenantId(actor.tenantId);
    const plan = planPlacesImport(readRows(rawRows), await this.existing(tenantId));
    const results = new Map<number, PlacesSaveResult>();
    const siteIdByCode = new Map<string, string>();
    for (const line of plan.lines) {
      if (line.site.existingId) siteIdByCode.set(line.site.code, line.site.existingId);
      if (line.status === "ERROR") results.set(line.row, { row: line.row, status: "ERROR", message: line.messages.join(" ") });
      else if (line.status === "SKIP") results.set(line.row, { row: line.row, status: "SKIPPED", message: line.messages.join(" ") });
    }

    // Sites first.
    for (const line of plan.lines.filter((entry) => entry.creates.site)) {
      try {
        const site = await this.organization.createSite(
          tenantId,
          { code: line.site.code, name: line.site.name, type: line.site.type as SiteType },
          actor
        );
        if (site) siteIdByCode.set(line.site.code, site.id);
        results.set(line.row, { row: line.row, status: "CREATED" });
      } catch (error) {
        results.set(line.row, { row: line.row, status: "ERROR", message: error instanceof Error ? error.message : "Site could not be saved." });
      }
    }

    // Then locations, parents before children.
    const locationIdByKey = new Map<string, string>();
    for (const line of placesSaveOrder(plan.lines)) {
      const location = line.location!;
      const siteId = siteIdByCode.get(line.site.code);
      const parentId = location.parentCode
        ? location.parentExistingId ?? locationIdByKey.get(`${line.site.code}::${location.parentCode}`)
        : null;
      if (!siteId || (location.parentCode && !parentId)) {
        results.set(line.row, { row: line.row, status: "ERROR", message: !siteId ? `Site ${line.site.code} was not saved.` : `Parent ${location.parentCode} was not saved.` });
        continue;
      }
      try {
        const created = await this.organization.createLocation(
          tenantId,
          { siteId, parentId, code: location.code, name: location.name, type: location.type as FunctionalLocationType },
          actor
        );
        if (created) locationIdByKey.set(`${line.site.code}::${location.code}`, created.id);
        results.set(line.row, { row: line.row, status: "CREATED" });
      } catch (error) {
        results.set(line.row, { row: line.row, status: "ERROR", message: error instanceof Error ? error.message : "Location could not be saved." });
      }
    }

    const list = Array.from(results.values()).sort((left, right) => left.row - right.row);
    return {
      results: list,
      counts: {
        created: list.filter((entry) => entry.status === "CREATED").length,
        skipped: list.filter((entry) => entry.status === "SKIPPED").length,
        errors: list.filter((entry) => entry.status === "ERROR").length
      }
    };
  }

  /** Excel template: a Places sheet with type drop-downs and the sites already in MaintainPro. */
  async template(actor: Actor): Promise<Buffer> {
    const tenantId = requireTenantId(actor.tenantId);
    const { sites, locations } = await this.existing(tenantId);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MaintainPro";

    const sheet = workbook.addWorksheet("Places", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = PLACES_IMPORT_COLUMNS.map((column) => ({
      header: column.required ? `${column.header} *` : column.header,
      key: column.key,
      width: Math.max(16, column.header.length + 6)
    }));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };

    const lists = workbook.addWorksheet("Lists");
    lists.getCell(1, 1).value = "Site type";
    lists.getCell(1, 2).value = "Location type";
    lists.getRow(1).font = { bold: true };
    SITE_TYPE_VALUES.forEach((value, index) => (lists.getCell(index + 2, 1).value = label(value)));
    LOCATION_TYPE_VALUES.forEach((value, index) => (lists.getCell(index + 2, 2).value = label(value)));
    lists.getColumn(1).width = 20;
    lists.getColumn(2).width = 22;

    const validations = (sheet as unknown as { dataValidations: { add(range: string, rule: ExcelJS.DataValidation): void } }).dataValidations;
    const lastRow = PLACES_IMPORT_MAX_ROWS + 1;
    validations.add(`C2:C${lastRow}`, {
      type: "list",
      allowBlank: true,
      formulae: [`Lists!$A$2:$A$${SITE_TYPE_VALUES.length + 1}`],
      showErrorMessage: true,
      errorStyle: "warning",
      error: "Choose a site type from the list."
    });
    validations.add(`F2:F${lastRow}`, {
      type: "list",
      allowBlank: true,
      formulae: [`Lists!$B$2:$B$${LOCATION_TYPE_VALUES.length + 1}`],
      showErrorMessage: true,
      errorStyle: "warning",
      error: "Choose a location type from the list."
    });

    const current = workbook.addWorksheet("Already in MaintainPro");
    current.columns = [
      { header: "Site code", key: "siteCode", width: 16 },
      { header: "Site name", key: "siteName", width: 28 },
      { header: "Location code", key: "code", width: 18 },
      { header: "Location name", key: "name", width: 32 }
    ];
    current.getRow(1).font = { bold: true };
    const siteById = new Map(sites.map((site) => [site.id, site]));
    for (const site of sites) current.addRow({ siteCode: site.code, siteName: site.name });
    for (const location of locations) {
      const site = siteById.get(location.siteId);
      current.addRow({ siteCode: site?.code ?? "", siteName: site?.name ?? "", code: location.code, name: location.name });
    }

    const help = workbook.addWorksheet("How to fill");
    help.getColumn(1).width = 110;
    [
      "How to fill the Places sheet",
      "",
      "• One row per location. Put the site code and site name on every row (copy them down).",
      "• A row with only Site code and Site name adds the site without locations.",
      "• Site code: short and fixed, e.g. MP, KD-OUT. Sites already in MaintainPro are matched by code and not changed.",
      "• Location code must be unique inside its site, e.g. BH-01. Locations already there are skipped.",
      "• Parent location code: the location this one is inside (e.g. a room inside a building). Leave empty for top level.",
      "• Types: choose from the drop-down. Empty site type = Other, empty location type = Area.",
      `• Up to ${PLACES_IMPORT_MAX_ROWS} rows per file.`
    ].forEach((line, index) => {
      help.getCell(index + 1, 1).value = line;
      if (index === 0) help.getCell(1, 1).font = { bold: true, size: 14 };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
