/**
 * Node's default keepAliveTimeout (5 s) is shorter than most proxies' upstream idle timeout,
 * so a pooled socket can be closed by the API just as the BFF or nginx reuses it (ECONNRESET).
 * headersTimeout must stay above keepAliveTimeout or Node closes idle sockets early.
 */
export type HttpServerTimeouts = { keepAliveTimeoutMs: number; headersTimeoutMs: number };

export const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 65_000;
export const DEFAULT_HEADERS_TIMEOUT_MS = 66_000;

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

export function resolveHttpServerTimeouts(env: NodeJS.ProcessEnv | Record<string, string | undefined>): HttpServerTimeouts {
  const keepAliveTimeoutMs = positiveInt(env.HTTP_KEEP_ALIVE_TIMEOUT_MS, DEFAULT_KEEP_ALIVE_TIMEOUT_MS);
  const headersTimeoutMs = positiveInt(env.HTTP_HEADERS_TIMEOUT_MS, DEFAULT_HEADERS_TIMEOUT_MS);
  return {
    keepAliveTimeoutMs,
    headersTimeoutMs: headersTimeoutMs > keepAliveTimeoutMs ? headersTimeoutMs : keepAliveTimeoutMs + 1_000
  };
}

export function applyHttpServerTimeouts(
  server: { keepAliveTimeout: number; headersTimeout: number },
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): HttpServerTimeouts {
  const timeouts = resolveHttpServerTimeouts(env);
  server.keepAliveTimeout = timeouts.keepAliveTimeoutMs;
  server.headersTimeout = timeouts.headersTimeoutMs;
  return timeouts;
}
