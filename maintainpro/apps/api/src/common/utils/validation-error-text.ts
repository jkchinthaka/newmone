import type { ValidationError } from "class-validator";

export function validationErrorText(errors: ValidationError[]): { messages: string[]; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  const messages: string[] = [];

  const walk = (items: ValidationError[], prefix: string) => {
    for (const error of items) {
      const path = prefix ? `${prefix}.${error.property}` : error.property;
      const texts = Object.values(error.constraints ?? {});
      if (texts.length > 0) {
        fieldErrors[path] = texts;
        for (const text of texts) {
          messages.push(`${path}: ${text}`);
        }
      }
      if (error.children?.length) walk(error.children, path);
    }
  };

  walk(errors, "");
  return {
    messages: messages.length > 0 ? messages : ["Request validation failed"],
    fieldErrors
  };
}
