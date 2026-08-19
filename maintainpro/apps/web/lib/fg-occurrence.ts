export const FG_INDEPENDENT_OCCURRENCE_FORMS = new Set(["NMS/PPU/CL/18", "NMS/PPU/CL/30"]);
export const FG_ONE_PER_DAY_FORMS = new Set(["NMS/PPU/CL/24"]);

export type FgOccurrenceStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function formUsesIndependentOccurrences(formCode: string): boolean {
  return FG_INDEPENDENT_OCCURRENCE_FORMS.has(formCode);
}

export function formUsesOneRecordPerDay(formCode: string): boolean {
  return FG_ONE_PER_DAY_FORMS.has(formCode);
}

/**
 * Authoritative multiplicity for Next.js. Do not copy a stale Django JSON API
 * that reports CL18/CL30 as one_per_day. Server uniqueness still wins: the
 * frontend only supplies an occurrence token; Django must enforce it.
 */
export function controlledFormMultiplicity(formCode: string): "one_per_day" | "independent_occurrence" | "one_per_day_per_room" {
  if (formCode === "NMS/PPU/CL/39") {
    return "one_per_day_per_room";
  }
  if (formUsesIndependentOccurrences(formCode)) {
    return "independent_occurrence";
  }
  return "one_per_day";
}

export function occurrenceIntentStorageKey(formCode: string, date: string): string {
  return `fg-occurrence-intent:${formCode}:${date}`;
}

function defaultStorage(): FgOccurrenceStorage | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  return sessionStorage;
}

function mintToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Same create intent (retry, double-click, rerender, refresh, back/forward)
 * reuses the in-flight token. A new create action after consumeOccurrenceIntent
 * mints a new token.
 */
export function getOrCreateOccurrenceToken(
  formCode: string,
  date: string,
  storage: FgOccurrenceStorage | null = defaultStorage()
): string {
  const key = occurrenceIntentStorageKey(formCode, date);
  if (!storage) {
    return mintToken();
  }
  const existing = storage.getItem(key);
  if (existing) {
    return existing;
  }
  const next = mintToken();
  storage.setItem(key, next);
  return next;
}

export function consumeOccurrenceIntent(
  formCode: string,
  date: string,
  storage: FgOccurrenceStorage | null = defaultStorage()
): void {
  storage?.removeItem(occurrenceIntentStorageKey(formCode, date));
}
