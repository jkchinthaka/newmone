export type MenuAnchorRect = {
  width: number;
  height: number;
  bottom: number;
  right: number;
};

/** Hidden layout copies have a zero-size trigger. They must not open a second menu. */
export function requestMenuPosition(
  rect: MenuAnchorRect | null | undefined,
  viewportWidth: number
): { top: number; left: number } | null {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const width = 240;
  return {
    top: rect.bottom + 4,
    left: Math.max(8, Math.min(rect.right - width, viewportWidth - width - 8))
  };
}
