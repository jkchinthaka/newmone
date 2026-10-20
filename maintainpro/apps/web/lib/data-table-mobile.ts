export type MobileVisibleColumn = {
  hideOnMobile?: boolean;
};

export function getVisibleMobileColumns<T extends MobileVisibleColumn>(
  columns: readonly T[]
): readonly T[] {
  return columns.filter((column) => !column.hideOnMobile);
}

export function dataTableMobileCardIncludesActions(hasActions: boolean): boolean {
  return hasActions;
}

/** Row click is a keyboard target only when the row has no separate action controls. */
export function dataTableRowIsKeyboardTarget(hasRowClick: boolean, hasActions: boolean): boolean {
  return hasRowClick && !hasActions;
}

/** Preferred breakpoint: show card list below `md`, table at `md+`. */
export const RESPONSIVE_TABLE_CARD_BREAKPOINT = "md" as const;

export function shouldPreferMobileRecordCards(viewportWidth: number): boolean {
  return viewportWidth < 768;
}

