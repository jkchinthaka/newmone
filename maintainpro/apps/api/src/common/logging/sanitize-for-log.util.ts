/**
 * Bounded, non-mutating sanitization for operational logs.
 * Never logs credentials, tokens, cookies, or connection strings.
 */

const MAX_LOG_CHARS = 2_000;

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /mongodb(\+srv)?:\/\/[^\s"']+/gi,
  /redis:\/\/[^\s"']+/gi,
  /(?:"|')?(?:password|pass|pwd|secret|token|apikey|api[_-]?key|authorization|cookie|session)(?:"|')?\s*[:=]\s*(?:"|')?[^"',\s}]+/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /Basic\s+[A-Za-z0-9+/]+=*/gi,
  /https?:\/\/[^\s"']*[?&](Signature|X-Amz-Signature|token|access_key)=[^\s"']+/gi
];

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function stripControlCharacters(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}

export function sanitizeLogText(input: unknown, maxChars = MAX_LOG_CHARS): string {
  let text: string;
  try {
    if (input instanceof Error) {
      text = `${input.name}: ${input.message}`;
    } else if (typeof input === "string") {
      text = input;
    } else if (input === null || input === undefined) {
      text = String(input);
    } else {
      text = JSON.stringify(input);
    }
  } catch {
    text = "[unserializable]";
  }

  let sanitized = stripControlCharacters(text);
  for (const pattern of SECRET_VALUE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  if (sanitized.length > maxChars) {
    sanitized = sanitized.slice(0, maxChars) + "…[truncated]";
  }
  return sanitized;
}

export function sanitizeErrorForLog(error: unknown): {
  event: string;
  errorCategory: string;
  messageSafe: string;
} {
  const messageSafe = sanitizeLogText(error);
  let errorCategory = "unknown_error";
  if (error instanceof Error) {
    errorCategory = error.name || "Error";
  } else if (typeof error === "string") {
    errorCategory = "string_error";
  }
  return {
    event: "process_error_sanitized",
    errorCategory,
    messageSafe
  };
}
