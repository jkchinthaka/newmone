export function validatePromptInput(
  value: string,
  options?: { required?: boolean; requiredMessage?: string; validate?: (value: string) => string | null }
): string | null {
  const trimmed = value.trim();

  if (options?.required && !trimmed) {
    return options.requiredMessage ?? "This field is required.";
  }

  if (options?.validate) {
    return options.validate(trimmed);
  }

  return null;
}
