import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { UPSTREAM_UNAVAILABLE_USER_MESSAGE, isUpstreamUnavailableError } from "@/lib/upstream-status";

/**
 * User-facing message for a failed mutation. A restarting or unreachable server always gets
 * the "not saved — try again" wording, even if the response carried no message.
 */
export function mutationErrorMessage(error: unknown, fallback: string): string {
  if (isUpstreamUnavailableError(error)) {
    return UPSTREAM_UNAVAILABLE_USER_MESSAGE;
  }
  return getApiErrorMessage(error, fallback);
}

/**
 * Show a mutation failure. Mutations are never retried automatically; when the server was
 * unreachable the toast offers a Retry button that re-sends the same request (same
 * Idempotency-Key / version), so the form state the caller kept is reused.
 */
export function showMutationError(error: unknown, fallback: string, onRetry?: () => void): void {
  const message = mutationErrorMessage(error, fallback);
  if (onRetry && isUpstreamUnavailableError(error)) {
    toast.error(message, { action: { label: "Retry", onClick: onRetry }, duration: 15_000 });
    return;
  }
  toast.error(message);
}
