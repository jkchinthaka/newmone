import { AssetCategory } from "@prisma/client";

/**
 * Deterministic legacy AssetCategory enum → domain/category codes.
 * Ambiguous enums stay unmapped and must be flagged — never silently guess.
 */
export type LegacyCategoryMapping = {
  domainCode: string;
  categoryCode: string;
  ambiguous?: boolean;
  note?: string;
};

export const LEGACY_ASSET_CATEGORY_MAP: Record<AssetCategory, LegacyCategoryMapping> = {
  MACHINE: { domainCode: "PLANT_MACHINERY", categoryCode: "MACHINE" },
  TOOL: { domainCode: "TOOLS_MOULDS_JIGS", categoryCode: "TOOL" },
  INFRASTRUCTURE: {
    domainCode: "FACILITY_CIVIL",
    categoryCode: "INFRASTRUCTURE",
    ambiguous: true,
    note: "Broad legacy value — review"
  },
  EQUIPMENT: {
    domainCode: "MECHANICAL",
    categoryCode: "EQUIPMENT",
    ambiguous: true,
    note: "Broad legacy value — review"
  },
  VEHICLE: { domainCode: "FLEET", categoryCode: "VEHICLE" },
  OTHER: { domainCode: "OTHER", categoryCode: "OTHER" },
  TRACTOR: { domainCode: "FARM_INFRASTRUCTURE", categoryCode: "FARM_OTHER", ambiguous: true },
  HARVESTER: { domainCode: "FARM_INFRASTRUCTURE", categoryCode: "FARM_OTHER", ambiguous: true },
  SPRAYER: { domainCode: "FARM_INFRASTRUCTURE", categoryCode: "FARM_OTHER", ambiguous: true },
  IRRIGATION_PUMP: { domainCode: "WATER_WASTEWATER", categoryCode: "IRRIGATION_PUMP" },
  IRRIGATION_PIPE: {
    domainCode: "WATER_WASTEWATER",
    categoryCode: "IRRIGATION_PUMP",
    ambiguous: true,
    note: "No dedicated irrigation-pipe category — flagged for reconciliation"
  },
  GREENHOUSE: { domainCode: "FARM_INFRASTRUCTURE", categoryCode: "FARM_OTHER", ambiguous: true },
  BARN: { domainCode: "FARM_INFRASTRUCTURE", categoryCode: "FARM_OTHER", ambiguous: true },
  STORAGE_SILO: { domainCode: "FARM_INFRASTRUCTURE", categoryCode: "FARM_OTHER", ambiguous: true },
  COLD_ROOM: { domainCode: "HVAC_REFRIGERATION", categoryCode: "COLD_ROOM" },
  MILKING_MACHINE: { domainCode: "FARM_INFRASTRUCTURE", categoryCode: "FARM_OTHER", ambiguous: true }
};

export function mapLegacyAssetCategory(category: AssetCategory): LegacyCategoryMapping {
  return LEGACY_ASSET_CATEGORY_MAP[category];
}
