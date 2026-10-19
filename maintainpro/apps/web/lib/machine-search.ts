export const MACHINE_SEARCH_DEBOUNCE_MS = 300;

export type MachineHit = {
  id: string;
  assetTag: string;
  name: string;
  serialNumber?: string | null;
  siteId?: string | null;
  functionalLocationId?: string | null;
  siteName?: string | null;
  locationName?: string | null;
};

export function normalizeMachineQuery(value: string) {
  return value.trim();
}

export function shouldSearchMachines(value: string) {
  return normalizeMachineQuery(value).length > 0;
}

/** Shared stale-response guard for machine and vehicle lookups. */
export function isCurrentSearch(sequence: number, latest: number) {
  return sequence === latest;
}

export function isCurrentMachineSearch(sequence: number, latest: number) {
  return isCurrentSearch(sequence, latest);
}

/** True when the box still shows the text that was present at selection time. */
export function machineQueryRepresentsSelection(query: string, committed: string | null) {
  return committed != null && normalizeMachineQuery(query) === committed;
}

export function readMachineHits(payload: unknown): MachineHit[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data) ? (data as MachineHit[]) : [];
}

/**
 * Deep links and QR scans may select a tag, id, or exact serial.
 * Typed search must not use this — the user selects the row.
 */
export function machineForPrefill(
  hits: MachineHit[],
  token: string,
  allowSerial = false
): MachineHit | null {
  const q = token.trim();
  if (!q) return null;
  const lower = q.toLowerCase();
  return (
    hits.find((hit) => {
      if (hit.id === q) return true;
      if (hit.assetTag.toLowerCase() === lower) return true;
      if (allowSerial && (hit.serialNumber ?? "").toLowerCase() === lower) return true;
      return false;
    }) ?? null
  );
}

export function machineLocationLabel(hit: MachineHit) {
  return hit.locationName || hit.siteName || "";
}
