/**
 * Sites and functional locations from one Excel sheet ("Places"). Pure rules, no database.
 *
 * One row = one location (with its site), or a site alone (location columns empty).
 * Sites are matched by code and created when new; locations are created when new and skipped
 * when the site already has that code. Parents are other locations of the same site, either
 * already in MaintainPro or in the file (created first).
 */
import { normalizeLocationCode } from "./location-hierarchy";

export const PLACES_IMPORT_MAX_ROWS = 1000;

export const SITE_TYPE_VALUES = ["FACTORY", "FARM", "OUTLET", "WAREHOUSE", "OFFICE", "WORKSHOP", "OTHER"] as const;
export const LOCATION_TYPE_VALUES = [
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

export const PLACES_IMPORT_COLUMNS = [
  { key: "siteCode", header: "Site code", required: true },
  { key: "siteName", header: "Site name", required: true },
  { key: "siteType", header: "Site type", required: false },
  { key: "locationCode", header: "Location code", required: false },
  { key: "locationName", header: "Location name", required: false },
  { key: "locationType", header: "Location type", required: false },
  { key: "parentLocationCode", header: "Parent location code", required: false }
] as const;

export type PlacesColumnKey = (typeof PLACES_IMPORT_COLUMNS)[number]["key"];
export type PlacesRowInput = Partial<Record<PlacesColumnKey, unknown>> & { row?: number };

export type PlacesExistingSite = { id: string; code: string; name: string; isActive: boolean; type?: string };
export type PlacesExistingLocation = { id: string; siteId: string; code: string; name: string; isActive: boolean };

export type PlacesLine = {
  row: number;
  status: "NEW" | "SKIP" | "ERROR";
  messages: string[];
  site: { code: string; name: string; type: string; isNew: boolean; existingId?: string };
  location: { code: string; name: string; type: string; parentCode: string; existingId?: string; parentExistingId?: string } | null;
  /** What the row adds: a new site, a new location, both, or nothing. */
  creates: { site: boolean; location: boolean };
};

export type PlacesPreview = {
  lines: PlacesLine[];
  counts: { total: number; newSites: number; newLocations: number; skipped: number; errors: number };
};

const text = (value: unknown, max = 200) => (value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim().slice(0, max));

/** "Production line", "production-line" and "PRODUCTION_LINE" all mean PRODUCTION_LINE. */
export function enumFromText<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const key = text(value).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!key) return null;
  return (allowed as readonly string[]).includes(key) ? (key as T) : null;
}

export function planPlacesImport(
  rows: PlacesRowInput[],
  existing: { sites: PlacesExistingSite[]; locations: PlacesExistingLocation[] }
): PlacesPreview {
  const sitesByCode = new Map(existing.sites.map((site) => [site.code.toUpperCase(), site]));
  const locationKey = (siteCode: string, code: string) => `${siteCode}::${code}`;
  const existingLocations = new Map<string, PlacesExistingLocation>();
  const siteCodeById = new Map(existing.sites.map((site) => [site.id, site.code.toUpperCase()]));
  for (const location of existing.locations) {
    const siteCode = siteCodeById.get(location.siteId);
    if (siteCode) existingLocations.set(locationKey(siteCode, location.code.toUpperCase()), location);
  }

  const fileSites = new Map<string, { name: string; type: string; row: number }>();
  const fileLocations = new Map<string, number>();
  const lines: PlacesLine[] = rows.map((input, index) => {
    const row = Number(input.row) || index + 2;
    const messages: string[] = [];
    const siteCode = text(input.siteCode, 96) ? normalizeLocationCode(text(input.siteCode, 96)) : "";
    const siteName = text(input.siteName);
    const rawSiteType = text(input.siteType);
    const siteType = rawSiteType ? enumFromText(rawSiteType, SITE_TYPE_VALUES) : "OTHER";
    if (!siteCode) messages.push("Site code is missing.");
    if (rawSiteType && !siteType) messages.push(`Site type "${rawSiteType}" is not one of: Factory, Farm, Outlet, Warehouse, Office, Workshop, Other.`);

    const existingSite = siteCode ? sitesByCode.get(siteCode) : undefined;
    if (existingSite && !existingSite.isActive) messages.push(`Site ${siteCode} is inactive. Activate it first.`);
    let siteIsNew = false;
    if (siteCode && !existingSite) {
      const inFile = fileSites.get(siteCode);
      if (inFile) {
        if (siteName && inFile.name.toLowerCase() !== siteName.toLowerCase()) {
          messages.push(`Site ${siteCode} is called "${inFile.name}" on row ${inFile.row}. Use one name.`);
        }
      } else {
        if (!siteName) messages.push("Site name is missing (needed for a new site).");
        else if (siteName.length < 2) messages.push("Site name must have at least 2 characters.");
        if (!messages.length) {
          fileSites.set(siteCode, { name: siteName, type: siteType ?? "OTHER", row });
          siteIsNew = true;
        }
      }
    }

    const locationCodeRaw = text(input.locationCode, 96);
    const locationName = text(input.locationName);
    const rawLocationType = text(input.locationType);
    const parentCodeRaw = text(input.parentLocationCode, 96);
    let location: PlacesLine["location"] = null;
    let locationIsNew = false;
    if (locationCodeRaw || locationName || rawLocationType || parentCodeRaw) {
      const code = locationCodeRaw ? normalizeLocationCode(locationCodeRaw) : "";
      const parentCode = parentCodeRaw ? normalizeLocationCode(parentCodeRaw) : "";
      const type = rawLocationType ? enumFromText(rawLocationType, LOCATION_TYPE_VALUES) : "AREA";
      if (!code) messages.push("Location code is missing.");
      if (!locationName) messages.push("Location name is missing.");
      if (rawLocationType && !type) messages.push(`Location type "${rawLocationType}" is not in the list (e.g. Building, Area, Production line, Room).`);
      if (parentCode && parentCode === code) messages.push("A location cannot be its own parent.");
      location = { code, name: locationName, type: type ?? "AREA", parentCode };
      const found = siteCode && code ? existingLocations.get(locationKey(siteCode, code)) : undefined;
      if (found) location.existingId = found.id;
      else if (siteCode && code) {
        const first = fileLocations.get(locationKey(siteCode, code));
        if (first) messages.push(`Location ${code} at site ${siteCode} is also on row ${first}.`);
        else if (!messages.length) {
          fileLocations.set(locationKey(siteCode, code), row);
          locationIsNew = true;
        }
      }
    }

    const fileSite = fileSites.get(siteCode);
    return {
      row,
      status: messages.length ? "ERROR" : siteIsNew || locationIsNew ? "NEW" : "SKIP",
      messages,
      site: {
        code: siteCode,
        name: existingSite?.name ?? fileSite?.name ?? siteName,
        // An existing site keeps its own type; the file's type only applies to new sites.
        type: existingSite ? existingSite.type ?? "" : fileSite?.type ?? siteType ?? "OTHER",
        isNew: !existingSite,
        existingId: existingSite?.id
      },
      location,
      creates: { site: siteIsNew, location: locationIsNew }
    };
  });

  // Parents: an existing location of the same site, or a new location row of the file.
  const newLocationRows = new Map(
    lines.filter((line) => line.creates.location && line.location).map((line) => [locationKey(line.site.code, line.location!.code), line])
  );
  for (const line of lines) {
    const location = line.location;
    if (!location?.parentCode || line.status === "ERROR" || !line.creates.location) continue;
    const key = locationKey(line.site.code, location.parentCode);
    const existingParent = existingLocations.get(key);
    if (existingParent) {
      if (!existingParent.isActive) {
        line.status = "ERROR";
        line.messages.push(`Parent ${location.parentCode} is inactive.`);
      } else location.parentExistingId = existingParent.id;
    } else if (!newLocationRows.has(key)) {
      line.status = "ERROR";
      line.messages.push(`Parent location ${location.parentCode} is not at site ${line.site.code} in MaintainPro or in this file.`);
    }
  }
  // Loops (A under B, B under A) and children of rows that cannot be saved.
  let changed = true;
  while (changed) {
    changed = false;
    for (const line of lines) {
      const location = line.location;
      if (line.status === "ERROR" || !line.creates.location || !location?.parentCode || location.parentExistingId) continue;
      const parent = newLocationRows.get(locationKey(line.site.code, location.parentCode));
      const seen = new Set<string>([location.code]);
      let cursor = parent;
      let loop = false;
      while (cursor?.location && !cursor.location.parentExistingId && cursor.location.parentCode) {
        if (seen.has(cursor.location.code)) {
          loop = true;
          break;
        }
        seen.add(cursor.location.code);
        cursor = newLocationRows.get(locationKey(line.site.code, cursor.location.parentCode));
      }
      if (loop) {
        line.status = "ERROR";
        line.messages.push("Parent location codes go round in a circle.");
        changed = true;
      } else if (parent && parent.status === "ERROR") {
        line.status = "ERROR";
        line.messages.push(`Parent ${location.parentCode} (row ${parent.row}) has errors. Fix that row first.`);
        changed = true;
      }
    }
  }
  // A new site whose first row fails still needs a valid row to be created.
  for (const line of lines) {
    if (line.status === "ERROR") {
      line.creates = { site: false, location: false };
    }
  }
  for (const [code, site] of fileSites) {
    if (lines.some((line) => line.site.code === code && line.creates.site)) continue;
    const firstOk = lines.find((line) => line.site.code === code && line.status !== "ERROR");
    if (firstOk) {
      firstOk.creates.site = true;
      if (firstOk.status === "SKIP") firstOk.status = "NEW";
    } else {
      for (const line of lines) {
        if (line.site.code === code && line.status !== "ERROR") {
          line.status = "ERROR";
          line.messages.push(`Site ${code} (${site.name}) could not be read.`);
        }
      }
    }
  }
  for (const line of lines) {
    if (line.status === "SKIP" && !line.messages.length) {
      line.messages.push(line.location ? `Location ${line.location.code} is already at site ${line.site.code}.` : `Site ${line.site.code} is already in MaintainPro.`);
    }
  }

  const counts = { total: lines.length, newSites: 0, newLocations: 0, skipped: 0, errors: 0 };
  for (const line of lines) {
    if (line.creates.site) counts.newSites += 1;
    if (line.creates.location) counts.newLocations += 1;
    if (line.status === "SKIP") counts.skipped += 1;
    if (line.status === "ERROR") counts.errors += 1;
  }
  return { lines, counts };
}

/** Locations to create, parents before children (sites are created before any location). */
export function placesSaveOrder(lines: PlacesLine[]): PlacesLine[] {
  const creating = lines.filter((line) => line.creates.location && line.location);
  const key = (siteCode: string, code: string) => `${siteCode}::${code}`;
  const byKey = new Map(creating.map((line) => [key(line.site.code, line.location!.code), line]));
  const ordered: PlacesLine[] = [];
  const done = new Set<PlacesLine>();
  const visit = (line: PlacesLine, depth: number) => {
    if (done.has(line) || depth > creating.length) return;
    const parentCode = line.location?.parentCode;
    if (parentCode && !line.location?.parentExistingId) {
      const parent = byKey.get(key(line.site.code, parentCode));
      if (parent) visit(parent, depth + 1);
    }
    done.add(line);
    ordered.push(line);
  };
  for (const line of creating) visit(line, 0);
  return ordered;
}
