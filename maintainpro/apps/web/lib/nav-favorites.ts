const FAVORITES_STORAGE_PREFIX = "maintainpro_nav_favorites";

export const NAV_FAVORITES_CHANGED_EVENT = "maintainpro-nav-favorites-changed";

export type FavoritePreference = {
  /** False when this user has never saved a favorite list. */
  saved: boolean;
  ids: string[];
};

export function favoritesStorageKey(userId: string | null | undefined): string {
  const id = userId?.trim() || "anonymous";
  return `${FAVORITES_STORAGE_PREFIX}:${id}`;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => id.trim().length > 0))];
}

function browserWindow(): Window | null {
  if (typeof globalThis.window === "undefined") {
    return null;
  }
  return globalThis.window;
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage) {
    return storage;
  }
  return browserWindow()?.localStorage ?? null;
}

export function readFavoritePreference(
  userId: string | null | undefined,
  storage?: Storage | null
): FavoritePreference {
  const target = resolveStorage(storage);
  if (!target) {
    return { saved: false, ids: [] };
  }

  try {
    const raw = target.getItem(favoritesStorageKey(userId));
    if (raw == null) {
      return { saved: false, ids: [] };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return { saved: false, ids: [] };
    }

    return {
      saved: true,
      ids: uniqueIds(parsed.filter((entry): entry is string => typeof entry === "string"))
    };
  } catch {
    return { saved: false, ids: [] };
  }
}

/**
 * A missing preference and a saved empty list both display as no favorites.
 * Neither case is filled from role defaults.
 */
export function hydrateFavoriteIds(preference: FavoritePreference): string[] {
  return preference.saved ? preference.ids : [];
}

export function readFavoriteNavIds(userId: string | null | undefined, storage?: Storage | null): string[] {
  return hydrateFavoriteIds(readFavoritePreference(userId, storage));
}

/**
 * Saved pins stay in storage. Effective favorites are that list intersected
 * with routes the current user can see. Access that returns later shows the
 * same saved pin again. A newly available route is not added.
 */
export function effectiveFavoriteIds(savedIds: readonly string[], visibleIds: readonly string[]): string[] {
  const visible = new Set(visibleIds);
  return uniqueIds(savedIds).filter((id) => visible.has(id));
}

export function writeFavoriteNavIds(
  userId: string | null | undefined,
  ids: string[],
  storage?: Storage | null
): string[] {
  const next = uniqueIds(ids);
  const target = resolveStorage(storage);
  if (!target) {
    return next;
  }

  target.setItem(favoritesStorageKey(userId), JSON.stringify(next));
  browserWindow()?.dispatchEvent(new CustomEvent(NAV_FAVORITES_CHANGED_EVENT, { detail: userId ?? null }));
  return next;
}

export function toggleFavoriteNavId(
  userId: string | null | undefined,
  navId: string,
  current: string[],
  storage?: Storage | null
): string[] {
  const normalized = uniqueIds(current);
  const next = normalized.includes(navId)
    ? normalized.filter((id) => id !== navId)
    : [...normalized, navId];

  return writeFavoriteNavIds(userId, next, storage);
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
