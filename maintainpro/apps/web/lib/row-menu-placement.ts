type Rect = { top: number; bottom: number; left: number; right: number };

const GAP = 4;
const EDGE = 8;

/**
 * Fixed-position placement for a row menu: below the button when it fits, otherwise above it
 * (rows near the bottom of the screen or above the mobile bottom nav), kept inside the viewport.
 */
export function rowMenuPlacement(input: {
  anchor: Rect;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Space reserved at the bottom (mobile bottom nav). */
  bottomInset?: number;
}): { top: number; left: number; upward: boolean } {
  const { anchor, menuWidth, menuHeight, viewportWidth, viewportHeight } = input;
  const bottomLimit = viewportHeight - (input.bottomInset ?? 72);
  const spaceBelow = bottomLimit - anchor.bottom;
  const upward = spaceBelow < menuHeight + GAP && anchor.top - EDGE > spaceBelow;
  const rawTop = upward ? anchor.top - GAP - menuHeight : anchor.bottom + GAP;
  const top = Math.max(EDGE, Math.min(rawTop, viewportHeight - menuHeight - EDGE));
  const rawLeft = anchor.right - menuWidth;
  const left = Math.max(EDGE, Math.min(rawLeft, viewportWidth - menuWidth - EDGE));
  return { top, left, upward };
}
