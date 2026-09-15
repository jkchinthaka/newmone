/**
 * Phase 13 — Reporting KPIs API client helpers
 *
 * Thin axios wrappers for the /reporting-kpis endpoints. Keep logic minimal
 * here — formula definitions are authoritative on the backend.
 */

import { apiClient } from "./api-client";

export type KpiDefinition = {
  code: string;
  key: string;
  displayName: string;
  label: string;
  description: string;
  formulaSummary: string;
  formula: string;
  numerator: string;
  denominator: string;
  applicableDomains: string[];
  domain: string;
  unit: string;
  emptyBehavior: "ZERO" | "NULL" | "INSUFFICIENT_DATA" | "NA";
  sourceFields: string[];
  version: string;
  help: string;
};

export type KpiDefinitionsResponse = {
  version: string;
  definitions: KpiDefinition[];
};

export type KpiOverviewItem = {
  code: string;
  displayName: string;
  formulaSummary: string;
  unit: string;
  value: number | null;
  dataWarning?: string;
};

export type RoleHomeCard = {
  id: string;
  title: string;
  href: string;
  description: string;
  kpiCodes?: string[];
};

export type RoleHomeProfile = {
  roleKey: string;
  title: string;
  cards: RoleHomeCard[];
};

/**
 * Fetch full KPI definition catalog from API.
 */
export async function fetchKpiDefinitions(): Promise<KpiDefinitionsResponse> {
  const res = await apiClient.get<{ data: KpiDefinitionsResponse }>("/reporting-kpis");
  return res.data.data;
}

/**
 * Fetch a single KPI definition by code.
 */
export async function fetchKpiDefinition(code: string): Promise<KpiDefinition | null> {
  const res = await apiClient.get<{ data: KpiDefinition | null }>(`/reporting-kpis/${code}`);
  return res.data.data;
}

/**
 * Fetch the role-home cards for the current user (JWT-derived role).
 */
export async function fetchRoleHome(): Promise<RoleHomeProfile> {
  const res = await apiClient.get<{ data: RoleHomeProfile }>("/reporting-kpis/home");
  return res.data.data;
}

/**
 * Fetch the role-home cards for an explicit role name.
 */
export async function fetchRoleHomeForRole(role: string): Promise<RoleHomeProfile> {
  const res = await apiClient.get<{ data: RoleHomeProfile }>(`/reporting-kpis/home/${role}`);
  return res.data.data;
}

/**
 * Fetch lightweight KPI overview values for the current tenant.
 * Pass pre-aggregated inputs to skip the backend DB queries.
 */
export async function fetchKpiOverview(
  inputs?: Record<string, unknown>
): Promise<KpiOverviewItem[]> {
  const res = await apiClient.post<{ data: KpiOverviewItem[] }>("/reporting-kpis/overview", inputs ?? {});
  return res.data.data;
}
