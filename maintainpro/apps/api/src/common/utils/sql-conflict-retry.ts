const CONFLICT_ATTEMPTS = 3;

function errorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current) && parts.length < 8) {
    seen.add(current);
    const record = current as { message?: unknown; code?: unknown; number?: unknown; meta?: unknown; cause?: unknown };
    if (record.message != null) parts.push(String(record.message));
    if (record.code != null) parts.push(String(record.code));
    if (record.number != null) parts.push(String(record.number));
    if (record.meta != null) {
      try {
        parts.push(JSON.stringify(record.meta));
      } catch {
        parts.push(String(record.meta));
      }
    }
    current = record.cause;
  }
  if (!parts.length) parts.push(String(error));
  return parts.join(" ");
}

/**
 * SQL Server 1205 is a deadlock. 3960 is a snapshot write conflict.
 * Prisma reports both as P2034 and asks the caller to retry the transaction.
 */
export function isSqlServerConflictError(error: unknown): boolean {
  const text = errorText(error);
  if (/\bP2034\b/.test(text)) return true;
  return /(?:^|\D)(?:1205|3960)(?:\D|$)/.test(text);
}

function jitterMs(attempt: number): number {
  return 15 * attempt + Math.floor(Math.random() * 25);
}

export async function withSqlConflictRetry<T>(
  run: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await run();
    } catch (error) {
      attempt += 1;
      if (attempt >= CONFLICT_ATTEMPTS || !isSqlServerConflictError(error)) throw error;
      await sleep(jitterMs(attempt));
    }
  }
}
