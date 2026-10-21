export type BulkCancelRow = { id: string; status: string };

export type BulkCancelFailure = { id: string; message: string };

export type BulkCancelResult = { ok: string[]; failed: BulkCancelFailure[] };

/** Ids in the selection whose loaded row is OPEN. Unknown rows are not cancellable. */
export function openWorkOrderIds(selectedIds: string[], rows: BulkCancelRow[]): string[] {
  const open = new Set(rows.filter((row) => row.status === "OPEN").map((row) => row.id));
  return selectedIds.filter((id) => open.has(id));
}

export function bulkCancelSummary(selectedCount: number, openCount: number): string {
  return `${openCount} of ${selectedCount} selected can be cancelled`;
}

export function bulkCancelToast(cancelled: number, skippedNotOpen: number, firstError?: string): string {
  const summary = `${cancelled} cancelled, ${skippedNotOpen} skipped (not OPEN)`;
  return firstError ? `${summary}. ${firstError}` : summary;
}
