/**
 * Functional location tree integrity helpers.
 * Blocks self-parenting and ancestor/descendant cycles.
 */

export function wouldCreateHierarchyCycle(params: {
  locationId: string;
  newParentId: string | null | undefined;
  /** Map of locationId → parentId for the same tenant/site graph */
  parentById: Map<string, string | null>;
}): boolean {
  const { locationId, newParentId, parentById } = params;
  if (!newParentId) {
    return false;
  }
  if (newParentId === locationId) {
    return true;
  }

  let cursor: string | null | undefined = newParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === locationId) {
      return true;
    }
    if (seen.has(cursor)) {
      return true;
    }
    seen.add(cursor);
    cursor = parentById.get(cursor) ?? null;
  }
  return false;
}

export function normalizeLocationCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "-");
}

export function slugifyCodeSegment(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export type LocationPathNode = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export function buildLocationPath(
  locationId: string,
  byId: Map<string, LocationPathNode & { parentId: string | null }>
): LocationPathNode[] {
  const path: LocationPathNode[] = [];
  let cursor: string | null = locationId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) {
      break;
    }
    seen.add(cursor);
    const node = byId.get(cursor);
    if (!node) {
      break;
    }
    path.unshift({ id: node.id, code: node.code, name: node.name, type: node.type });
    cursor = node.parentId;
  }
  return path;
}

export function formatLocationPathLabel(path: readonly LocationPathNode[]): string {
  return path.map((node) => node.name).join(" / ");
}
