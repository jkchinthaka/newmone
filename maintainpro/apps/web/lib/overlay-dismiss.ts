export type OverlayEscapeDecision = "ignore" | "close-menu" | "close-drawer";

/** Escape handling for the work-order drawer. Nested overlays and open menus win. */
export function workOrderDrawerEscapeDecision(input: {
  key: string;
  defaultPrevented: boolean;
  submitting: boolean;
  menuOpen: boolean;
  nestedOverlayOpen: boolean;
}): OverlayEscapeDecision {
  if (input.key !== "Escape" || input.defaultPrevented || input.nestedOverlayOpen) return "ignore";
  if (input.menuOpen) return "close-menu";
  if (input.submitting) return "ignore";
  return "close-drawer";
}

/** Keeps Tab inside a dialog. A nested dialog must be handled by that dialog, not this one. */
export function dialogTabTrapDecision(input: {
  key: string;
  shiftKey: boolean;
  activeInside: boolean;
  activeIsFirst: boolean;
  activeIsLast: boolean;
  focusableCount: number;
}): "ignore" | "focus-first" | "focus-last" {
  if (input.key !== "Tab" || input.focusableCount === 0) return "ignore";
  if (!input.activeInside) return input.shiftKey ? "focus-last" : "focus-first";
  if (input.shiftKey && input.activeIsFirst) return "focus-last";
  if (!input.shiftKey && input.activeIsLast) return "focus-first";
  return "ignore";
}
