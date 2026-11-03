import * as XLSX from "xlsx";

import { apiClient } from "@/lib/api-client";
import type { LocationTreeNode } from "@/lib/organization-api";

/** Sites + functional locations from one Excel sheet. Same rules as the API (places-import.ts). */
export const PLACES_IMPORT_MAX_ROWS = 1000;

export type PlacesKey = "siteCode" | "siteName" | "siteType" | "locationCode" | "locationName" | "locationType" | "parentLocationCode";
export type PlacesRow = Partial<Record<PlacesKey, string>> & { row: number };

export type PlacesLine = {
  row: number;
  status: "NEW" | "SKIP" | "ERROR";
  messages: string[];
  site: { code: string; name: string; type: string; isNew: boolean };
  location: { code: string; name: string; type: string; parentCode: string } | null;
  creates: { site: boolean; location: boolean };
};

export type PlacesPreview = {
  lines: PlacesLine[];
  counts: { total: number; newSites: number; newLocations: number; skipped: number; errors: number };
};

export type PlacesSaveResult = { row: number; status: "CREATED" | "SKIPPED" | "ERROR"; message?: string };

const HEADER_ALIASES: Record<PlacesKey, string[]> = {
  siteCode: ["site code", "site id", "plant code", "branch code"],
  siteName: ["site name", "site", "plant", "branch", "plant name", "branch name"],
  siteType: ["site type", "plant type"],
  locationCode: ["location code", "functional location code", "fl code", "area code"],
  locationName: ["location name", "functional location", "location", "area", "area name", "building"],
  locationType: ["location type", "area type"],
  parentLocationCode: ["parent location code", "parent code", "parent location", "inside", "part of"]
};

export const PLACES_REQUIRED: Array<{ key: PlacesKey; label: string }> = [
  { key: "siteCode", label: "Site code" },
  { key: "siteName", label: "Site name" }
];

function headerKey(header: unknown): PlacesKey | null {
  const clean = String(header ?? "")
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!clean) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<[PlacesKey, string[]]>) {
    if (aliases.includes(clean)) return key;
  }
  return null;
}

export function placesRowsFromSheet(rows: unknown[][]): { rows: PlacesRow[]; missingColumns: string[] } {
  const headerIndex = rows.findIndex((row) => row.some((cell) => headerKey(cell)));
  if (headerIndex < 0) return { rows: [], missingColumns: PLACES_REQUIRED.map((column) => column.label) };
  const columns = rows[headerIndex].map((cell) => headerKey(cell));
  const missingColumns = PLACES_REQUIRED.filter((column) => !columns.includes(column.key)).map((column) => column.label);
  const out: PlacesRow[] = [];
  rows.slice(headerIndex + 1).forEach((cells, offset) => {
    const row: PlacesRow = { row: headerIndex + offset + 2 };
    let filled = false;
    columns.forEach((key, index) => {
      if (!key) return;
      const value = String(cells[index] ?? "").trim();
      if (value) {
        row[key] = value;
        filled = true;
      }
    });
    if (filled) out.push(row);
  });
  return { rows: out, missingColumns };
}

export async function readPlacesWorkbook(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const name = workbook.SheetNames.find((sheet) => sheet.trim().toLowerCase() === "places") ?? workbook.SheetNames[0];
  const sheet = name ? workbook.Sheets[name] : undefined;
  if (!sheet) return { rows: [], missingColumns: PLACES_REQUIRED.map((column) => column.label) };
  return placesRowsFromSheet(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" }));
}

function rowsForm(rows: PlacesRow[]) {
  const form = new FormData();
  form.append("rows", new Blob([JSON.stringify(rows)], { type: "application/json" }), "rows.json");
  return form;
}

export async function previewPlacesImport(rows: PlacesRow[]): Promise<PlacesPreview> {
  const response = await apiClient.post("/organization/places-import/preview", rowsForm(rows), { timeout: 120_000 });
  return response.data?.data as PlacesPreview;
}

export async function savePlacesImport(rows: PlacesRow[]) {
  const response = await apiClient.post("/organization/places-import/save", rowsForm(rows), { timeout: 300_000 });
  return response.data?.data as { results: PlacesSaveResult[]; counts: { created: number; skipped: number; errors: number } };
}

export async function downloadPlacesTemplate() {
  const response = await apiClient.get("/organization/places-import/template.xlsx", { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sites-and-locations-template.xlsx";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * "Where it sits" choices when moving a location: the site's top level, then every other
 * location of the site except the one being moved and anything inside it.
 */
export function moveTargets(roots: LocationTreeNode[], movingId: string): Array<{ id: string; label: string; depth: number }> {
  const out: Array<{ id: string; label: string; depth: number }> = [];
  const walk = (nodes: LocationTreeNode[], depth: number) => {
    for (const node of nodes) {
      if (node.id === movingId) continue;
      if (node.isActive) out.push({ id: node.id, label: `${node.name} (${node.code})`, depth });
      walk(node.children ?? [], depth + 1);
    }
  };
  walk(roots, 0);
  return out;
}
