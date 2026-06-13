import {
  getVisibleNavigationItems,
  NAV_CATEGORY_LABELS,
  type NavigationItem
} from "./navigation";
import { DEFAULT_POST_LOGIN_REDIRECT, LEGACY_FMS_HOME_PATH } from "./role-redirect";

export type CommandPaletteItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  category: string;
  keywords: readonly string[];
  legacy?: boolean;
};

const EXTRA_KEYWORDS: Record<string, readonly string[]> = {
  dashboard: ["overview", "summary"],
  "action-center": ["priorities", "attention", "operations", "briefing"],
  facilities: ["buildings", "rooms", "property", "hierarchy", "facility"],
  "facilities-reports": ["facility reports", "facility kpi", "facility dashboard", "issues summary"],
  "work-orders": ["wo", "maintenance jobs", "jobs"],
  assets: ["equipment", "registry"],
  inventory: ["parts", "stock", "spares"],
  procurement: ["purchase", "po", "suppliers"],
  fleet: ["tracking", "gps"],
  vehicles: ["trucks", "cars"],
  reports: ["analytics", "kpi"],
  "system-health": ["status", "integrations", "health"],
  "admin-console": ["admin", "administration", "platform"],
  compliance: ["safety", "audit"],
  cleaning: ["janitorial", "hygiene"],
  "legacy-fms-archive": ["legacy", "archive", "fms"]
};

export function navigationItemToCommand(item: NavigationItem): CommandPaletteItem {
  const category = NAV_CATEGORY_LABELS[item.category];
  const baseKeywords = [
    item.label.toLowerCase(),
    item.id.replace(/-/g, " "),
    category.toLowerCase(),
    item.href.replace(/^\//, "").replace(/\//g, " ")
  ];

  if (item.description) {
    baseKeywords.push(item.description.toLowerCase());
  }

  const keywords = [...new Set([...baseKeywords, ...(EXTRA_KEYWORDS[item.id] ?? [])])];

  return {
    id: item.id,
    label: item.label,
    description: item.description ?? `Navigate to ${item.label}`,
    href: item.href,
    category,
    keywords,
    legacy: item.legacy
  };
}

export function getCommandPaletteItems(roleName: string | null | undefined): CommandPaletteItem[] {
  return getVisibleNavigationItems(roleName).map(navigationItemToCommand);
}

export function filterCommandPaletteItems(
  items: readonly CommandPaletteItem[],
  query: string
): CommandPaletteItem[] {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return [...items];
  }

  return items.filter((item) => {
    if (item.label.toLowerCase().includes(trimmed)) {
      return true;
    }

    if (item.description.toLowerCase().includes(trimmed)) {
      return true;
    }

    if (item.category.toLowerCase().includes(trimmed)) {
      return true;
    }

    return item.keywords.some((keyword) => keyword.includes(trimmed));
  });
}

export function usesLegacyHomeAsDashboard(items: readonly CommandPaletteItem[]): boolean {
  return items.some(
    (item) =>
      !item.legacy &&
      (item.href === LEGACY_FMS_HOME_PATH || item.label.toLowerCase() === "home")
  );
}

export function getPrimaryDashboardCommand(
  items: readonly CommandPaletteItem[]
): CommandPaletteItem | undefined {
  return items.find(
    (item) => item.href === DEFAULT_POST_LOGIN_REDIRECT && item.label === "Dashboard"
  );
}

export function shouldIgnoreCommandPaletteShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();

  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return false;
}

export function isCommandPaletteShortcut(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">
): boolean {
  if (event.key.toLowerCase() !== "k") {
    return false;
  }

  if (event.altKey || event.shiftKey) {
    return false;
  }

  return event.ctrlKey || event.metaKey;
}
