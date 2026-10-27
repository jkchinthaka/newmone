/** Nelna IT Help Desk. Override with NEXT_PUBLIC_IT_HELP_DESK_URL at build time if it moves. */
export const IT_HELP_DESK_URL =
  process.env.NEXT_PUBLIC_IT_HELP_DESK_URL?.trim() || "https://nelna-helpdesk.southeastasia.cloudapp.azure.com/submit";

/** Account lock after this many wrong passwords. Mirrors MAX_FAILED_LOGIN_ATTEMPTS in the API. */
export const LOGIN_ATTEMPTS_BEFORE_LOCK = 5;

/** Lock length per round in seconds: 1st, 2nd, 3rd and later. Mirrors LOCKOUT_SECONDS in the API. */
export const LOGIN_LOCKOUT_SECONDS = [30, 60, 90] as const;

/** "30 sec", "1 min", "1 min 30 sec". */
export function formatLockLength(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} sec`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sec`;
}

/** Countdown text, e.g. "0:27" or "1:05". */
export function formatCountdown(secondsLeft: number): string {
  const safe = Math.max(0, Math.ceil(secondsLeft));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** Seconds to wait when the API says the account is locked; null for any other error. */
export function lockSecondsFromError(error: unknown): number | null {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  if (response?.status !== 429) return null;
  const body = response.data as { error?: { code?: string; metadata?: { retryAfterSeconds?: unknown } } } | undefined;
  if (body?.error?.code !== "ACCOUNT_LOCKED") return null;
  const seconds = Number(body.error.metadata?.retryAfterSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}
