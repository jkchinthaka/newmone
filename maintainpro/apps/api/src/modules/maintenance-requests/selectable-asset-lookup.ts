import { AssetStatus, Prisma } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";

/** Statuses a requester must not be able to select for a new maintenance request. */
const NOT_SELECTABLE: AssetStatus[] = [
  // Draft = registered but not yet approved by a manager; no jobs until it is Active.
  AssetStatus.DRAFT,
  AssetStatus.RETIRED,
  AssetStatus.DISPOSED,
  AssetStatus.INACTIVE
];

export const ASSET_LOOKUP_MAX = 15;

/**
 * Tenant-scoped machine search. SQL Server applies its own collation, so this
 * uses `contains` without a provider-specific case mode.
 * Filters run in the query, before `take`.
 */
export function selectableAssetLookupWhere(
  tenantId: string | null | undefined,
  rawQuery: string
): Prisma.AssetWhereInput {
  const q = rawQuery.trim();
  return {
    tenantId: requireTenantId(tenantId),
    isActive: true,
    archivedAt: null,
    status: { notIn: NOT_SELECTABLE },
    OR: [
      { assetTag: { contains: q } },
      { name: { contains: q } },
      { serialNumber: { contains: q } }
    ]
  };
}
