/**
 * Client idempotency helpers for critical mutating requests.
 *
 * Why: offline retries and flaky mobile networks can replay the same user action.
 * Servers that accept `idempotencyKey` / `Idempotency-Key` can return the prior
 * result instead of creating a duplicate Work Order transition, stock issue, etc.
 *
 * Phase 2 provides key generation + header helpers only — domain handlers wire
 * this in later phases when each mutation is made safe server-side.
 */

export function createIdempotencyKey(prefix = "mp"): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${uuid}`;
}

/** Stable key for a known local action (offline queue item). */
export function stableIdempotencyKey(scope: string, localActionId: string): string {
  return `${scope}:${localActionId}`;
}

export function idempotencyHeaders(idempotencyKey: string): Record<string, string> {
  return {
    "Idempotency-Key": idempotencyKey
  };
}

export function withIdempotencyBody<T extends Record<string, unknown>>(
  body: T,
  idempotencyKey: string
): T & { idempotencyKey: string } {
  return { ...body, idempotencyKey };
}
