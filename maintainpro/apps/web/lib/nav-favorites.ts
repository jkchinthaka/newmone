const FAVORITES_STORAGE_PREFIX = "maintainpro_nav_favorites";

export function favoritesStorageKey(userId: string | null | undefined): string {
  const id = userId?.trim() || "anonymous";
  return `${FAVORITES_STORAGE_PREFIX}:${id}`;
}

export function readFavoriteNavIds(userId: string | null | undefined): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(favoritesStorageKey(userId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

export function writeFavoriteNavIds(userId: string | null | undefined, ids: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(favoritesStorageKey(userId), JSON.stringify([...new Set(ids)]));
}

export function toggleFavoriteNavId(
  userId: string | null | undefined,
  navId: string,
  current: string[]
): string[] {
  const next = current.includes(navId)
    ? current.filter((id) => id !== navId)
    : [...current, navId];

  writeFavoriteNavIds(userId, next);
  return next;
}

const FULL_NAV_STORAGE_KEY = "maintainpro_nav_full_mode";

export function readFullNavigationMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(FULL_NAV_STORAGE_KEY) === "true";
}

export function writeFullNavigationMode(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FULL_NAV_STORAGE_KEY, enabled ? "true" : "false");
}

const COLLAPSED_GROUPS_PREFIX = "maintainpro_nav_collapsed";

export function readCollapsedNavGroups(userId: string | null | undefined): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(`${COLLAPSED_GROUPS_PREFIX}:${userId ?? "anonymous"}`);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function writeCollapsedNavGroups(
  userId: string | null | undefined,
  value: Record<string, boolean>
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    `${COLLAPSED_GROUPS_PREFIX}:${userId ?? "anonymous"}`,
    JSON.stringify(value)
  );
}
