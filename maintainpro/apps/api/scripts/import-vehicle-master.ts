/**
 * Preview / apply MaintainPro Vehicle Master workbook import.
 *
 * Usage (from maintainpro/):
 *   npx tsx apps/api/scripts/import-vehicle-master.ts --preview
 *   npx tsx apps/api/scripts/import-vehicle-master.ts --apply
 *
 * Workbook (local/private — never commit):
 *   C:\PrivateImports\MaintainPro_Vehicle_Master_Import.xlsx
 */
import "dotenv/config";
import * as path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  applyVehicleMasterImport,
  previewVehicleMasterImport
} from "../src/modules/vehicles/vehicle-master-import";

const DEFAULT_WORKBOOK = path.resolve(
  "C:/PrivateImports/MaintainPro_Vehicle_Master_Import.xlsx"
);

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return undefined;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const previewOnly = process.argv.includes("--preview") || !apply;
  const workbook = argValue("--file") ?? process.env.VEHICLE_MASTER_IMPORT_FILE ?? DEFAULT_WORKBOOK;
  const tenantId = argValue("--tenant") ?? process.env.VEHICLE_IMPORT_TENANT_ID ?? undefined;

  const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;
  try {
    console.log(`[vehicle-master-import] workbook=${workbook}`);
    console.log(`[vehicle-master-import] mode=${apply ? "APPLY" : "PREVIEW"}`);
    if (apply && !prisma) {
      throw new Error("DATABASE_URL required for --apply");
    }
    if (prisma && !tenantId) {
      throw new Error("--tenant or VEHICLE_IMPORT_TENANT_ID required when DATABASE_URL is set");
    }
    const preview = await previewVehicleMasterImport(prisma, workbook, { tenantId });

    const summary = {
      batchId: preview.batchId,
      sourceChecksum: preview.sourceChecksum,
      TOTAL_ROWS: preview.totalRows,
      VALID_ROWS: preview.validRows,
      WARNING_ROWS: preview.warningRows,
      REJECTED_ROWS: preview.rejectedRows,
      NEW_VEHICLES: preview.newVehicles,
      EXISTING_VEHICLES_TO_UPDATE: preview.existingVehiclesToUpdate,
      DUPLICATE_REGISTRATIONS: preview.duplicateRegistrations,
      DUPLICATE_VINS: preview.duplicateVins,
      UNKNOWN_STATUS: preview.unknownStatus,
      UNKNOWN_FUEL: preview.unknownFuel,
      MISSING_MAKE: preview.missingMake,
      MISSING_YEAR: preview.missingYear,
      INVALID_DATES: preview.invalidDates,
      UNRESOLVED_DEPARTMENT: preview.unresolvedDepartment,
      NAMED_ASSET_OR_EQUIPMENT: preview.namedAssetOrEquipment,
      GATE_HISTORY_IMPORT: preview.gateHistoryImport
    };
    console.log(JSON.stringify(summary, null, 2));

    if (previewOnly) {
      console.log("[vehicle-master-import] preview complete — no DB writes");
      return;
    }

    const result = await applyVehicleMasterImport(prisma!, preview, { tenantId });
    console.log(
      JSON.stringify(
        {
          APPLY: "DONE",
          batchId: result.batchId,
          created: result.created,
          updated: result.updated,
          rejected: result.rejected
        },
        null,
        2
      )
    );
  } finally {
    await prisma?.$disconnect();
  }
}

main().catch((err) => {
  console.error("[vehicle-master-import] FAILED", err);
  process.exitCode = 1;
});
