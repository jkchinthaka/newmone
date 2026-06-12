export type AriaExpanded = "true" | "false";
export type AriaSort = "ascending" | "descending" | "none";
export type AriaCurrentPage = "page";

export const MOBILE_NAV_DRAWER_ID = "mobile-navigation-drawer";
export const MOBILE_MENU_BUTTON_ID = "mobile-navigation-button";

export function toAriaExpanded(isOpen: boolean): AriaExpanded {
  return isOpen ? "true" : "false";
}

export function toNavAriaCurrent(isActive: boolean): AriaCurrentPage | undefined {
  return isActive ? "page" : undefined;
}

export function toBreadcrumbAriaCurrent(isLast: boolean): AriaCurrentPage | undefined {
  return isLast ? "page" : undefined;
}

export function toSortAriaSort(
  isActive: boolean,
  direction: "asc" | "desc"
): AriaSort {
  if (!isActive) {
    return "none";
  }

  return direction === "asc" ? "ascending" : "descending";
}

export function getAccessibleLabel(
  visibleLabel: string,
  fullLabel: string
): string | undefined {
  return visibleLabel === fullLabel ? undefined : fullLabel;
}

export function joinAriaDescribedBy(...ids: Array<string | undefined | null>): string | undefined {
  const next = ids.filter((id): id is string => Boolean(id && id.trim()));
  return next.length > 0 ? next.join(" ") : undefined;
}
