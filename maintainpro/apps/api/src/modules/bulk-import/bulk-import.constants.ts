import { BulkImportEntity } from "@prisma/client";

/**
 * V1 entity allow-list. `:entity` route params are validated against this
 * map so unimplemented/unknown entities 404 instead of silently falling
 * through to a generic handler. Extend this (and register a new adapter)
 * to onboard another entity — see docs/BULK_IMPORT_ARCHITECTURE.md.
 */
export const BULK_IMPORT_ENTITY_SLUGS: Record<string, BulkImportEntity> = {
  vehicle: BulkImportEntity.VEHICLE,
  asset: BulkImportEntity.ASSET,
  department: BulkImportEntity.DEPARTMENT,
  supplier: BulkImportEntity.SUPPLIER,
  "job-code": BulkImportEntity.JOB_CODE
};

export const BULK_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const BULK_IMPORT_MAX_ROWS = 5_000;
export const BULK_IMPORT_MAX_COLUMNS = 50;

/** How long an uncommitted preview session stays valid before requiring a fresh preview. */
export const BULK_IMPORT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Row processing batch size for commit — bounded so we never hold one giant transaction. */
export const BULK_IMPORT_COMMIT_BATCH_SIZE = 200;
