import { isValidAssetTag, normalizeAssetTag } from "./dto/asset-tag";

export type AssetTagImportRow = {
  rowNumber: number;
  assetTag?: string;
  assetCode?: string;
  serialNumber?: string;
  erpCode?: string;
  vehicleRegistrationNo?: string;
  note?: string;
};

export type AssetTagCandidate = {
  id: string;
  kind: "asset" | "vehicle";
  label: string;
  assetTag?: string | null;
  assetCode?: string | null;
  serialNumber?: string | null;
  erpCode?: string | null;
  registrationNo?: string | null;
};

export type AssetTagPreviewRow = {
  rowNumber: number;
  assetTag: string;
  matchTarget: string;
  status: "valid" | "invalid";
  action: "assign" | "replace" | "unchanged" | "skip";
  message: string;
  entityId?: string;
  entityKind?: "asset" | "vehicle";
  previousTag?: string | null;
};

function key(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function matchTarget(row: AssetTagImportRow) {
  return (
    row.assetCode ||
    row.serialNumber ||
    row.erpCode ||
    row.vehicleRegistrationNo ||
    ""
  ).trim();
}

export function previewAssetTagImport(rows: AssetTagImportRow[], candidates: AssetTagCandidate[]): AssetTagPreviewRow[] {
  const seenTags = new Set<string>();
  const tagOwners = new Map<string, string>();
  for (const candidate of candidates) {
    const tag = key(candidate.assetTag);
    if (tag) tagOwners.set(tag, `${candidate.kind}:${candidate.id}`);
  }

  return rows.map((row) => {
    const assetTag = String(normalizeAssetTag(row.assetTag ?? "") ?? "");
    const target = matchTarget(row);
    if (!assetTag || !isValidAssetTag(assetTag)) {
      return {
        rowNumber: row.rowNumber,
        assetTag,
        matchTarget: target,
        status: "invalid",
        action: "skip",
        message: "Asset tag must match AST-XXXX format."
      };
    }
    if (!target) {
      return {
        rowNumber: row.rowNumber,
        assetTag,
        matchTarget: target,
        status: "invalid",
        action: "skip",
        message: "Provide assetCode, serialNumber, erpCode, or vehicleRegistrationNo."
      };
    }
    if (seenTags.has(assetTag)) {
      return {
        rowNumber: row.rowNumber,
        assetTag,
        matchTarget: target,
        status: "invalid",
        action: "skip",
        message: "Duplicate asset tag in this file."
      };
    }
    seenTags.add(assetTag);

    const wanted = key(target);
    const matches = candidates.filter((candidate) =>
      [candidate.assetCode, candidate.serialNumber, candidate.erpCode, candidate.registrationNo, candidate.assetTag, candidate.label]
        .some((value) => key(value) === wanted)
    );
    if (matches.length === 0) {
      return {
        rowNumber: row.rowNumber,
        assetTag,
        matchTarget: target,
        status: "invalid",
        action: "skip",
        message: "No asset or vehicle matched this identifier in the tenant."
      };
    }
    if (matches.length > 1) {
      return {
        rowNumber: row.rowNumber,
        assetTag,
        matchTarget: target,
        status: "invalid",
        action: "skip",
        message: "More than one asset or vehicle matched this identifier."
      };
    }
    const match = matches[0];
    const owner = tagOwners.get(assetTag);
    if (owner && owner !== `${match.kind}:${match.id}`) {
      return {
        rowNumber: row.rowNumber,
        assetTag,
        matchTarget: target,
        status: "invalid",
        action: "skip",
        message: "This asset tag is already assigned to another record in the tenant."
      };
    }
    const previous = match.assetTag?.trim() || null;
    if (previous && key(previous) === assetTag) {
      return {
        rowNumber: row.rowNumber,
        assetTag,
        matchTarget: match.label,
        status: "valid",
        action: "unchanged",
        message: "The record already has this asset tag.",
        entityId: match.id,
        entityKind: match.kind,
        previousTag: previous
      };
    }
    if (previous && key(previous) !== assetTag) {
      return {
        rowNumber: row.rowNumber,
        assetTag,
        matchTarget: match.label,
        status: "valid",
        action: "replace",
        message: "Existing tag differs. Replace requires an explicit reason.",
        entityId: match.id,
        entityKind: match.kind,
        previousTag: previous
      };
    }
    return {
      rowNumber: row.rowNumber,
      assetTag,
      matchTarget: match.label,
      status: "valid",
      action: "assign",
      message: "Ready to assign.",
      entityId: match.id,
      entityKind: match.kind,
      previousTag: null
    };
  });
}
