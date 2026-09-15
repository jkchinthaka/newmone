import { BadRequestException } from "@nestjs/common";

/**
 * Physical Asset parent/child hierarchy helpers.
 * FunctionalLocation remains a separate Phase 3 spatial concept.
 */

export function wouldCreateAssetCycle(
  parentId: string | null | undefined,
  assetId: string,
  getParentId: (id: string) => string | null | undefined
): boolean {
  if (!parentId) return false;
  if (parentId === assetId) return true;

  let current: string | null | undefined = parentId;
  const seen = new Set<string>([assetId]);
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = getParentId(current);
  }
  return false;
}

export async function assertNoAssetHierarchyCycle(params: {
  assetId: string;
  parentAssetId: string | null | undefined;
  loadParentId: (id: string) => Promise<string | null | undefined>;
}): Promise<void> {
  const { assetId, parentAssetId, loadParentId } = params;
  if (!parentAssetId) return;
  if (parentAssetId === assetId) {
    throw new BadRequestException("Asset cannot be its own parent");
  }

  const cache = new Map<string, string | null | undefined>();
  const getParent = async (id: string) => {
    if (!cache.has(id)) {
      cache.set(id, await loadParentId(id));
    }
    return cache.get(id);
  };

  let current: string | null | undefined = parentAssetId;
  const seen = new Set<string>([assetId]);
  while (current) {
    if (seen.has(current)) {
      throw new BadRequestException("Parent assignment would create a hierarchy cycle");
    }
    seen.add(current);
    current = await getParent(current);
  }
}
