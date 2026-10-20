export type BulkStatusItem = { id: string; expectedVersion: number };
export type BulkStatusOutcome = { id: string; outcome: "ok" | "conflict" | "error"; message?: string };

/** One item per selected row, each with the version the user is looking at. */
export function buildBulkStatusItems(
  selectedIds: string[],
  rows: Array<{ id: string; version?: number | null }>
): { items: BulkStatusItem[]; missing: string[] } {
  const versions = new Map(rows.map((row) => [row.id, row.version]));
  const items: BulkStatusItem[] = [];
  const missing: string[] = [];
  for (const id of selectedIds) {
    const version = versions.get(id);
    if (typeof version === "number" && Number.isFinite(version)) {
      items.push({ id, expectedVersion: version });
    } else {
      missing.push(id);
    }
  }
  return { items, missing };
}

export function summarizeBulkStatusResults(
  results: BulkStatusOutcome[],
  labels: Record<string, string>
): { ok: number; conflict: number; error: number; lines: string[] } {
  const summary = { ok: 0, conflict: 0, error: 0, lines: [] as string[] };
  for (const row of results) {
    summary[row.outcome] += 1;
    const label = labels[row.id] ?? row.id;
    if (row.outcome === "conflict") {
      summary.lines.push(`${label}: changed by someone else — refreshed`);
    } else if (row.outcome === "error") {
      summary.lines.push(`${label}: ${row.message ?? "could not be updated"}`);
    }
  }
  return summary;
}

/** Successful rows leave the selection so a retry does not send them again. */
export function remainingBulkSelection(selectedIds: string[], results: BulkStatusOutcome[]): string[] {
  const done = new Set(results.filter((row) => row.outcome === "ok").map((row) => row.id));
  return selectedIds.filter((id) => !done.has(id));
}
