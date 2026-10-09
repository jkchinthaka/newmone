export const ORG_SITES_EMPTY = "No sites configured yet.";
export const ORG_LOCATIONS_EMPTY = "No functional locations for this site.";
export const DEPARTMENTS_HREF = "/master-data/departments";
export const ORG_PRIMARY_ACTIONS = ["Departments", "Add Site", "Add Location"] as const;

export function organizationStateFromSearch(params: URLSearchParams): { siteId: string; locationId: string } {
  return {
    siteId: params.get("site")?.trim() ?? "",
    locationId: params.get("location")?.trim() ?? ""
  };
}

export function organizationSearch(siteId: string | null, locationId: string | null): string {
  const params = new URLSearchParams();
  if (siteId) params.set("site", siteId);
  if (siteId && locationId) params.set("location", locationId);
  return params.toString();
}

export function rootLocationQuery(siteId: string): { siteId: string; parentId: "null" } {
  return { siteId, parentId: "null" };
}
