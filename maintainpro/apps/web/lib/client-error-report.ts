type ReportableError = {
  name?: string;
  digest?: string;
};

function sanitizeClientError(error: unknown): { name: string; digest?: string } {
  if (!error || typeof error !== "object") {
    return { name: "Error" };
  }

  const candidate = error as ReportableError;
  const name = typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : "Error";
  const digest = typeof candidate.digest === "string" && candidate.digest.trim() ? candidate.digest.trim() : undefined;

  return digest ? { name, digest } : { name };
}

/**
 * Production client errors must not dump stacks, messages, or payloads.
 * Digest is the Next.js error identifier; name is the constructor name only.
 */
export function reportClientError(source: string, error: unknown): void {
  const sanitized = sanitizeClientError(error);
  // eslint-disable-next-line no-console
  console.error(`[MaintainPro] ${source}`, sanitized);
}
