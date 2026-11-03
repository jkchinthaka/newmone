/**
 * Add many assets from an Excel file (whole-company asset register).
 *
 * Pure rules, no database: reading a row, matching names against master data, auto asset tags,
 * duplicates in the file, matching existing assets, and the save order for parent assets.
 * AssetRegisterImportService loads the data and saves through AssetsService.
 */
import { assetTagTypeCode } from "./asset-tag-type-code";
import { isValidAssetTag, normalizeAssetTag } from "./dto/asset-tag";

export const ASSET_IMPORT_MAX_ROWS = 2000;
/** Rows saved per request; the browser sends the file in parts so each request stays short. */
export const ASSET_IMPORT_SAVE_CHUNK = 200;

export const ASSET_IMPORT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE"] as const;
export const ASSET_IMPORT_CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/** Column keys, in template order. `*` columns are required. */
export const ASSET_IMPORT_COLUMNS = [
  { key: "assetGroup", header: "Asset group", required: true },
  { key: "category", header: "Category", required: true },
  { key: "type", header: "Type", required: false },
  { key: "name", header: "Name", required: true },
  { key: "site", header: "Site", required: true },
  { key: "functionalLocation", header: "Functional location", required: false },
  { key: "department", header: "Department", required: false },
  { key: "assetTag", header: "Asset tag", required: false },
  { key: "serialNumber", header: "Serial number", required: false },
  { key: "manufacturer", header: "Manufacturer", required: false },
  { key: "model", header: "Model", required: false },
  { key: "criticality", header: "Criticality", required: false },
  { key: "status", header: "Status", required: false },
  { key: "parentAssetTag", header: "Parent asset tag", required: false },
  { key: "fixedAssetCode", header: "ERP / Fixed asset code", required: false },
  { key: "purchaseDate", header: "Purchase date", required: false },
  { key: "purchasePrice", header: "Purchase price", required: false },
  { key: "warrantyExpiry", header: "Warranty expiry", required: false },
  { key: "supplier", header: "Supplier", required: false },
  { key: "responsiblePerson", header: "Responsible person", required: false },
  { key: "notes", header: "Notes", required: false }
] as const;

export type AssetImportColumnKey = (typeof ASSET_IMPORT_COLUMNS)[number]["key"];

/** One row as read from the file (text values; dates as YYYY-MM-DD when Excel had a date). */
export type AssetImportRowInput = Partial<Record<AssetImportColumnKey, unknown>> & {
  /** Row number in the file (header is row 1). */
  row?: number;
  /** True when the tag was filled in by the system and the person did not change it. */
  autoTag?: boolean;
};

type Named = { id: string; code: string; name: string };
export type ImportSite = Named;
export type ImportLocation = Named & { siteId: string };
export type ImportDepartment = Named;
export type ImportDomain = Named;
export type ImportCategory = Named & { domainId: string; legacyEnum: string | null };
export type ImportType = Named & { categoryId: string };
export type ImportUser = { id: string; email: string; name: string };
export type ImportExistingAsset = {
  id: string;
  assetTag: string;
  name: string;
  serialNumber: string | null;
  fixedAssetCode: string | null;
  siteId: string | null;
  functionalLocationId: string | null;
};

export type AssetImportMasterData = {
  sites: ImportSite[];
  locations: ImportLocation[];
  departments: ImportDepartment[];
  domains: ImportDomain[];
  categories: ImportCategory[];
  types: ImportType[];
  users: ImportUser[];
  /** Existing assets that share a tag, serial number or fixed asset code with the file. */
  existing: ImportExistingAsset[];
  /** Every existing tag that starts with a prefix the file may auto-number. */
  takenTags: string[];
};

export type AssetImportStatus = "NEW" | "UPDATE" | "SKIP" | "ERROR";

export type AssetImportLine = {
  row: number;
  status: AssetImportStatus;
  /** Why the row cannot be saved (ERROR), or why it is skipped (SKIP). */
  messages: string[];
  /** Saved anyway, but worth a look (e.g. site not changed on update). */
  warnings: string[];
  assetTag: string;
  autoTag: boolean;
  name: string;
  /** Names as shown back to the person (resolved from master data). */
  display: {
    assetGroup: string;
    category: string;
    type: string;
    site: string;
    functionalLocation: string;
    department: string;
    responsiblePerson: string;
    parentAssetTag: string;
  };
  existingAssetId?: string;
  existingAssetTag?: string;
  /** Ready-to-save fields (ids resolved). Present when the row can be saved. */
  payload?: AssetImportPayload;
  /** Tag of a parent that is a NEW row in this file (saved first). */
  parentRowTag?: string;
};

export type AssetImportPayload = {
  assetTag: string;
  name: string;
  category: string;
  domainId: string;
  categoryMasterId: string;
  typeMasterId?: string;
  siteId: string;
  functionalLocationId?: string;
  departmentId?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  criticalityLevel: string;
  status: string;
  parentAssetId?: string;
  fixedAssetCode?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiry?: string;
  supplier?: string;
  responsiblePersonId?: string;
  description?: string;
};

export type AssetImportPreview = {
  lines: AssetImportLine[];
  counts: { total: number; new: number; update: number; skip: number; error: number };
};

const text = (value: unknown, max = 500): string => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
};

/** Lower case, single spaces, no punctuation: "Main  Plant." and "main plant" match. */
export function matchKey(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** "Did you mean …?" — the closest name or code, when it is close enough to be a typo. */
export function closestName(value: string, options: Named[]): string | null {
  const key = matchKey(value);
  if (!key) return null;
  let best: { label: string; distance: number } | null = null;
  for (const option of options) {
    for (const candidate of [option.name, option.code]) {
      const candidateKey = matchKey(candidate);
      if (!candidateKey) continue;
      const contains = candidateKey.includes(key) || key.includes(candidateKey);
      const distance = contains ? Math.abs(candidateKey.length - key.length) / 10 : levenshtein(key, candidateKey);
      const limit = Math.max(2, Math.floor(Math.max(key.length, candidateKey.length) * 0.34));
      if ((contains || distance <= limit) && (!best || distance < best.distance)) {
        best = { label: option.name, distance };
      }
    }
  }
  return best?.label ?? null;
}

/** Finds one option by name, code, or "CODE — Name" (the template's drop-down text). */
export function findByNameOrCode<T extends Named>(value: string, options: T[]): { match?: T; ambiguous?: boolean } {
  const raw = text(value);
  if (!raw) return {};
  const labelCode = raw.includes(" — ") ? raw.split(" — ")[0] : raw.includes(" - ") ? raw.split(" - ")[0] : null;
  const keys = [matchKey(raw), labelCode ? matchKey(labelCode) : null].filter((key): key is string => Boolean(key));
  for (const key of keys) {
    const byCode = options.filter((option) => matchKey(option.code) === key);
    if (byCode.length === 1) return { match: byCode[0] };
    const byName = options.filter((option) => matchKey(option.name) === key);
    if (byName.length === 1) return { match: byName[0] };
    if (byCode.length > 1 || byName.length > 1) return { ambiguous: true };
  }
  return {};
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY (Sri Lankan order), DD-MM-YYYY and DD.MM.YYYY. */
export function parseImportDate(value: unknown): { value?: string; invalid?: boolean } {
  const raw = text(value, 40);
  if (!raw) return {};
  let year: number;
  let month: number;
  let day: number;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  const local = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (local) [day, month, year] = [Number(local[1]), Number(local[2]), Number(local[3])];
  else return { invalid: true };
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return { invalid: true };
  if (year < 1950 || year > 2100) return { invalid: true };
  return { value: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

function parseAmount(value: unknown): { value?: number; invalid?: boolean } {
  const raw = text(value, 40).replace(/,/g, "").replace(/^(lkr|rs\.?)\s*/i, "");
  if (!raw) return {};
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return { invalid: true };
  return { value: Math.round(parsed * 100) / 100 };
}

const STATUS_WORDS: Record<string, (typeof ASSET_IMPORT_STATUSES)[number]> = {
  draft: "DRAFT",
  active: "ACTIVE",
  inactive: "INACTIVE",
  "under maintenance": "UNDER_MAINTENANCE",
  "out of service": "OUT_OF_SERVICE"
};

function parseStatus(value: unknown): { value?: string; invalid?: boolean } {
  const key = matchKey(value).replace(/_/g, " ");
  if (!key) return { value: "DRAFT" };
  const status = STATUS_WORDS[key];
  return status ? { value: status } : { invalid: true };
}

function parseCriticality(value: unknown): { value?: string; invalid?: boolean } {
  const key = matchKey(value).split(" ")[0];
  if (!key) return { value: "MEDIUM" };
  const upper = key.toUpperCase();
  return (ASSET_IMPORT_CRITICALITIES as readonly string[]).includes(upper) ? { value: upper } : { invalid: true };
}

/** Old fixed category (drives the tag prefix: AST-MCH…, AST-EQP…). */
const DOMAIN_LEGACY_CATEGORY: Record<string, string> = {
  PLANT_MACHINERY: "MACHINE",
  MATERIAL_HANDLING: "MACHINE",
  TOOLS_MOULDS_JIGS: "TOOL",
  FACILITY_CIVIL: "INFRASTRUCTURE",
  EXTERNAL_INFRASTRUCTURE: "INFRASTRUCTURE",
  PLUMBING: "INFRASTRUCTURE",
  FARM_INFRASTRUCTURE: "INFRASTRUCTURE",
  OTHER: "OTHER"
};

const LEGACY_CATEGORIES = new Set([
  "MACHINE", "TOOL", "INFRASTRUCTURE", "EQUIPMENT", "OTHER", "TRACTOR", "HARVESTER", "SPRAYER",
  "IRRIGATION_PUMP", "IRRIGATION_PIPE", "GREENHOUSE", "BARN", "STORAGE_SILO", "COLD_ROOM", "MILKING_MACHINE"
]);

export function legacyCategoryFor(domain: ImportDomain, category: ImportCategory): string {
  const fromCategory = String(category.legacyEnum ?? "").toUpperCase();
  if (LEGACY_CATEGORIES.has(fromCategory)) return fromCategory;
  return DOMAIN_LEGACY_CATEGORY[String(domain.code).toUpperCase()] ?? "EQUIPMENT";
}

/** Next free AST-<prefix><nnnn> numbers, skipping tags already used in the system or the file. */
export class AssetTagNumberer {
  private readonly taken: Set<string>;
  private readonly next = new Map<string, number>();

  constructor(takenTags: Iterable<string>) {
    this.taken = new Set(Array.from(takenTags, (tag) => tag.toUpperCase()));
  }

  reserve(tag: string) {
    this.taken.add(tag.toUpperCase());
  }

  isTaken(tag: string) {
    return this.taken.has(tag.toUpperCase());
  }

  take(legacyCategory: string): string {
    const prefix = `AST-${assetTagTypeCode(legacyCategory)}`;
    let number = this.next.get(prefix);
    if (number === undefined) {
      number = 0;
      for (const tag of this.taken) {
        if (!tag.startsWith(prefix)) continue;
        const match = tag.slice(prefix.length).match(/^(\d+)$/);
        if (match) number = Math.max(number, Number(match[1]));
      }
      number += 1;
    }
    let tag = `${prefix}${String(number).padStart(4, "0")}`;
    while (this.taken.has(tag)) {
      number += 1;
      tag = `${prefix}${String(number).padStart(4, "0")}`;
    }
    this.next.set(prefix, number + 1);
    this.taken.add(tag);
    return tag;
  }
}

/** Tag prefixes the file could auto-number (so the service can load the tags already used). */
export function autoTagPrefixes(): string[] {
  return Array.from(new Set([...LEGACY_CATEGORIES].map((category) => `AST-${assetTagTypeCode(category)}`)));
}

function uniqueValues(rows: AssetImportRowInput[], key: AssetImportColumnKey): string[] {
  return Array.from(new Set(rows.map((row) => text(row[key], 120)).filter(Boolean)));
}

/** Values to look up among existing assets before planning. */
export function importLookupKeys(rows: AssetImportRowInput[]) {
  return {
    tags: Array.from(
      new Set([...uniqueValues(rows, "assetTag"), ...uniqueValues(rows, "parentAssetTag")].map((tag) => tag.toUpperCase()))
    ),
    serials: uniqueValues(rows, "serialNumber"),
    fixedAssetCodes: uniqueValues(rows, "fixedAssetCode")
  };
}

/**
 * Checks every row of the file against the master data and existing assets.
 * `updateExisting`: rows that match an existing asset update it instead of being skipped.
 */
export function planAssetImport(
  rows: AssetImportRowInput[],
  data: AssetImportMasterData,
  options: { updateExisting?: boolean } = {}
): AssetImportPreview {
  const numberer = new AssetTagNumberer(data.takenTags);
  const existingByTag = new Map(data.existing.map((asset) => [asset.assetTag.toUpperCase(), asset]));
  const existingBySerial = new Map<string, ImportExistingAsset[]>();
  const existingByCode = new Map<string, ImportExistingAsset[]>();
  for (const asset of data.existing) {
    if (asset.serialNumber) existingBySerial.set(matchKey(asset.serialNumber), [...(existingBySerial.get(matchKey(asset.serialNumber)) ?? []), asset]);
    if (asset.fixedAssetCode) existingByCode.set(matchKey(asset.fixedAssetCode), [...(existingByCode.get(matchKey(asset.fixedAssetCode)) ?? []), asset]);
  }
  for (const asset of data.existing) numberer.reserve(asset.assetTag);

  // Tags typed in the file are reserved first, so auto numbers never collide with them.
  for (const row of rows) {
    const tag = String(normalizeAssetTag(text(row.assetTag, 64)) ?? "");
    if (tag && !row.autoTag) numberer.reserve(tag);
  }

  const seenTags = new Map<string, number>();
  const seenSerials = new Map<string, number>();
  const seenCodes = new Map<string, number>();
  const seenAutoTags = new Set<string>();
  const seenExisting = new Map<string, number>();
  const lines: AssetImportLine[] = rows.map((input, index) => {
    const row = Number(input.row) || index + 2;
    const messages: string[] = [];
    const warnings: string[] = [];
    const display = {
      assetGroup: text(input.assetGroup, 120),
      category: text(input.category, 120),
      type: text(input.type, 120),
      site: text(input.site, 120),
      functionalLocation: text(input.functionalLocation, 160),
      department: text(input.department, 120),
      responsiblePerson: text(input.responsiblePerson, 160),
      parentAssetTag: String(normalizeAssetTag(text(input.parentAssetTag, 64)) ?? "")
    };

    const name = text(input.name, 160);
    if (!name) messages.push("Name is missing.");
    else if (name.length < 2) messages.push("Name must have at least 2 characters.");

    const notFound = (label: string, value: string, options: Named[]) => {
      const hint = closestName(value, options);
      messages.push(`${label} "${value}" is not in the system.${hint ? ` Did you mean "${hint}"?` : ""}`);
    };

    // Asset group → Category → Type
    let domain: ImportDomain | undefined;
    if (!display.assetGroup) messages.push("Asset group is missing.");
    else {
      const found = findByNameOrCode(display.assetGroup, data.domains);
      if (found.match) domain = found.match;
      else notFound("Asset group", display.assetGroup, data.domains);
    }
    let category: ImportCategory | undefined;
    if (!display.category) messages.push("Category is missing.");
    else {
      const pool = domain ? data.categories.filter((option) => option.domainId === domain!.id) : data.categories;
      const found = findByNameOrCode(display.category, pool);
      if (found.match) category = found.match;
      else if (found.ambiguous) messages.push(`Category "${display.category}" is in more than one asset group. Fill in the asset group.`);
      else if (domain) {
        const elsewhere = findByNameOrCode(display.category, data.categories).match;
        const elsewhereGroup = elsewhere ? data.domains.find((option) => option.id === elsewhere.domainId) : undefined;
        if (elsewhereGroup) messages.push(`Category "${display.category}" is under asset group "${elsewhereGroup.name}", not "${domain.name}".`);
        else notFound("Category", display.category, pool.length ? pool : data.categories);
      } else if (display.assetGroup) {
        // Group already reported; nothing more to add.
      } else notFound("Category", display.category, data.categories);
    }
    if (category && !domain) domain = data.domains.find((option) => option.id === category!.domainId);
    if (domain) display.assetGroup = domain.name;
    if (category) display.category = category.name;
    let type: ImportType | undefined;
    if (display.type && category) {
      const pool = data.types.filter((option) => option.categoryId === category!.id);
      const found = findByNameOrCode(display.type, pool);
      if (found.match) {
        type = found.match;
        display.type = type.name;
      } else notFound(`Type (under ${category.name})`, display.type, pool);
    }

    // Site → Functional location
    let site: ImportSite | undefined;
    if (!display.site) messages.push("Site is missing.");
    else {
      const found = findByNameOrCode(display.site, data.sites);
      if (found.match) {
        site = found.match;
        display.site = site.name;
      } else if (found.ambiguous) messages.push(`More than one site matches "${display.site}". Use the site code.`);
      else notFound("Site", display.site, data.sites);
    }
    let location: ImportLocation | undefined;
    if (display.functionalLocation && site) {
      const pool = data.locations.filter((option) => option.siteId === site!.id);
      const found = findByNameOrCode(display.functionalLocation, pool);
      if (found.match) {
        location = found.match;
        display.functionalLocation = `${location.code} — ${location.name}`;
      } else if (found.ambiguous) messages.push(`More than one location at ${site.name} matches "${display.functionalLocation}". Use the location code.`);
      else notFound(`Functional location (at ${site.name})`, display.functionalLocation, pool);
    }

    let department: ImportDepartment | undefined;
    if (display.department) {
      const found = findByNameOrCode(display.department, data.departments);
      if (found.match) {
        department = found.match;
        display.department = department.name;
      } else notFound("Department", display.department, data.departments);
    }

    let responsibleId: string | undefined;
    if (display.responsiblePerson) {
      const key = matchKey(display.responsiblePerson);
      const byEmail = data.users.filter((user) => user.email.toLowerCase() === display.responsiblePerson.toLowerCase());
      const byName = data.users.filter((user) => matchKey(user.name) === key);
      const match = byEmail.length === 1 ? byEmail[0] : byName.length === 1 ? byName[0] : undefined;
      if (match) {
        responsibleId = match.id;
        display.responsiblePerson = match.name || match.email;
      } else if (byName.length > 1) messages.push(`More than one user is called "${display.responsiblePerson}". Use their email.`);
      else messages.push(`Responsible person "${display.responsiblePerson}" is not a user. Use their login email.`);
    }

    const criticality = parseCriticality(input.criticality);
    if (criticality.invalid) messages.push("Criticality must be Low, Medium, High or Critical.");
    const status = parseStatus(input.status);
    if (status.invalid) messages.push("Status must be Draft, Active, Inactive, Under maintenance or Out of service.");
    const purchaseDate = parseImportDate(input.purchaseDate);
    if (purchaseDate.invalid) messages.push("Purchase date must be a date (e.g. 2024-03-15 or 15/03/2024).");
    const warrantyExpiry = parseImportDate(input.warrantyExpiry);
    if (warrantyExpiry.invalid) messages.push("Warranty expiry must be a date (e.g. 2026-03-15 or 15/03/2026).");
    if (purchaseDate.value && warrantyExpiry.value && warrantyExpiry.value < purchaseDate.value) {
      messages.push("Warranty expiry cannot be before the purchase date.");
    }
    const purchasePrice = parseAmount(input.purchasePrice);
    if (purchasePrice.invalid) messages.push("Purchase price must be a number of 0 or more.");

    const serialNumber = text(input.serialNumber, 120);
    const fixedAssetCode = text(input.fixedAssetCode, 64);
    const typedTag = String(normalizeAssetTag(text(input.assetTag, 64)) ?? "");
    if (typedTag && !input.autoTag && !isValidAssetTag(typedTag)) {
      messages.push("Asset tag must look like AST-MCH0001 (AST- then at least 4 letters or numbers).");
    }

    // Same tag / serial / code twice in the file.
    if (typedTag && !input.autoTag) {
      const first = seenTags.get(typedTag);
      if (first) messages.push(`Asset tag ${typedTag} is also on row ${first}.`);
      else seenTags.set(typedTag, row);
    }
    if (serialNumber) {
      const first = seenSerials.get(matchKey(serialNumber));
      if (first) messages.push(`Serial number ${serialNumber} is also on row ${first}.`);
      else seenSerials.set(matchKey(serialNumber), row);
    }
    if (fixedAssetCode) {
      const first = seenCodes.get(matchKey(fixedAssetCode));
      if (first) messages.push(`ERP / fixed asset code ${fixedAssetCode} is also on row ${first}.`);
      else seenCodes.set(matchKey(fixedAssetCode), row);
    }

    // Already in the system? Tag first, then serial number, then fixed asset code.
    let existing: ImportExistingAsset | undefined;
    let matchedBy = "";
    if (typedTag && existingByTag.has(typedTag)) {
      const sameTag = existingByTag.get(typedTag)!;
      // A tag the system numbered matches only when it is the same asset (a save sent twice).
      if (!input.autoTag || (matchKey(sameTag.name) === matchKey(name) && !messages.length)) {
        existing = sameTag;
        matchedBy = "asset tag";
      }
    }
    if (!existing && serialNumber) {
      const found = existingBySerial.get(matchKey(serialNumber)) ?? [];
      if (found.length > 1) messages.push(`Serial number ${serialNumber} is on more than one asset in the system.`);
      else if (found[0]) {
        existing = found[0];
        matchedBy = "serial number";
      }
    }
    if (!existing && fixedAssetCode) {
      const found = existingByCode.get(matchKey(fixedAssetCode)) ?? [];
      if (found.length > 1) messages.push(`ERP / fixed asset code ${fixedAssetCode} is on more than one asset in the system.`);
      else if (found[0]) {
        existing = found[0];
        matchedBy = "ERP / fixed asset code";
      }
    }
    if (existing) {
      const first = seenExisting.get(existing.id);
      if (first) messages.push(`Row ${first} is the same asset (${existing.assetTag}).`);
      else seenExisting.set(existing.id, row);
    }
    if (existing && typedTag && !input.autoTag && typedTag !== existing.assetTag.toUpperCase()) {
      messages.push(`This ${matchedBy} belongs to ${existing.assetTag} in the system, but the row says ${typedTag}.`);
    }

    const legacy = domain && category ? legacyCategoryFor(domain, category) : "OTHER";
    let assetTag = typedTag;
    let autoTag = false;
    if (existing) {
      assetTag = existing.assetTag;
    } else if (!typedTag || input.autoTag) {
      // The system numbers the tag; a tag the system filled in before is kept when still free.
      if (typedTag && input.autoTag && isValidAssetTag(typedTag) && !existingByTag.has(typedTag) && !seenAutoTags.has(typedTag)) {
        assetTag = typedTag;
        numberer.reserve(typedTag);
      } else assetTag = messages.length ? "" : numberer.take(legacy);
      if (assetTag) seenAutoTags.add(assetTag);
      autoTag = true;
    }

    const base: AssetImportLine = {
      row,
      status: "ERROR",
      messages,
      warnings,
      assetTag,
      autoTag,
      name,
      display
    };
    if (existing) {
      base.existingAssetId = existing.id;
      base.existingAssetTag = existing.assetTag;
    }
    if (messages.length || !domain || !category || !site) return base;

    if (existing && !options.updateExisting) {
      return { ...base, status: "SKIP", messages: [`Already in the system as ${existing.assetTag} (same ${matchedBy}).`] };
    }
    if (existing) {
      if ((existing.siteId && existing.siteId !== site.id) || (location && existing.functionalLocationId !== location.id)) {
        warnings.push("Site / location is not changed here. Use Move on the asset to change where it is.");
      }
      if (text(input.status)) warnings.push("Status is not changed here. Change it on the asset.");
    }

    const payload: AssetImportPayload = {
      assetTag,
      name,
      category: legacy,
      domainId: domain.id,
      categoryMasterId: category.id,
      typeMasterId: type?.id,
      siteId: site.id,
      functionalLocationId: location?.id,
      departmentId: department?.id,
      serialNumber: serialNumber || undefined,
      manufacturer: text(input.manufacturer, 120) || undefined,
      model: text(input.model, 120) || undefined,
      criticalityLevel: criticality.value ?? "MEDIUM",
      status: status.value ?? "DRAFT",
      fixedAssetCode: fixedAssetCode || undefined,
      purchaseDate: purchaseDate.value,
      purchasePrice: purchasePrice.value,
      warrantyExpiry: warrantyExpiry.value,
      supplier: text(input.supplier, 160) || undefined,
      responsiblePersonId: responsibleId,
      description: text(input.notes, 1000) || undefined
    };
    return { ...base, status: existing ? "UPDATE" : "NEW", payload };
  });

  // Parent asset tags: an asset already in the system, or another row of this file.
  const fileRowsByTag = new Map(lines.filter((line) => line.assetTag).map((line) => [line.assetTag.toUpperCase(), line]));
  for (const line of lines) {
    const parentTag = line.display.parentAssetTag;
    if (!parentTag || (line.status !== "NEW" && line.status !== "UPDATE")) continue;
    const inSystem = existingByTag.get(parentTag);
    const inFile = fileRowsByTag.get(parentTag);
    if (parentTag === line.assetTag.toUpperCase()) {
      line.status = "ERROR";
      line.messages.push("An asset cannot be its own parent.");
    } else if (inSystem) {
      if (line.payload) line.payload.parentAssetId = inSystem.id;
    } else if (inFile?.status === "NEW") {
      line.parentRowTag = parentTag;
    } else if (inFile) {
      line.status = "ERROR";
      line.messages.push(`Parent ${parentTag} (row ${inFile.row}) has errors. Fix that row first.`);
    } else {
      line.status = "ERROR";
      line.messages.push(`Parent asset ${parentTag} is not in the system or in this file.`);
    }
  }
  // Parent chains inside the file must not loop (A → B → A).
  for (const line of lines) {
    const visited = new Set<string>([line.assetTag.toUpperCase()]);
    let cursor = line.parentRowTag;
    while (cursor) {
      if (visited.has(cursor)) {
        line.status = "ERROR";
        line.messages.push("Parent asset tags go round in a circle.");
        line.parentRowTag = undefined;
        break;
      }
      visited.add(cursor);
      cursor = fileRowsByTag.get(cursor)?.parentRowTag;
    }
  }
  // A child whose new parent row cannot be saved cannot be saved either (repeat for chains).
  let changed = true;
  while (changed) {
    changed = false;
    for (const line of lines) {
      const parent = line.parentRowTag ? fileRowsByTag.get(line.parentRowTag) : undefined;
      if (line.status !== "ERROR" && parent && parent.status === "ERROR") {
        line.status = "ERROR";
        line.messages.push(`Parent ${line.parentRowTag} (row ${parent.row}) has errors. Fix that row first.`);
        changed = true;
      }
    }
  }
  for (const line of lines) {
    if (line.status === "ERROR") line.payload = undefined;
  }

  const counts = { total: lines.length, new: 0, update: 0, skip: 0, error: 0 };
  for (const line of lines) {
    if (line.status === "NEW") counts.new += 1;
    else if (line.status === "UPDATE") counts.update += 1;
    else if (line.status === "SKIP") counts.skip += 1;
    else counts.error += 1;
  }
  return { lines, counts };
}

/** Save order: a parent that is new in the file is created before its children. */
export function saveOrder(lines: AssetImportLine[]): AssetImportLine[] {
  const byTag = new Map(lines.map((line) => [line.assetTag.toUpperCase(), line]));
  const done = new Set<AssetImportLine>();
  const ordered: AssetImportLine[] = [];
  const visit = (line: AssetImportLine, depth: number) => {
    if (done.has(line) || depth > lines.length) return;
    const parent = line.parentRowTag ? byTag.get(line.parentRowTag) : undefined;
    if (parent) visit(parent, depth + 1);
    done.add(line);
    ordered.push(line);
  };
  for (const line of lines) visit(line, 0);
  return ordered;
}
