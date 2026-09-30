import { getDefaultFavoriteNavIds } from "../../web/lib/navigation";
import {
  effectiveFavoriteIds,
  favoritesStorageKey,
  hydrateFavoriteIds,
  NAV_FAVORITES_CHANGED_EVENT,
  readFavoritePreference,
  toggleFavoriteNavId,
  writeFavoriteNavIds
} from "../../web/lib/nav-favorites";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, String(value));
    }
  };
}

describe("sidebar favorite persistence", () => {
  it("treats a first load with no saved favorites as empty", () => {
    const storage = memoryStorage();
    const preference = readFavoritePreference("user-a", storage);

    expect(preference).toEqual({ saved: false, ids: [] });
    expect(hydrateFavoriteIds(preference)).toEqual([]);
    expect(getDefaultFavoriteNavIds("ADMIN").length).toBeGreaterThan(0);
    expect(hydrateFavoriteIds(preference)).not.toEqual(getDefaultFavoriteNavIds("ADMIN"));
  });

  it("keeps a pinned item after a later read", () => {
    const storage = memoryStorage();
    const pinned = toggleFavoriteNavId("user-a", "work-orders", [], storage);

    expect(pinned).toEqual(["work-orders"]);
    expect(readFavoritePreference("user-a", storage)).toEqual({
      saved: true,
      ids: ["work-orders"]
    });
  });

  it("keeps an unpinned item out after a later read", () => {
    const storage = memoryStorage();
    toggleFavoriteNavId("user-a", "work-orders", [], storage);
    const remaining = toggleFavoriteNavId(
      "user-a",
      "work-orders",
      readFavoritePreference("user-a", storage).ids,
      storage
    );

    expect(remaining).toEqual([]);
    expect(readFavoritePreference("user-a", storage)).toEqual({ saved: true, ids: [] });
  });

  it("keeps an intentionally empty list empty", () => {
    const storage = memoryStorage();
    writeFavoriteNavIds("user-a", [], storage);

    const preference = readFavoritePreference("user-a", storage);
    expect(preference.saved).toBe(true);
    expect(hydrateFavoriteIds(preference)).toEqual([]);
    expect(hydrateFavoriteIds(preference)).not.toEqual(getDefaultFavoriteNavIds("TECHNICIAN"));
  });

  it("does not turn a saved empty list into role defaults", () => {
    const empty = hydrateFavoriteIds({ saved: true, ids: [] });
    const unset = hydrateFavoriteIds({ saved: false, ids: [] });

    expect(empty).toEqual([]);
    expect(unset).toEqual([]);
  });

  it("stores a pinned id only once", () => {
    const storage = memoryStorage();
    writeFavoriteNavIds("user-a", ["work-orders", "work-orders", "reports"], storage);

    expect(readFavoritePreference("user-a", storage).ids).toEqual(["work-orders", "reports"]);
    expect(effectiveFavoriteIds(["work-orders", "work-orders"], ["work-orders"])).toEqual(["work-orders"]);
  });

  it("hides an unauthorized saved favorite without pinning newly available routes", () => {
    const saved = ["admin", "work-orders"];
    expect(effectiveFavoriteIds(saved, ["work-orders"])).toEqual(["work-orders"]);
    expect(effectiveFavoriteIds(saved, ["work-orders", "reports"])).toEqual(["work-orders"]);
    expect(effectiveFavoriteIds(saved, ["admin", "work-orders"])).toEqual(["admin", "work-orders"]);
  });

  it("does not leak one user's favorites to another user", () => {
    const storage = memoryStorage();
    writeFavoriteNavIds("user-a", ["reports"], storage);

    expect(favoritesStorageKey("user-a")).not.toBe(favoritesStorageKey("user-b"));
    expect(readFavoritePreference("user-b", storage)).toEqual({ saved: false, ids: [] });
    expect(readFavoritePreference("user-a", storage).ids).toEqual(["reports"]);
  });

  it("publishes one change that another shell reader can load from the same store", () => {
    const storage = memoryStorage();
    const seen: string[] = [];
    const fakeWindow = {
      addEventListener(type: string, listener: EventListener) {
        if (type === NAV_FAVORITES_CHANGED_EVENT) {
          seen.push(type);
          void listener;
        }
      },
      dispatchEvent(event: Event) {
        if (event.type === NAV_FAVORITES_CHANGED_EVENT) {
          seen.push((event as CustomEvent<string | null>).detail ?? "");
        }
        return true;
      }
    };
    const previous = globalThis.window;
    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });

    try {
      toggleFavoriteNavId("user-a", "assets", [], storage);
      const desktop = readFavoritePreference("user-a", storage).ids;
      const mobile = readFavoritePreference("user-a", storage).ids;
      expect(desktop).toEqual(["assets"]);
      expect(mobile).toEqual(desktop);
      expect(seen).toContain("user-a");
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previous });
    }
  });
});
