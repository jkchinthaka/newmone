const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const SECRETISH_PATTERN =
  /(authorization|api[_-]?key|bearer|password|secret|token)\s*[:=]\s*[^\s,;]+/gi;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._\-+=\/]+/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function sanitizeErpErrorMessage(raw?: string | null, maxLen = 240): string {
  if (!raw) {
    return "ERP sync failed";
  }

  let message = String(raw)
    .replace(URL_PATTERN, "[redacted-url]")
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(SECRETISH_PATTERN, "$1=[redacted]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(/\s+/g, " ")
    .trim();

  if (message.length > maxLen) {
    message = `${message.slice(0, maxLen - 1)}…`;
  }

  return message || "ERP sync failed";
}

export function sanitizeErpErrorCode(raw?: string | null): string | null {
  if (!raw) {
    return null;
  }

  const code = String(raw)
    .replace(URL_PATTERN, "")
    .replace(BEARER_PATTERN, "")
    .replace(SECRETISH_PATTERN, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 64)
    .replace(/^_|_$/g, "");

  return code || null;
}

export function buildSafeErpRequestPayload(input: {
  poNumber: string;
  totalAmount: number;
  lineCount: number;
  note?: string | null;
}): Record<string, unknown> {
  return {
    poNumber: input.poNumber,
    totalAmount: input.totalAmount,
    lineCount: input.lineCount,
    note: input.note ?? null
  };
}

export function buildSafeErpResponsePayload(input: {
  accepted: boolean;
  providerRef?: string | null;
}): Record<string, unknown> {
  return {
    accepted: Boolean(input.accepted),
    providerRef: input.providerRef ?? null
  };
}