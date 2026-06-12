import { resolveAssetDataColumnKeys } from "../../web/components/assets/assets-table-columns";
import type { AssetColumnKey } from "../../web/components/assets/use-asset-page-store";

const ALL_VISIBLE: Record<AssetColumnKey, boolean> = {
  assetTag: true,
  name: true,
  category: true,
  status: true,
  location: true,
  condition: true,
  lastServiceDate: true,
  qr: true,
  actions: true
};

describe("assets table column helpers", () => {
  it("returns all data columns when visibility flags are enabled", () => {
    expect(resolveAssetDataColumnKeys(ALL_VISIBLE)).toEqual([
      "assetTag",
      "name",
      "category",
      "status",
      "location",
      "condition",
      "lastServiceDate"
    ]);
  });

  it("omits hidden data columns without affecting qr/actions flags", () => {
    const visibleColumns: Record<AssetColumnKey, boolean> = {
      ...ALL_VISIBLE,
      location: false,
      lastServiceDate: false,
      qr: false,
      actions: false
    };

    expect(resolveAssetDataColumnKeys(visibleColumns)).toEqual([
      "assetTag",
      "name",
      "category",
      "status",
      "condition"
    ]);
  });

  it("returns an empty list when all data columns are hidden", () => {
    const visibleColumns: Record<AssetColumnKey, boolean> = {
      assetTag: false,
      name: false,
      category: false,
      status: false,
      location: false,
      condition: false,
      lastServiceDate: false,
      qr: true,
      actions: true
    };

    expect(resolveAssetDataColumnKeys(visibleColumns)).toEqual([]);
  });
});
