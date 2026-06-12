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
