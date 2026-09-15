import { parseJsonText } from "../../src/common/utils/json-text";

export function auditJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return parseJsonText(value, fallback);
  return value as T;
}

export function auditMetadataEvent(metadata: unknown): string | undefined {
  return auditJsonField(metadata, {} as { event?: string }).event;
}

/** Match SQL Server JSON-text audit metadata written by writeAuditTrail. */
export function expectAuditEvent(event: string) {
  return expect.objectContaining({
    data: expect.objectContaining({
      metadata: expect.stringContaining(`"event":"${event}"`)
    })
  });
}
