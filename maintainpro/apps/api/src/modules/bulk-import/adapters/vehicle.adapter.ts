import { Inject, Injectable } from "@nestjs/common";
import { BulkImportEntity, FuelType, VehicleOwnershipType, VehicleType } from "@prisma/client";

import { PrismaService } from "../../../database/prisma.service";
import {
  BulkImportAdapter,
  BulkImportExistingRecord,
  BulkImportFieldIssue,
  BulkImportNormalizedRow,
  BulkImportTemplateColumn
} from "../bulk-import-adapter";
import {
  normalizeEnumValue,
  parseIntegerValue,
  parseNumberValue,
  requireTrimmedString,
  trimToNull
} from "../util/bulk-import-normalize.util";

const VEHICLE_TYPES = Object.values(VehicleType);
const FUEL_TYPES = Object.values(FuelType);
const OWNERSHIP_TYPES = Object.values(VehicleOwnershipType);

const TEMPLATE_COLUMNS: BulkImportTemplateColumn[] = [
  { key: "registrationNo", header: "Registration No", required: true, example: "WP-CAB-1234" },
  { key: "make", header: "Make", required: true, example: "Toyota" },
  { key: "vehicleModel", header: "Model", required: true, example: "Hilux" },
  { key: "year", header: "Year", required: true, example: "2022" },
  { key: "type", header: "Type", required: true, example: "TRUCK", notes: `One of: ${VEHICLE_TYPES.join(", ")}` },
  { key: "fuelType", header: "Fuel Type", required: true, example: "DIESEL", notes: `One of: ${FUEL_TYPES.join(", ")}` },
  {
    key: "ownershipType",
    header: "Ownership Type",
    required: false,
    example: "OWNED",
    notes: `One of: ${OWNERSHIP_TYPES.join(", ")} (default OWNED)`
  },
  { key: "assetTag", header: "Asset Tag", required: false, example: "AT-0042" },
  { key: "currentMileage", header: "Current Mileage", required: false, example: "15000" },
  { key: "location", header: "Location", required: false, example: "Colombo Depot" },
  { key: "costCenter", header: "Cost Center", required: false, example: "CC-100" },
  { key: "vendorName", header: "Vendor Name", required: false, example: "ABC Motors" },
  { key: "description", header: "Description", required: false, example: "" }
];

@Injectable()
export class VehicleBulkImportAdapter implements BulkImportAdapter {
  readonly entityType = BulkImportEntity.VEHICLE;
  readonly label = "Vehicle";
  readonly naturalKeyLabel = "Registration No";
  /** Vehicle.registrationNo is globally unique in the schema, not per-tenant. */
  readonly naturalKeyTenantScoped = false;
  readonly templateColumns = TEMPLATE_COLUMNS;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  normalizeRow(raw: Record<string, unknown>): BulkImportNormalizedRow {
    const errors: BulkImportFieldIssue[] = [];
    const warnings: BulkImportFieldIssue[] = [];

    const registrationNo = requireTrimmedString(raw, "registrationNo", errors, "Registration No");
    const make = requireTrimmedString(raw, "make", errors, "Make");
    const vehicleModel = requireTrimmedString(raw, "vehicleModel", errors, "Model");

    const yearParsed = parseIntegerValue(raw.year);
    if (yearParsed.error) errors.push({ field: "year", code: "INVALID_NUMBER", message: yearParsed.error });
    else if (yearParsed.value === null) errors.push({ field: "year", code: "REQUIRED", message: "Year is required" });
    else if (yearParsed.value < 1990 || yearParsed.value > 2100) {
      errors.push({ field: "year", code: "OUT_OF_RANGE", message: "Year must be between 1990 and 2100" });
    }

    const typeParsed = normalizeEnumValue(raw.type, VEHICLE_TYPES);
    if (typeParsed.error) errors.push({ field: "type", code: "INVALID_ENUM", message: typeParsed.error });
    else if (!typeParsed.value) errors.push({ field: "type", code: "REQUIRED", message: "Type is required" });

    const fuelTypeParsed = normalizeEnumValue(raw.fuelType, FUEL_TYPES);
    if (fuelTypeParsed.error) errors.push({ field: "fuelType", code: "INVALID_ENUM", message: fuelTypeParsed.error });
    else if (!fuelTypeParsed.value) errors.push({ field: "fuelType", code: "REQUIRED", message: "Fuel Type is required" });

    const ownershipParsed = normalizeEnumValue(raw.ownershipType, OWNERSHIP_TYPES);
    if (ownershipParsed.error) {
      errors.push({ field: "ownershipType", code: "INVALID_ENUM", message: ownershipParsed.error });
    }

    const mileageParsed = parseNumberValue(raw.currentMileage);
    if (mileageParsed.error) {
      errors.push({ field: "currentMileage", code: "INVALID_NUMBER", message: mileageParsed.error });
    } else if (mileageParsed.value !== null && mileageParsed.value < 0) {
      errors.push({ field: "currentMileage", code: "OUT_OF_RANGE", message: "Mileage cannot be negative" });
    }

    return {
      naturalKey: registrationNo,
      data: {
        registrationNo,
        make,
        vehicleModel,
        year: yearParsed.value,
        type: typeParsed.value,
        fuelType: fuelTypeParsed.value,
        ownershipType: ownershipParsed.value ?? undefined,
        assetTag: trimToNull(raw.assetTag),
        currentMileage: mileageParsed.value ?? undefined,
        location: trimToNull(raw.location),
        costCenter: trimToNull(raw.costCenter),
        vendorName: trimToNull(raw.vendorName),
        description: trimToNull(raw.description)
      },
      errors,
      warnings
    };
  }

  async findExisting(_tenantId: string, naturalKeys: string[]): Promise<Map<string, BulkImportExistingRecord>> {
    if (naturalKeys.length === 0) return new Map();
    const vehicles = await this.prisma.vehicle.findMany({
      where: { registrationNo: { in: naturalKeys } },
      select: { id: true, tenantId: true, registrationNo: true, make: true, vehicleModel: true, status: true, year: true }
    });
    const map = new Map<string, BulkImportExistingRecord>();
    for (const vehicle of vehicles) {
      map.set(vehicle.registrationNo, {
        id: vehicle.id,
        tenantId: vehicle.tenantId,
        snapshot: {
          registrationNo: vehicle.registrationNo,
          make: vehicle.make,
          vehicleModel: vehicle.vehicleModel,
          status: vehicle.status,
          year: vehicle.year
        }
      });
    }
    return map;
  }

  async create(tenantId: string, data: Record<string, unknown>): Promise<string> {
    const created = await this.prisma.vehicle.create({
      data: {
        tenantId,
        registrationNo: data.registrationNo as string,
        make: data.make as string,
        vehicleModel: data.vehicleModel as string,
        year: data.year as number,
        type: data.type as VehicleType,
        fuelType: data.fuelType as FuelType,
        ownershipType: (data.ownershipType as VehicleOwnershipType | undefined) ?? undefined,
        assetTag: (data.assetTag as string | null) ?? undefined,
        currentMileage: (data.currentMileage as number | undefined) ?? 0,
        location: (data.location as string | null) ?? undefined,
        costCenter: (data.costCenter as string | null) ?? undefined,
        vendorName: (data.vendorName as string | null) ?? undefined,
        description: (data.description as string | null) ?? undefined,
        images: []
      },
      select: { id: true }
    });
    return created.id;
  }

  buildUpdate(existing: BulkImportExistingRecord, data: Record<string, unknown>): Record<string, unknown> | null {
    const patch: Record<string, unknown> = {};
    // Only fields explicitly provided (non-blank) participate — blank cells never clear a value.
    for (const key of ["make", "vehicleModel", "assetTag", "location", "costCenter", "vendorName", "description"]) {
      const value = data[key];
      if (typeof value === "string" && value.length > 0) patch[key] = value;
    }
    if (typeof data.year === "number") patch.year = data.year;
    if (typeof data.type === "string") patch.type = data.type;
    if (typeof data.fuelType === "string") patch.fuelType = data.fuelType;
    if (typeof data.ownershipType === "string") patch.ownershipType = data.ownershipType;
    if (typeof data.currentMileage === "number") patch.currentMileage = data.currentMileage;
    return Object.keys(patch).length > 0 ? patch : null;
  }

  async applyUpdate(id: string, data: Record<string, unknown>): Promise<void> {
    await this.prisma.vehicle.update({ where: { id }, data: data as never });
  }
}
