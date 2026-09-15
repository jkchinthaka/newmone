import { apiClient } from "./api-client";

export type AssetDomain = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { categories: number; assets: number };
};

export type AssetCategoryMaster = {
  id: string;
  domainId: string;
  code: string;
  name: string;
  isActive: boolean;
  domain?: { id: string; code: string; name: string; isActive: boolean };
  _count?: { types: number; assets: number };
};

export type AssetTypeMaster = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  isActive: boolean;
  category?: {
    id: string;
    code: string;
    name: string;
    domainId: string;
    domain?: { id: string; code: string; name: string };
  };
};

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function seedAssetTaxonomyDefaults() {
  const res = await apiClient.post("/asset-taxonomy/seed-defaults");
  return unwrap<{ domainsCreated: number; categoriesCreated: number; typesCreated: number }>(
    res.data
  );
}

export async function listAssetDomains(includeInactive = false) {
  const res = await apiClient.get("/asset-taxonomy/domains", {
    params: { includeInactive }
  });
  return unwrap<{ items: AssetDomain[] }>(res.data);
}

export async function createAssetDomain(body: { code: string; name: string; description?: string }) {
  const res = await apiClient.post("/asset-taxonomy/domains", body);
  return unwrap<AssetDomain>(res.data);
}

export async function updateAssetDomain(
  id: string,
  body: Partial<{ code: string; name: string; description: string; isActive: boolean; sortOrder: number }>
) {
  const res = await apiClient.patch(`/asset-taxonomy/domains/${id}`, body);
  return unwrap<AssetDomain>(res.data);
}

export async function listAssetCategories(domainId?: string, includeInactive = false) {
  const res = await apiClient.get("/asset-taxonomy/categories", {
    params: { domainId, includeInactive }
  });
  return unwrap<{ items: AssetCategoryMaster[] }>(res.data);
}

export async function createAssetCategory(body: {
  domainId: string;
  code: string;
  name: string;
  description?: string;
}) {
  const res = await apiClient.post("/asset-taxonomy/categories", body);
  return unwrap<AssetCategoryMaster>(res.data);
}

export async function listAssetTypes(categoryId?: string, includeInactive = false) {
  const res = await apiClient.get("/asset-taxonomy/types", {
    params: { categoryId, includeInactive }
  });
  return unwrap<{ items: AssetTypeMaster[] }>(res.data);
}

export async function createAssetType(body: {
  categoryId: string;
  code: string;
  name: string;
  description?: string;
}) {
  const res = await apiClient.post("/asset-taxonomy/types", body);
  return unwrap<AssetTypeMaster>(res.data);
}
