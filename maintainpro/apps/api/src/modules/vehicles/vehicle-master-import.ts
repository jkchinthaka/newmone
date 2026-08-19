import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  FuelType,
  Prisma,
  PrismaClient,
  VehicleOwnershipType,
  VehicleStatus,
  VehicleType
} from "@prisma/client";
import ExcelJS from "exceljs";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { normalizeRegistrationNo } from "../../common/utils/vehicle-registration";

export const VEHICLE_MASTER_SHEET = "Vehicle_Master_Import";
export const VEHICLE_IMPORT_SOURCE = "IT_MANAGER_VEHICLE_MASTER";

export type ImportSeverity = "ERROR" | "WARNING" | "INFO";

export type VehicleImportIssue = {
  severity: ImportSeverity;
  code: string;
  message: string;
  field?: string;
};

export type VehicleMasterSourceRow = Record<string, unknown>;

export type MappedVehicleImport = {
  rowNumber: number;
  registrationNo: string;
  normalizedRegistration: string;
  assetTag: string | null;
  make: string;
  vehicleModel: string;
  description: string | null;
  location: string | null;
  departmentCode: string | null;
  year: number;
  type: VehicleType;
  ownershipType: VehicleOwnershipType;
  status: VehicleStatus;
  color: string | null;
  vin: string | null;
  engineNo: string | null;
  fuelType: FuelType;
  fuelCapacity: number | null;
  currentMileage: number;
  serviceIntervalDays: number | null;
  serviceIntervalMileage: number | null;
  lastServiceDate: Date | null;
  nextServiceDate: Date | null;
  nextServiceMileage: number | null;
  acquisitionDate: Date | null;
  purchasePrice: number | null;
  insuranceExpiry: Date | null;
  roadTaxExpiry: Date | null;
  vendorName: string | null;
  customFields: Record<string, unknown>;
  issues: VehicleImportIssue[];
  action: "CREATE" | "UPDATE" | "REJECT";
  existingVehicleId?: string;
};

export type VehicleImportPreview = {
  batchId: string;
  sourcePath: string;
  sourceChecksum: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  rejectedRows: number;
  newVehicles: number;
  existingVehiclesToUpdate: number;
  duplicateRegistrations: number;
  duplicateVins: number;
  unknownStatus: number;
  unknownFuel: number;
  missingMake: number;
  missingYear: number;
  invalidDates: number;
  unresolvedDepartment: number;
  namedAssetOrEquipment: number;
  gateHistoryImport: "DEFERRED_INSUFFICIENT_DATA";
  rows: MappedVehicleImport[];
};

function cellString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    // Never convert large source IDs via float — prefer workbook text.
    if (Math.abs(value) >= 1e12) {
      return String(value);
    }
    return String(value);
  }
  return String(value).trim();
}

function nullableString(value: unknown): string | null {
  const t = cellString(value).trim();
  if (!t || t.toUpperCase() === "NULL" || t === "0") return null;
  return t;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = cellString(value).replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: unknown): { date: Date | null; invalid: boolean; raw: string | null } {
  if (value == null || value === "") {
    return { date: null, invalid: false, raw: null };
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: value, invalid: false, raw: value.toISOString() };
  }
  const raw = cellString(value);
  if (!raw || raw === "0") {
    return { date: null, invalid: false, raw: null };
  }
  // Explicit common formats: ISO, MM/DD/YYYY, DD/MM/YYYY (ambiguous → keep raw if parse fails)
  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) {
    return { date: new Date(iso), invalid: false, raw };
  }
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    // Prefer MDY when first > 12 is impossible; otherwise assume MDY for this workbook.
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    const d = new Date(Date.UTC(y, month - 1, day));
    if (!Number.isNaN(d.getTime())) {
      return { date: d, invalid: false, raw };
    }
  }
  return { date: null, invalid: true, raw };
}

function parseYear(value: unknown): number | null {
  const n = parseNumber(value);
  if (n == null) return null;
  const y = Math.trunc(n);
  if (y < 1950 || y > 2100) return null;
  return y;
}

export function mapFuelTypeSafe(raw: unknown): { fuelType: FuelType; warning?: VehicleImportIssue } {
  const f = cellString(raw).toUpperCase();
  if (!f || f === "NOT STATED" || f === "UNKNOWN" || f === "N/A" || f === "NA") {
    return {
      fuelType: FuelType.UNKNOWN,
      warning: {
        severity: "WARNING",
        code: "UNKNOWN_FUEL",
        message: "Fuel type blank or not stated; stored as UNKNOWN (not DIESEL).",
        field: "FuelType"
      }
    };
  }
  if (f.includes("PETROL") || f.includes("GASOLINE")) return { fuelType: FuelType.PETROL };
  if (f.includes("DIESEL")) return { fuelType: FuelType.DIESEL };
  if (f.includes("ELECTRIC")) return { fuelType: FuelType.ELECTRIC };
  if (f.includes("HYBRID")) return { fuelType: FuelType.HYBRID };
  if (f.includes("CNG")) return { fuelType: FuelType.CNG };
  if (f.includes("LPG")) return { fuelType: FuelType.LPG };
  return {
    fuelType: FuelType.UNKNOWN,
    warning: {
      severity: "WARNING",
      code: "UNKNOWN_FUEL",
      message: `Unrecognized fuel '${f}'; stored as UNKNOWN.`,
      field: "FuelType"
    }
  };
}

export function mapStatusSafe(raw: unknown): {
  status: VehicleStatus | null;
  warning?: VehicleImportIssue;
  error?: VehicleImportIssue;
} {
  const s = cellString(raw).trim();
  const key = s.toUpperCase().replace(/\s+/g, "_");
  const aliases: Record<string, VehicleStatus> = {
    AVAILABLE: VehicleStatus.AVAILABLE,
    IN_USE: VehicleStatus.IN_USE,
    UNDER_MAINTENANCE: VehicleStatus.UNDER_MAINTENANCE,
    NOT_AVAILABLE: VehicleStatus.OUT_OF_SERVICE,
    OUT_OF_SERVICE: VehicleStatus.OUT_OF_SERVICE,
    INACTIVE: VehicleStatus.OUT_OF_SERVICE,
    DISPOSED: VehicleStatus.DISPOSED
  };
  if (aliases[key]) {
    return { status: aliases[key] };
  }
  const lower = s.toLowerCase();
  if (lower.includes("inactive")) return { status: VehicleStatus.OUT_OF_SERVICE };
  if (lower.includes("dispos")) return { status: VehicleStatus.DISPOSED };
  if (lower.includes("maint")) return { status: VehicleStatus.UNDER_MAINTENANCE };
  if (lower.includes("not available") || lower === "not available") {
    return { status: VehicleStatus.OUT_OF_SERVICE };
  }
  if (lower.includes("in use") || lower === "in_use") return { status: VehicleStatus.IN_USE };
  if (lower.includes("available") || lower === "") {
    return {
      status: VehicleStatus.AVAILABLE,
      warning: lower === ""
        ? {
            severity: "WARNING",
            code: "UNKNOWN_STATUS",
            message: "Blank status defaulted to AVAILABLE for review.",
            field: "Status"
          }
        : undefined
    };
  }
  return {
    status: null,
    error: {
      severity: "ERROR",
      code: "UNKNOWN_STATUS",
      message: `Unrecognized status '${s}' — rejected (not marked AVAILABLE).`,
      field: "Status"
    }
  };
}

export function mapVehicleTypeSafe(raw: unknown): VehicleType {
  const g = cellString(raw).toUpperCase();
  if (Object.values(VehicleType).includes(g as VehicleType)) {
    return g as VehicleType;
  }
  const lower = g.toLowerCase();
  if (lower.includes("bike") || lower.includes("motor")) return VehicleType.MOTORCYCLE;
  if (lower.includes("bus")) return VehicleType.BUS;
  if (lower.includes("lorry") || lower.includes("truck") || lower.includes("tipper")) {
    return VehicleType.TRUCK;
  }
  if (lower.includes("van") || lower.includes("cab")) return VehicleType.VAN;
  if (lower.includes("car") || lower.includes("jeep") || lower.includes("suv")) {
    return VehicleType.CAR;
  }
  if (
    lower.includes("tractor") ||
    lower.includes("jcb") ||
    lower.includes("generator") ||
    lower.includes("fork") ||
    lower.includes("roller") ||
    lower.includes("trailer") ||
    lower.includes("equipment")
  ) {
    return VehicleType.HEAVY_EQUIPMENT;
  }
  return VehicleType.OTHER;
}

function mapOwnership(raw: unknown): VehicleOwnershipType {
  const o = cellString(raw).toUpperCase().replace(/\s+/g, "_");
  if (o === "LEASED") return VehicleOwnershipType.LEASED;
  if (o === "RENTED") return VehicleOwnershipType.RENTED;
  if (o === "THIRD_PARTY") return VehicleOwnershipType.THIRD_PARTY;
  return VehicleOwnershipType.OWNED;
}

export function mapVehicleMasterRow(
  row: VehicleMasterSourceRow,
  rowNumber: number
): Omit<MappedVehicleImport, "action" | "existingVehicleId"> {
  const issues: VehicleImportIssue[] = [];
  const registrationNo = nullableString(row.RegistrationNo);
  if (!registrationNo) {
    issues.push({
      severity: "ERROR",
      code: "MISSING_REGISTRATION",
      message: "RegistrationNo is required.",
      field: "RegistrationNo"
    });
  }

  const statusMap = mapStatusSafe(row.Status);
  if (statusMap.error) issues.push(statusMap.error);
  if (statusMap.warning) issues.push(statusMap.warning);

  const fuelMap = mapFuelTypeSafe(row.FuelType);
  if (fuelMap.warning) issues.push(fuelMap.warning);

  const makeRaw = nullableString(row.Make);
  const make = makeRaw ?? "Unknown";
  if (!makeRaw || makeRaw.toLowerCase() === "unknown") {
    issues.push({
      severity: "WARNING",
      code: "MISSING_MAKE",
      message: "Make missing or Unknown.",
      field: "Make"
    });
  }

  const vehicleModel =
    nullableString(row.VehicleModel) ??
    nullableString(row.Description) ??
    "Unknown";

  const purchaseDate = parseDate(row.PurchaseDate);
  if (purchaseDate.invalid) {
    issues.push({
      severity: "WARNING",
      code: "INVALID_DATES",
      message: `Invalid PurchaseDate '${purchaseDate.raw}'.`,
      field: "PurchaseDate"
    });
  }

  const manufactureYear = parseYear(row.ManufactureYear);
  const purchaseYearDerived = parseYear(row.PurchaseYearDerived);
  const yearSourceRaw = nullableString(row.YearSource) ?? "MISSING";
  let year = manufactureYear;
  let yearSource = "MANUFACTURE_YEAR";
  let yearConfidence: "VERIFIED" | "DERIVED" | "UNVERIFIED" = "VERIFIED";

  if (year == null && purchaseYearDerived != null) {
    year = purchaseYearDerived;
    yearSource = yearSourceRaw || "PURCHASE_DATE_FALLBACK";
    yearConfidence = "DERIVED";
    issues.push({
      severity: "WARNING",
      code: "MISSING_YEAR",
      message: "Manufacture year absent; using PurchaseYearDerived (not claimed as manufacture year).",
      field: "ManufactureYear"
    });
  } else if (year == null && purchaseDate.date) {
    year = purchaseDate.date.getUTCFullYear();
    yearSource = "PURCHASE_DATE";
    yearConfidence = "DERIVED";
    issues.push({
      severity: "WARNING",
      code: "MISSING_YEAR",
      message: "Manufacture year absent; using PurchaseDate year.",
      field: "ManufactureYear"
    });
  } else if (year == null) {
    year = new Date().getUTCFullYear();
    yearSource = "IMPORT_PLACEHOLDER_UNVERIFIED";
    yearConfidence = "UNVERIFIED";
    issues.push({
      severity: "WARNING",
      code: "MISSING_YEAR",
      message: "No manufacture/purchase year; placeholder year set with yearConfidence=UNVERIFIED.",
      field: "ManufactureYear"
    });
  }

  const insuranceExpiry = parseDate(row.InsurancePolicyExpiryDate);
  const roadTaxExpiry = parseDate(row.RevenueExpiryDate);
  const emissionExpiry = parseDate(row.EmissionTestExpiryDate);
  const lastServiceDate = parseDate(row.LastServiceDate);
  const nextServiceDate = parseDate(row.NextServiceDate);
  for (const [field, parsed] of [
    ["InsurancePolicyExpiryDate", insuranceExpiry],
    ["RevenueExpiryDate", roadTaxExpiry],
    ["EmissionTestExpiryDate", emissionExpiry],
    ["LastServiceDate", lastServiceDate],
    ["NextServiceDate", nextServiceDate]
  ] as const) {
    if (parsed.invalid) {
      issues.push({
        severity: "WARNING",
        code: "INVALID_DATES",
        message: `Invalid ${field} '${parsed.raw}'.`,
        field
      });
    }
  }

  const regClass = nullableString(row.RegistrationClass);
  if (regClass === "NAMED_ASSET_OR_EQUIPMENT") {
    issues.push({
      severity: "WARNING",
      code: "NAMED_ASSET_OR_EQUIPMENT",
      message: "Named asset/equipment registration — review FG eligibility separately.",
      field: "RegistrationClass"
    });
  }

  const departmentCode = nullableString(row.DepartmentCode);
  if (nullableString(row.Location) && !departmentCode) {
    issues.push({
      severity: "INFO",
      code: "UNRESOLVED_DEPARTMENT",
      message: "Location present without DepartmentCode; departmentId left null.",
      field: "DepartmentCode"
    });
  }

  const checkOutDate = nullableString(row.CheckOutDate);
  const checkInDate = nullableString(row.CheckInDate);
  if (checkOutDate || checkInDate) {
    issues.push({
      severity: "INFO",
      code: "GATE_HISTORY_DEFERRED",
      message: "Check-in/out preserved in customFields; gate movement import deferred.",
      field: "CheckOutDate"
    });
  }

  const vin = nullableString(row.VIN_ChassisNo);
  const normalizedRegistration = normalizeRegistrationNo(registrationNo ?? "");

  const customFields = {
    import: {
      source: VEHICLE_IMPORT_SOURCE,
      sourceVehicleId: cellString(row.SourceVehicleId),
      importedAt: new Date().toISOString(),
      sourceStatus: nullableString(row.Status),
      sourceCreatedDate: nullableString(row.SourceCreatedDate),
      yearSource,
      yearConfidence,
      purchaseYearDerived,
      manufactureYear,
      rawRegistration: registrationNo,
      registrationClass: regClass,
      registrationSearchKey: nullableString(row.RegistrationSearchKey),
      importAction: nullableString(row.ImportAction),
      importWarnings: nullableString(row.ImportWarnings)
    },
    search: {
      normalizedRegistration
    },
    specifications: {
      transmission: nullableString(row.Transmission),
      engineDescription: nullableString(row.EngineDescription),
      averageFuelConsumption: parseNumber(row.AverageFuelConsumption),
      mainSeats: parseNumber(row.MainSeats),
      additionalSeats: parseNumber(row.AdditionalSeats),
      luggage: nullableString(row.Luggage),
      capacity: parseNumber(row.Capacity),
      weight: parseNumber(row.Weight),
      currentFuelLevel: parseNumber(row.CurrentFuelLevel)
    },
    finance: {
      vendorCode: nullableString(row.VendorCode),
      vendorPaymentAmount: parseNumber(row.VendorPaymentAmount),
      mortgage: {
        amount: parseNumber(row.MortgageAmount),
        companyName: nullableString(row.MortgageCompanyName),
        mortgageNo: nullableString(row.MortgageNo),
        numberOfMonths: parseNumber(row.MortgageNoOfMonths),
        commencedDate: nullableString(row.MortgageCommencedDate),
        endDate: nullableString(row.MortgageEndDate),
        installmentAmount: parseNumber(row.MortgageInstallmentAmount)
      }
    },
    complianceImport: {
      insurance: {
        companyName: nullableString(row.InsuranceCompanyName),
        policyType: nullableString(row.InsurancePolicyType),
        policyNo: nullableString(row.InsurancePolicyNo),
        amount: parseNumber(row.InsuranceAmount),
        startDate: nullableString(row.InsurancePolicyStartDate),
        expiryDate: nullableString(row.InsurancePolicyExpiryDate)
      },
      emission: {
        companyName: nullableString(row.EmissionTestCompanyName),
        testNo: nullableString(row.EmissionTestNo),
        commencingDate: nullableString(row.EmissionTestCommencingDate),
        expiryDate: nullableString(row.EmissionTestExpiryDate),
        passed: nullableString(row.EmissionTestPassed),
        amount: parseNumber(row.EmissionTestAmount)
      },
      revenueLicence: {
        licenseNo: nullableString(row.RevenueLicenseNo),
        amount: parseNumber(row.RevenueAmount),
        commencingDate: nullableString(row.RevenueCommencingDate),
        expiryDate: nullableString(row.RevenueExpiryDate)
      }
    },
    legacy: {
      currentCustomer: nullableString(row.CurrentCustomer),
      latestAgreement: nullableString(row.LatestAgreement),
      currentDriverRef: nullableString(row.CurrentDriverRef),
      sourceStatusReason: nullableString(row.SourceStatusReason),
      documentStatus: nullableString(row.SourceDocumentStatus),
      sourceStatusStartDate: nullableString(row.SourceStatusStartDate),
      sourceStatusEndDate: nullableString(row.SourceStatusEndDate),
      checkOutDate,
      checkOutTime: nullableString(row.CheckOutTime),
      checkInDate,
      checkInTime: nullableString(row.CheckInTime),
      purchaseMileage: parseNumber(row.PurchaseMileage),
      lastServiceMileage: parseNumber(row.LastServiceMileage)
    }
  };

  return {
    rowNumber,
    registrationNo: registrationNo ?? "",
    normalizedRegistration,
    assetTag: nullableString(row.AssetTag),
    make,
    vehicleModel,
    description: nullableString(row.Description),
    location: nullableString(row.Location),
    departmentCode,
    year: year!,
    type: mapVehicleTypeSafe(row.VehicleType),
    ownershipType: mapOwnership(row.OwnershipType),
    status: statusMap.status ?? VehicleStatus.OUT_OF_SERVICE,
    color: nullableString(row.Color),
    vin,
    engineNo: nullableString(row.EngineNo),
    fuelType: fuelMap.fuelType,
    fuelCapacity: parseNumber(row.FuelCapacity),
    currentMileage: parseNumber(row.CurrentMileage) ?? 0,
    serviceIntervalDays: parseNumber(row.ServiceIntervalDays),
    serviceIntervalMileage: parseNumber(row.ServiceIntervalMileage),
    lastServiceDate: lastServiceDate.date,
    nextServiceDate: nextServiceDate.date,
    nextServiceMileage: parseNumber(row.NextServiceMileage),
    acquisitionDate: purchaseDate.date,
    purchasePrice: parseNumber(row.PurchasePrice),
    insuranceExpiry: insuranceExpiry.date,
    roadTaxExpiry: roadTaxExpiry.date,
    vendorName: nullableString(row.VendorName),
    customFields,
    issues
  };
}

export async function readVehicleMasterWorkbook(filePath: string): Promise<{
  rows: VehicleMasterSourceRow[];
  checksum: string;
}> {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Workbook not found: ${absolute}`);
  }
  const buf = fs.readFileSync(absolute);
  const checksum = crypto.createHash("sha256").update(buf).digest("hex");

  const workbook = new ExcelJS.Workbook();
  // exceljs can fail on some valid OOXML; fall back to sheet_to_json via unzip+openpyxl-less path
  try {
    await workbook.xlsx.load(buf as unknown as ExcelJS.Buffer);
  } catch {
    const { default: ExcelJSStream } = await import("exceljs");
    const wb2 = new ExcelJSStream.Workbook();
    await wb2.xlsx.readFile(absolute);
    Object.assign(workbook, wb2);
  }

  const sheet =
    workbook.getWorksheet(VEHICLE_MASTER_SHEET) ?? workbook.worksheets[0];
  if (!sheet) {
    throw new Error(`Sheet ${VEHICLE_MASTER_SHEET} not found`);
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = cellString(cell.value);
  });

  const rows: VehicleMasterSourceRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: VehicleMasterSourceRow = {};
    let any = false;
    for (let col = 1; col < headers.length; col++) {
      const key = headers[col];
      if (!key) continue;
      const value = row.getCell(col).value;
      const normalized =
        value && typeof value === "object" && "text" in (value as object)
          ? (value as { text?: string }).text
          : value && typeof value === "object" && "result" in (value as object)
            ? (value as { result?: unknown }).result
            : value;
      obj[key] = normalized ?? null;
      if (normalized != null && cellString(normalized) !== "") any = true;
    }
    if (any) rows.push(obj);
  });

  return { rows, checksum };
}

/** Python/openpyxl-backed reader used when ExcelJS cannot parse the workbook. */
export async function readVehicleMasterWorkbookViaPython(filePath: string): Promise<{
  rows: VehicleMasterSourceRow[];
  checksum: string;
}> {
  const absolute = path.resolve(filePath);
  const buf = fs.readFileSync(absolute);
  const checksum = crypto.createHash("sha256").update(buf).digest("hex");
  const { spawnSync } = await import("node:child_process");
  const script = `
import json, hashlib, sys
from openpyxl import load_workbook
path=sys.argv[1]
wb=load_workbook(path, read_only=True, data_only=True)
sh=wb['Vehicle_Master_Import'] if 'Vehicle_Master_Import' in wb.sheetnames else wb[wb.sheetnames[0]]
it=sh.iter_rows(values_only=True)
header=[str(c) if c is not None else '' for c in next(it)]
rows=[]
for r in it:
  if not any(c is not None and str(c).strip()!='' for c in r):
    continue
  obj={}
  for i,h in enumerate(header):
    if not h: continue
    v=r[i] if i < len(r) else None
    if hasattr(v,'isoformat'):
      v=v.isoformat()
    obj[h]=v
  rows.append(obj)
wb.close()
print(json.dumps(rows))
`;
  const result = spawnSync("uv", ["run", "--with", "openpyxl", "python", "-c", script, absolute], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`openpyxl read failed: ${result.stderr || result.stdout}`);
  }
  const rows = JSON.parse(result.stdout) as VehicleMasterSourceRow[];
  return { rows, checksum };
}

export async function loadVehicleMasterRows(filePath: string): Promise<{
  rows: VehicleMasterSourceRow[];
  checksum: string;
}> {
  // Prefer openpyxl: ExcelJS rejects some valid OOXML workbooks produced by our prep tooling.
  try {
    return await readVehicleMasterWorkbookViaPython(filePath);
  } catch {
    return readVehicleMasterWorkbook(filePath);
  }
}

export async function previewVehicleMasterImport(
  prisma: PrismaClient | null,
  filePath: string,
  options: { tenantId?: string | null } = {}
): Promise<VehicleImportPreview> {
  const { rows, checksum } = await loadVehicleMasterRows(filePath);
  const batchId = crypto.randomUUID();
  const mapped = rows.map((row, i) => mapVehicleMasterRow(row, i + 2));

  const byNorm = new Map<string, number[]>();
  const byVin = new Map<string, number[]>();
  for (const m of mapped) {
    if (m.normalizedRegistration) {
      const list = byNorm.get(m.normalizedRegistration) ?? [];
      list.push(m.rowNumber);
      byNorm.set(m.normalizedRegistration, list);
    }
    if (m.vin) {
      const list = byVin.get(m.vin.toUpperCase()) ?? [];
      list.push(m.rowNumber);
      byVin.set(m.vin.toUpperCase(), list);
    }
  }

  const existing = prisma
    ? await prisma.vehicle.findMany({
        where: { tenantId: requireTenantId(options.tenantId) },
        select: { id: true, registrationNo: true, vin: true }
      })
    : [];
  const existingByNorm = new Map(
    existing.map((v) => [normalizeRegistrationNo(v.registrationNo), v])
  );
  const existingVin = new Set(
    existing.map((v) => (v.vin ? v.vin.toUpperCase() : "")).filter(Boolean)
  );

  const finalRows: MappedVehicleImport[] = mapped.map((m) => {
    const issues = [...m.issues];
    let action: MappedVehicleImport["action"] = "CREATE";

    if (issues.some((i) => i.severity === "ERROR") || !m.registrationNo) {
      return { ...m, action: "REJECT", issues };
    }

    const dupReg = (byNorm.get(m.normalizedRegistration) ?? []).filter((n) => n !== m.rowNumber);
    if (dupReg.length) {
      issues.push({
        severity: "ERROR",
        code: "DUPLICATE_REGISTRATIONS",
        message: `Duplicate registration in workbook rows ${dupReg.join(",")}`,
        field: "RegistrationNo"
      });
      return { ...m, action: "REJECT", issues };
    }

    if (m.vin) {
      const dupVin = (byVin.get(m.vin.toUpperCase()) ?? []).filter((n) => n !== m.rowNumber);
      if (dupVin.length) {
        issues.push({
          severity: "ERROR",
          code: "DUPLICATE_VINS",
          message: `Duplicate VIN in workbook rows ${dupVin.join(",")}`,
          field: "VIN_ChassisNo"
        });
        return { ...m, action: "REJECT", issues };
      }
      const existingMatch = existing.find(
        (v) => v.vin && v.vin.toUpperCase() === m.vin!.toUpperCase()
      );
      const existingReg = existingByNorm.get(m.normalizedRegistration);
      if (existingMatch && (!existingReg || existingMatch.id !== existingReg.id)) {
        issues.push({
          severity: "ERROR",
          code: "DUPLICATE_VINS",
          message: "VIN already belongs to a different vehicle.",
          field: "VIN_ChassisNo"
        });
        return { ...m, action: "REJECT", issues };
      }
    }

    const hit = existingByNorm.get(m.normalizedRegistration);
    if (hit) {
      action = "UPDATE";
      return { ...m, action, existingVehicleId: hit.id, issues };
    }

    if (m.vin && existingVin.has(m.vin.toUpperCase())) {
      issues.push({
        severity: "ERROR",
        code: "DUPLICATE_VINS",
        message: "VIN already exists on another vehicle.",
        field: "VIN_ChassisNo"
      });
      return { ...m, action: "REJECT", issues };
    }

    return { ...m, action, issues };
  });

  const countCode = (code: string) =>
    finalRows.filter((r) => r.issues.some((i) => i.code === code)).length;

  return {
    batchId,
    sourcePath: path.resolve(filePath),
    sourceChecksum: checksum,
    totalRows: finalRows.length,
    validRows: finalRows.filter((r) => r.action !== "REJECT").length,
    warningRows: finalRows.filter(
      (r) => r.action !== "REJECT" && r.issues.some((i) => i.severity === "WARNING")
    ).length,
    rejectedRows: finalRows.filter((r) => r.action === "REJECT").length,
    newVehicles: finalRows.filter((r) => r.action === "CREATE").length,
    existingVehiclesToUpdate: finalRows.filter((r) => r.action === "UPDATE").length,
    duplicateRegistrations: countCode("DUPLICATE_REGISTRATIONS"),
    duplicateVins: countCode("DUPLICATE_VINS"),
    unknownStatus: countCode("UNKNOWN_STATUS"),
    unknownFuel: countCode("UNKNOWN_FUEL"),
    missingMake: countCode("MISSING_MAKE"),
    missingYear: countCode("MISSING_YEAR"),
    invalidDates: countCode("INVALID_DATES"),
    unresolvedDepartment: countCode("UNRESOLVED_DEPARTMENT"),
    namedAssetOrEquipment: countCode("NAMED_ASSET_OR_EQUIPMENT"),
    gateHistoryImport: "DEFERRED_INSUFFICIENT_DATA",
    rows: finalRows
  };
}

function mergeNonBlank<T>(incoming: T | null | undefined, existing: T | null | undefined): T | null | undefined {
  if (incoming === null || incoming === undefined) return existing;
  if (typeof incoming === "string" && incoming.trim() === "") return existing;
  return incoming;
}

function mergeCustomFields(
  existing: Prisma.JsonValue | null | undefined,
  incoming: Record<string, unknown>
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return {
    ...base,
    ...incoming,
    import: {
      ...((base.import as object) || {}),
      ...(incoming.import as object)
    },
    search: {
      ...((base.search as object) || {}),
      ...(incoming.search as object)
    },
    specifications: {
      ...((base.specifications as object) || {}),
      ...(incoming.specifications as object)
    },
    finance: {
      ...((base.finance as object) || {}),
      ...(incoming.finance as object)
    },
    complianceImport: {
      ...((base.complianceImport as object) || {}),
      ...(incoming.complianceImport as object)
    },
    legacy: {
      ...((base.legacy as object) || {}),
      ...(incoming.legacy as object)
    }
  } as Prisma.InputJsonValue;
}

export async function applyVehicleMasterImport(
  prisma: PrismaClient,
  preview: VehicleImportPreview,
  options: { tenantId?: string | null; dryRun?: boolean } = {}
): Promise<{
  created: number;
  updated: number;
  rejected: number;
  batchId: string;
}> {
  if (options.dryRun) {
    return {
      created: preview.newVehicles,
      updated: preview.existingVehiclesToUpdate,
      rejected: preview.rejectedRows,
      batchId: preview.batchId
    };
  }

  const tenantId = requireTenantId(options.tenantId);

  let created = 0;
  let updated = 0;
  const rejected = preview.rejectedRows;

  for (const row of preview.rows) {
    if (row.action === "REJECT") continue;

    const departments = row.departmentCode
      ? await prisma.department.findFirst({
          where: {
            tenantId,
            OR: [{ code: row.departmentCode }, { name: row.departmentCode }]
          },
          select: { id: true }
        })
      : null;

    if (row.action === "CREATE") {
      await prisma.vehicle.create({
        data: {
          tenantId,
          registrationNo: row.registrationNo,
          assetTag: row.assetTag ?? undefined,
          make: row.make,
          vehicleModel: row.vehicleModel,
          description: row.description ?? undefined,
          location: row.location ?? undefined,
          departmentId: departments?.id,
          year: row.year,
          type: row.type,
          ownershipType: row.ownershipType,
          status: row.status,
          color: row.color ?? undefined,
          vin: row.vin ?? undefined,
          engineNo: row.engineNo ?? undefined,
          fuelType: row.fuelType,
          fuelCapacity: row.fuelCapacity ?? undefined,
          currentMileage: row.currentMileage,
          serviceIntervalDays: row.serviceIntervalDays ?? undefined,
          serviceIntervalMileage: row.serviceIntervalMileage ?? undefined,
          lastServiceDate: row.lastServiceDate ?? undefined,
          nextServiceDate: row.nextServiceDate ?? undefined,
          nextServiceMileage: row.nextServiceMileage ?? undefined,
          acquisitionDate: row.acquisitionDate ?? undefined,
          purchasePrice: row.purchasePrice ?? undefined,
          insuranceExpiry: row.insuranceExpiry ?? undefined,
          roadTaxExpiry: row.roadTaxExpiry ?? undefined,
          vendorName: row.vendorName ?? undefined,
          customFields: row.customFields as Prisma.InputJsonValue
        }
      });
      created++;
      continue;
    }

    const existing = await prisma.vehicle.findUnique({
      where: { registrationNo: row.registrationNo },
      select: {
        id: true,
        make: true,
        vehicleModel: true,
        description: true,
        location: true,
        year: true,
        type: true,
        ownershipType: true,
        status: true,
        color: true,
        vin: true,
        engineNo: true,
        fuelType: true,
        fuelCapacity: true,
        currentMileage: true,
        serviceIntervalDays: true,
        serviceIntervalMileage: true,
        lastServiceDate: true,
        nextServiceDate: true,
        nextServiceMileage: true,
        acquisitionDate: true,
        purchasePrice: true,
        insuranceExpiry: true,
        roadTaxExpiry: true,
        vendorName: true,
        assetTag: true,
        customFields: true
      }
    });
    if (!existing) {
      continue;
    }

    await prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        assetTag: mergeNonBlank(row.assetTag, existing.assetTag) ?? undefined,
        make: mergeNonBlank(row.make, existing.make) ?? existing.make,
        vehicleModel: mergeNonBlank(row.vehicleModel, existing.vehicleModel) ?? existing.vehicleModel,
        description: mergeNonBlank(row.description, existing.description),
        location: mergeNonBlank(row.location, existing.location),
        departmentId: departments?.id ?? undefined,
        year: row.year,
        type: row.type,
        ownershipType: row.ownershipType,
        status: row.status,
        color: mergeNonBlank(row.color, existing.color),
        vin: mergeNonBlank(row.vin, existing.vin),
        engineNo: mergeNonBlank(row.engineNo, existing.engineNo),
        fuelType: row.fuelType === FuelType.UNKNOWN ? existing.fuelType : row.fuelType,
        fuelCapacity: mergeNonBlank(row.fuelCapacity, existing.fuelCapacity),
        currentMileage:
          row.currentMileage > 0 ? row.currentMileage : existing.currentMileage,
        serviceIntervalDays: mergeNonBlank(
          row.serviceIntervalDays,
          existing.serviceIntervalDays
        ),
        serviceIntervalMileage: mergeNonBlank(
          row.serviceIntervalMileage,
          existing.serviceIntervalMileage
        ),
        lastServiceDate: mergeNonBlank(row.lastServiceDate, existing.lastServiceDate),
        nextServiceDate: mergeNonBlank(row.nextServiceDate, existing.nextServiceDate),
        nextServiceMileage: mergeNonBlank(
          row.nextServiceMileage,
          existing.nextServiceMileage
        ),
        acquisitionDate: mergeNonBlank(row.acquisitionDate, existing.acquisitionDate),
        purchasePrice: mergeNonBlank(row.purchasePrice, existing.purchasePrice),
        insuranceExpiry: mergeNonBlank(row.insuranceExpiry, existing.insuranceExpiry),
        roadTaxExpiry: mergeNonBlank(row.roadTaxExpiry, existing.roadTaxExpiry),
        vendorName: mergeNonBlank(row.vendorName, existing.vendorName),
        customFields: mergeCustomFields(existing.customFields, row.customFields)
      }
    });
    updated++;
  }

  return { created, updated, rejected, batchId: preview.batchId };
}
