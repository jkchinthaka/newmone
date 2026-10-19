/** Disables the clicked submit control before React re-renders. */
export function disableSubmitControl(
  control: { disabled?: boolean; querySelector?: (selector: string) => { disabled?: boolean } | null } | null
): void {
  if (!control) return;
  if (typeof control.disabled === "boolean" && typeof control.querySelector !== "function") {
    control.disabled = true;
    return;
  }
  const button = control.querySelector?.('button[type="submit"]');
  if (button) button.disabled = true;
}
