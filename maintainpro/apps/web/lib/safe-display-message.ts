export const DEFAULT_PAGE_ERROR_MESSAGE = "Something went wrong. Please try again.";

const UNSAFE_ERROR_PATTERNS: RegExp[] = [
  /stack trace/i,
  /\bat\s+\S+\.\S+/i,
  /ECONNREFUSED/i,
  /mongodb(\+srv)?:\/\//i,
  /postgres(ql)?:\/\//i,
  /redis:\/\//i,
  /jwt/i,
  /bearer\s+/i,
  /refresh[_-]?token/i,
  /access[_-]?token/i,
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /prisma/i,
  /node_modules/i,
  /\/Users\//i,
  /C:\\Users\\/i,
  /UnhandledPromiseRejection/i
];

export function toSafeDisplayMessage(
  message: string | undefined,
  fallback = DEFAULT_PAGE_ERROR_MESSAGE
): string {
  if (!message?.trim()) {
    return fallback;
  }

  const trimmed = message.trim();

  if (trimmed.length > 280) {
    return fallback;
  }

  if (UNSAFE_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return fallback;
  }

  return trimmed;
}
