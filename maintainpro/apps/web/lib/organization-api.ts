import { apiClient } from "./api-client";

type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown>; message?: string };

export const SITE_TYPES = [
  "FACTORY",
  "FARM",
  "OUTLET",
  "WAREHOUSE",
  "OFFICE",
  "WORKSHOP",
  "OTHER"
] as const;

export type SiteType = (typeof SITE_TYPES)[number];

export const FUNCTIONAL_LOCATION_TYPES = [
  "BUILDING",
  "FLOOR",
  "ZONE",
  "AREA",
  "DEPARTMENT_AREA",
  "PRODUCTION_LINE",
  "ROOM",
  "PLANT_ROOM",
  "UTILITY_AREA",
  "YARD",
  "FARM_AREA",
  "OUTLET_AREA",
  "STORAGE_AREA",
  "EXTERNAL_AREA",
  "OTHER"
] as const;

export type FunctionalLocationType = (typeof FUNCTIONAL_LOCATION_TYPES)[number];

export type OrganizationSummary = {
  organization: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  };
  counts: {
    sites: number;
    activeSites: number;
    functionalLocations: number;
  };
};

export type OrgSite = {
  id: string;
  code: string;
  name: string;
  type: SiteType;
  description: string | null;
  address: string | null;
  contactPhone: string | null;
  isActive: boolean;
  locationCount?: number;
};

export type OrgLocation = {
  id: string;
  siteId: string;
  parentId: string | null;
  departmentId: string | null;
  code: string;
  name: string;
  type: FunctionalLocationType;
  description: string | null;
  isActive: boolean;
  childCount?: number;
  pathLabel?: string;
};

export type LocationTreeNode = {
  id: string;
  code: string;
  name: string;
  type: FunctionalLocationType;
  parentId: string | null;
  isActive: boolean;
  children: LocationTreeNode[];
};

export async function fetchOrganizationSummary(): Promise<OrganizationSummary> {
  const response = await apiClient.get<ApiEnvelope<OrganizationSummary>>("/organization/summary");
  return response.data.data;
}

export async function listSites(params: {
  q?: string;
  type?: SiteType;
  includeInactive?: boolean;
} = {}): Promise<OrgSite[]> {
  const response = await apiClient.get<ApiEnvelope<OrgSite[]>>("/organization/sites", {
    params: {
      q: params.q?.trim() || undefined,
      type: params.type,
      includeInactive: params.includeInactive ? "true" : undefined
    }
  });
  return response.data.data ?? [];
}

export async function createSite(payload: {
  code: string;
  name: string;
  type: SiteType;
  description?: string;
  address?: string;
  contactPhone?: string;
}): Promise<OrgSite> {
  const response = await apiClient.post<ApiEnvelope<OrgSite>>("/organization/sites", payload);
  return response.data.data;
}

export async function updateSite(
  siteId: string,
  payload: Partial<{
    code: string;
    name: string;
    type: SiteType;
    description: string | null;
    address: string | null;
    contactPhone: string | null;
    isActive: boolean;
  }>
): Promise<OrgSite> {
  const response = await apiClient.patch<ApiEnvelope<OrgSite>>(
    `/organization/sites/${siteId}`,
    payload
  );
  return response.data.data;
}

export async function listLocations(params: {
  siteId?: string;
  parentId?: string;
  q?: string;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
} = {}): Promise<OrgLocation[]> {
  const response = await apiClient.get<ApiEnvelope<OrgLocation[]>>("/organization/locations", {
    params: {
      siteId: params.siteId,
      parentId: params.parentId,
      q: params.q?.trim() || undefined,
      includeInactive: params.includeInactive ? "true" : undefined,
      page: params.page,
      limit: params.limit ?? 200
    }
  });
  return response.data.data ?? [];
}

export async function fetchLocationTree(
  siteId: string,
  includeInactive = false
): Promise<{ siteId: string; roots: LocationTreeNode[] }> {
  const response = await apiClient.get<
    ApiEnvelope<{ siteId: string; roots: LocationTreeNode[] }>
  >("/organization/locations/tree", {
    params: { siteId, includeInactive: includeInactive ? "true" : undefined }
  });
  return response.data.data;
}

export async function createFunctionalLocation(payload: {
  siteId: string;
  parentId?: string | null;
  departmentId?: string | null;
  code: string;
  name: string;
  type: FunctionalLocationType;
  description?: string;
}): Promise<OrgLocation> {
  const response = await apiClient.post<ApiEnvelope<OrgLocation>>("/organization/locations", payload);
  return response.data.data;
}

export async function updateFunctionalLocation(
  locationId: string,
  payload: Partial<{
    code: string;
    name: string;
    type: FunctionalLocationType;
    description: string | null;
    departmentId: string | null;
    isActive: boolean;
  }>
): Promise<OrgLocation> {
  const response = await apiClient.patch<ApiEnvelope<OrgLocation>>(
    `/organization/locations/${locationId}`,
    payload
  );
  return response.data.data;
}

export async function moveFunctionalLocation(
  locationId: string,
  payload: { parentId?: string | null; siteId?: string; reason: string }
): Promise<OrgLocation> {
  const response = await apiClient.post<ApiEnvelope<OrgLocation>>(
    `/organization/locations/${locationId}/move`,
    payload
  );
  return response.data.data;
}

export async function runFacilityHierarchyMigration(dryRun = true) {
  const response = await apiClient.post<ApiEnvelope<Record<string, unknown>>>(
    "/organization/migrations/facility-hierarchy",
    { dryRun }
  );
  return response.data.data;
}
