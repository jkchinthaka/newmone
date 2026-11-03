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

/** Page path with record ids replaced, so the server log never carries a customer's record number. */
export function pageTemplate(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => (/^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment) || /^c[a-z0-9]{20,}$/i.test(segment) ? ":id" : segment))
    .join("/")
    .slice(0, 200);
}

const MAX_SERVER_REPORTS_PER_PAGE_LOAD = 3;
let serverReports = 0;

/** Best effort: never throws, never blocks, and does nothing when nobody is signed in. */
function sendToServer(source: string, sanitized: { name: string; digest?: string }): void {
  if (typeof window === "undefined" || serverReports >= MAX_SERVER_REPORTS_PER_PAGE_LOAD) return;
  serverReports += 1;
  void (async () => {
    try {
      const [{ currentStoredUserId }, { apiClient }] = await Promise.all([
        import("@/lib/user-scoped-storage"),
        import("@/lib/api-client")
      ]);
      if (!currentStoredUserId()) return;
      await apiClient.post("/client-errors", {
        source: source.slice(0, 80),
        name: sanitized.name.slice(0, 80),
        digest: sanitized.digest?.slice(0, 80),
        route: pageTemplate(window.location.pathname)
      });
    } catch {
      // Reporting must never make a crash worse.
    }
  })();
}

/**
 * Production client errors must not dump stacks, messages, or payloads.
 * Digest is the Next.js error identifier; name is the constructor name only.
 * The same safe fields go to the server log so a crash is noticed without waiting for a phone call.
 */
export function reportClientError(source: string, error: unknown): void {
  const sanitized = sanitizeClientError(error);
  // eslint-disable-next-line no-console
  console.error(`[MaintainPro] ${source}`, sanitized);
  sendToServer(source, sanitized);
}
