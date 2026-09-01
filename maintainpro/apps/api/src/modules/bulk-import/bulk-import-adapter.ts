import { BulkImportEntity } from "@prisma/client";

export interface BulkImportTemplateColumn {
  key: string;
  header: string;
  required: boolean;
  example: string;
  notes?: string;
}

export interface BulkImportFieldIssue {
  field: string;
  code: string;
  message: string;
}

export interface BulkImportNormalizedRow {
  /** null when the row could not even produce a natural key (fatal error row). */
  naturalKey: string | null;
  /** Normalized, adapter-specific field values. Never includes tenantId/system fields. */
  data: Record<string, unknown>;
  errors: BulkImportFieldIssue[];
  warnings: BulkImportFieldIssue[];
}

export interface BulkImportExistingRecord {
  id: string;
  /** Tenant that actually owns the record — used to detect cross-tenant natural-key conflicts. */
  tenantId: string | null;
  /** Small display snapshot for the preview table (never the full record). */
  snapshot: Record<string, unknown>;
}

/**
 * One adapter per bulk-importable entity. Adapters never see raw request
 * data (tenantId, actor, mode) beyond what BulkImportService passes in —
 * they only know how to normalize/validate a row and read/write their own
 * Prisma model. See docs/BULK_IMPORT_ARCHITECTURE.md for the full contract.
 */
export interface BulkImportAdapter {
  readonly entityType: BulkImportEntity;
  readonly label: string;
  readonly naturalKeyLabel: string;
  /** True when the unique natural key is scoped per-tenant; false when globally unique in the schema. */
  readonly naturalKeyTenantScoped: boolean;
  readonly templateColumns: BulkImportTemplateColumn[];

  normalizeRow(raw: Record<string, unknown>): BulkImportNormalizedRow;

  /** Batch lookup by natural key. Must NOT filter by tenant for globally-unique keys (needed for conflict detection). */
  findExisting(tenantId: string, naturalKeys: string[]): Promise<Map<string, BulkImportExistingRecord>>;

  /** Create the target record. Returns the new record's id. */
  create(tenantId: string, data: Record<string, unknown>): Promise<string>;

  /**
   * Compute the update payload for UPDATE_EXISTING mode. Return null when
   * nothing would actually change (row should be reported as a no-op skip).
   * Blank/omitted input fields must never appear in the returned payload —
   * a blank cell means "leave unchanged", never "clear this field".
   */
  buildUpdate(existing: BulkImportExistingRecord, data: Record<string, unknown>): Record<string, unknown> | null;

  applyUpdate(id: string, data: Record<string, unknown>): Promise<void>;
}
