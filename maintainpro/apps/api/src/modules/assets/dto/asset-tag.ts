/** Same rule as the asset form: AST- plus at least four letters or digits. */
export const ASSET_TAG_PATTERN = /^AST-[A-Z0-9]{4,}$/;

export const ASSET_TAG_FORMAT_MESSAGE = "Asset tag must match AST-XXXX format";

export function normalizeAssetTag(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.trim().toUpperCase();
}

export function isValidAssetTag(value: string): boolean {
  return ASSET_TAG_PATTERN.test(value);
}
