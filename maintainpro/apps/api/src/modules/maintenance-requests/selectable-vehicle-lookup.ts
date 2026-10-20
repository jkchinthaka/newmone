import { Prisma, VehicleStatus } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";

export const VEHICLE_LOOKUP_MAX = 15;

const NOT_SELECTABLE = [VehicleStatus.DISPOSED, "RETIRED", "DECOMMISSIONED"];

/**
 * Tenant-scoped vehicle search for maintenance requesters.
 * SQL filters registration, asset tag, make, and model before `take`.
 */
export function selectableVehicleLookupWhere(
  tenantId: string | null | undefined,
  rawQuery: string
): Prisma.VehicleWhereInput {
  const q = rawQuery.trim();
  return {
    tenantId: requireTenantId(tenantId),
    decommissionedAt: null,
    status: { notIn: NOT_SELECTABLE },
    OR: [
      { registrationNo: { contains: q } },
      { assetTag: { contains: q } },
      { make: { contains: q } },
      { vehicleModel: { contains: q } }
    ]
  };
}
