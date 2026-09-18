import { ConflictException } from "@nestjs/common";

/**
 * Optimistic concurrency helpers.
 * Update with WHERE id = ? AND version = expectedVersion, then increment.
 */
export function assertVersionMatch(actual: number | null | undefined, expected: number | null | undefined, entity = "Record") {
  if (expected == null) {
    return;
  }
  if (actual == null || Number(actual) !== Number(expected)) {
    throw new ConflictException(
      `${entity} was updated by someone else. Refresh and retry with the latest version.`
    );
  }
}

export type VersionedUpdateArgs = {
  id: string;
  expectedVersion?: number | null;
  data: Record<string, unknown>;
};

export function withVersionIncrement<T extends Record<string, unknown>>(data: T): T & { version: { increment: 1 } } {
  return {
    ...data,
    version: { increment: 1 }
  };
}
