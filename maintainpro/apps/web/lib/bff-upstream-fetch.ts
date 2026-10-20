/**
 * BFF → API transport: classify undici failures by `error.cause.code` and retry only when safe.
 *
 * Retry policy
 * - GET / HEAD / OPTIONS: retry on connection refused, reset, or socket errors.
 * - POST / PUT / PATCH / DELETE: retry only on connection refused (the request never reached
 *   the API) and only when the caller sent an Idempotency-Key. Never after a reset or timeout,
 *   because the API may already have applied the change.
 * - Timeouts are never retried.
 *
 * The request body is buffered once by the caller and replayed byte-for-byte on each attempt.
 */

export type UpstreamFailureKind = "refused" | "reset" | "socket" | "dns" | "timeout" | "config" | "unknown";

export type UpstreamFailure = {
  kind: UpstreamFailureKind;
  status: number;
  code: "UPSTREAM_UNAVAILABLE" | "UPSTREAM_TIMEOUT" | "UPSTREAM_CONFIG";
  causeCode: string;
};

/** Total attempts per request, including the first one. */
export const UPSTREAM_MAX_ATTEMPTS = 3;
/** Delay before attempt 2 and 3 (1 s of backoff in total, well under 5 s). */
export const UPSTREAM_RETRY_DELAYS_MS = [250, 750] as const;
export const UPSTREAM_RETRY_AFTER_SECONDS = 3;
export const UPSTREAM_UNAVAILABLE_MESSAGE =
  "Server is restarting or unreachable. Your change was not saved — please try again.";
export const UPSTREAM_TIMEOUT_MESSAGE = "The server took too long to respond. Please try again.";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TIMEOUT_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ETIMEDOUT",
  "ABORT_ERR"
]);
const RESET_CODES = new Set(["ECONNRESET", "EPIPE", "ECONNABORTED"]);
const SOCKET_CODES = new Set(["UND_ERR_SOCKET", "UND_ERR_CLOSED", "EHOSTUNREACH", "ENETUNREACH", "ENETDOWN"]);
const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN"]);

function readCauseCode(error: unknown): string {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (depth > 0 && typeof candidate.code === "string" && candidate.code) {
      return candidate.code;
    }
    current = candidate.cause;
  }
  const own = (error as { code?: unknown } | null)?.code;
  return typeof own === "string" ? own : "";
}

export function classifyUpstreamError(error: unknown): UpstreamFailure {
  const name = error instanceof Error ? error.name : "";
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  const causeCode = readCauseCode(error).toUpperCase();

  if (name === "BffUpstreamUrlError" || message.includes("upstream url") || message.includes("api_internal_url")) {
    return { kind: "config", status: 500, code: "UPSTREAM_CONFIG", causeCode: causeCode || "CONFIG" };
  }
  if (name === "TimeoutError" || name === "AbortError" || TIMEOUT_CODES.has(causeCode) || message.includes("timeout")) {
    return { kind: "timeout", status: 504, code: "UPSTREAM_TIMEOUT", causeCode: causeCode || name || "TIMEOUT" };
  }
  if (causeCode === "ECONNREFUSED" || (!causeCode && message.includes("econnrefused"))) {
    return { kind: "refused", status: 503, code: "UPSTREAM_UNAVAILABLE", causeCode: "ECONNREFUSED" };
  }
  if (RESET_CODES.has(causeCode) || (!causeCode && message.includes("econnreset"))) {
    return { kind: "reset", status: 503, code: "UPSTREAM_UNAVAILABLE", causeCode: causeCode || "ECONNRESET" };
  }
  if (SOCKET_CODES.has(causeCode) || (!causeCode && (message.includes("socket") || message.includes("other side closed")))) {
    return { kind: "socket", status: 503, code: "UPSTREAM_UNAVAILABLE", causeCode: causeCode || "SOCKET" };
  }
  if (DNS_CODES.has(causeCode)) {
    return { kind: "dns", status: 503, code: "UPSTREAM_UNAVAILABLE", causeCode };
  }
  return { kind: "unknown", status: 503, code: "UPSTREAM_UNAVAILABLE", causeCode: causeCode || "UNKNOWN" };
}

export function shouldRetryUpstream(method: string, failure: UpstreamFailure, hasIdempotencyKey: boolean): boolean {
  if (failure.kind === "timeout" || failure.kind === "config") {
    return false;
  }
  if (SAFE_METHODS.has(method.toUpperCase())) {
    return failure.kind === "refused" || failure.kind === "reset" || failure.kind === "socket";
  }
  return failure.kind === "refused" && hasIdempotencyKey;
}

const ID_SEGMENT =
  /^(?:[0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{20,}|[0-9a-f]{24,}|[A-Z]{2,5}-\d{2,}(?:-\d+)*)$/i;

/** Route template for logs: identifiers and record numbers become `:id`. Query strings are never included. */
export function toRouteTemplate(pathSegments: string[]): string {
  return `/${pathSegments.map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment)).join("/")}`;
}

export type UpstreamAttemptLog = {
  requestId: string;
  method: string;
  route: string;
  causeCode: string;
  attempt: number;
  maxAttempts: number;
  willRetry: boolean;
};

export type FetchUpstreamOptions = {
  url: URL | string;
  method: string;
  headers: Headers;
  body?: ArrayBuffer;
  requestId: string;
  route: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (entry: UpstreamAttemptLog) => void;
};

export type FetchUpstreamResult =
  | { ok: true; response: Response; attempts: number }
  | { ok: false; failure: UpstreamFailure; attempts: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function defaultUpstreamAttemptLog(entry: UpstreamAttemptLog): void {
  // One line per failed attempt. Never bodies, tokens, IDs, or query strings.
  console.error(
    `[bff] upstream_attempt_failed requestId=${entry.requestId} method=${entry.method} route=${entry.route} cause=${entry.causeCode} attempt=${entry.attempt}/${entry.maxAttempts} retry=${entry.willRetry ? "yes" : "no"}`
  );
}

export async function fetchUpstreamWithRetry(options: FetchUpstreamOptions): Promise<FetchUpstreamResult> {
  const method = options.method.toUpperCase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const log = options.log ?? defaultUpstreamAttemptLog;
  const hasIdempotencyKey = Boolean(options.headers.get("idempotency-key")?.trim());
  const timeoutMs = options.timeoutMs ?? 60_000;

  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const response = await fetchImpl(options.url, {
        method,
        headers: options.headers,
        // Same buffered bytes on every attempt; a fresh view keeps undici from consuming the source.
        body: options.body ? new Uint8Array(options.body.slice(0)) : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs)
      });
      return { ok: true, response, attempts: attempt };
    } catch (error) {
      const failure = classifyUpstreamError(error);
      const willRetry = attempt < UPSTREAM_MAX_ATTEMPTS && shouldRetryUpstream(method, failure, hasIdempotencyKey);
      log({
        requestId: options.requestId,
        method,
        route: options.route,
        causeCode: failure.causeCode,
        attempt,
        maxAttempts: UPSTREAM_MAX_ATTEMPTS,
        willRetry
      });
      if (!willRetry) {
        return { ok: false, failure, attempts: attempt };
      }
      await sleep(UPSTREAM_RETRY_DELAYS_MS[Math.min(attempt - 1, UPSTREAM_RETRY_DELAYS_MS.length - 1)]);
    }
  }
}
