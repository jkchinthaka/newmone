export type InventoryListQuery = {
  q?: string;
  category?: string;
  supplierId?: string;
  location?: string;
  mapped?: "yes" | "no";
  stock?: "out";
  sortBy?: "name" | "partNumber" | "quantityInStock" | "updatedAt";
  sortDir?: "asc" | "desc";
};

/** ERP snapshot and mapping filters. quantityInStock is the last Bileeta snapshot, not a local ledger. */
export function inventoryPartsWhere(tenantId: string, query: InventoryListQuery) {
  const q = query.q?.trim();
  const and: object[] = [];
  if (q) {
    and.push({
      OR: [
        { name: { contains: q } },
        { partNumber: { contains: q } },
        { erpCode: { contains: q } },
        { supplier: { name: { contains: q } } }
      ]
    });
  }
  if (query.category?.trim()) and.push({ category: query.category.trim() });
  if (query.supplierId?.trim()) and.push({ supplierId: query.supplierId.trim() });
  if (query.location?.trim()) and.push({ location: { contains: query.location.trim() } });
  if (query.mapped === "yes") and.push({ NOT: [{ erpCode: null }, { erpCode: "" }] });
  if (query.mapped === "no") and.push({ OR: [{ erpCode: null }, { erpCode: "" }] });
  if (query.stock === "out") and.push({ quantityInStock: { lte: 0 } });
  return {
    tenantId,
    isActive: true,
    ...(and.length ? { AND: and } : {})
  };
}
