/** Inline validation stays hidden until the user edits the field or tries to submit. */

export function visibleFieldMessage(
  message: string | null | undefined,
  state: { touched: boolean; submitAttempted: boolean }
): string {
  const text = message?.trim() ?? "";
  if (!text || (!state.touched && !state.submitAttempted)) return "";
  return text;
}
