import type { AssetColumnKey } from "./use-asset-page-store";

export const ASSET_DATA_COLUMN_KEYS: AssetColumnKey[] = [
  "assetTag",
  "name",
  "category",
  "status",
  "location",
  "condition",
  "lastServiceDate"
];

export function resolveAssetDataColumnKeys(
  visibleColumns: Record<AssetColumnKey, boolean>
): AssetColumnKey[] {
  return ASSET_DATA_COLUMN_KEYS.filter((key) => visibleColumns[key]);
}
