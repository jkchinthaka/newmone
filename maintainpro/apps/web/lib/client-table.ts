export type SortDirection = "asc" | "desc";

export function filterRowsBySearch<T>(
  rows: readonly T[],
  query: string,
  getSearchText: (row: T) => string
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...rows];
  }

  return rows.filter((row) => getSearchText(row).toLowerCase().includes(normalized));
}

export function sortRows<T>(
  rows: readonly T[],
  sortKey: string | null | undefined,
  direction: SortDirection,
  getSortValue: (row: T, key: string) => string | number | null | undefined
): T[] {
  if (!sortKey) {
    return [...rows];
  }

  const sorted = [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, sortKey);
    const rightValue = getSortValue(right, sortKey);

    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return leftValue - rightValue;
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

export function paginateRows<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  if (pageSize <= 0) {
    return [...rows];
  }

  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function getPaginationMeta(totalItems: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(pageSize, 1)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  return {
    totalPages,
    page: safePage,
    start,
    end,
    totalItems
  };
}

export function toggleSortDirection(
  currentKey: string | null | undefined,
  nextKey: string,
  currentDirection: SortDirection
): SortDirection {
  if (currentKey === nextKey) {
    return currentDirection === "asc" ? "desc" : "asc";
  }

  return "asc";
}
