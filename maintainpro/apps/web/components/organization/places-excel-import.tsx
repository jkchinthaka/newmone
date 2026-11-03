"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { ButtonSpinner } from "@/components/ui/loading";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatEnumLabel } from "@/lib/display-labels";
import {
  PLACES_IMPORT_MAX_ROWS,
  downloadPlacesTemplate,
  previewPlacesImport,
  readPlacesWorkbook,
  savePlacesImport,
  type PlacesLine,
  type PlacesPreview,
  type PlacesRow,
  type PlacesSaveResult
} from "@/lib/places-import";

const STATUS: Record<PlacesLine["status"], { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  SKIP: { label: "Already there", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  ERROR: { label: "Fix needed", className: "bg-red-50 text-red-800 ring-red-200" }
};

function csv(entries: Array<{ row: number; message: string }>) {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return ["Row,Problem", ...entries.map((entry) => `${entry.row},${quote(entry.message)}`)].join("\n");
}

/** Add many sites and functional locations from one Excel sheet. */
export function PlacesExcelImport({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PlacesRow[]>([]);
  const [preview, setPreview] = useState<PlacesPreview | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [busy, setBusy] = useState<"template" | "check" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlacesSaveResult[] | null>(null);

  const lines = useMemo(() => (preview?.lines ?? []).filter((line) => !onlyProblems || line.status === "ERROR"), [preview, onlyProblems]);
  const toSave = (preview?.counts.newSites ?? 0) + (preview?.counts.newLocations ?? 0);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setResults(null);
    setError(null);
    setBusy("check");
    try {
      const parsed = await readPlacesWorkbook(file);
      if (parsed.missingColumns.length) throw new Error(`These columns are missing: ${parsed.missingColumns.join(", ")}. Use the template.`);
      if (!parsed.rows.length) throw new Error("The file has no rows.");
      if (parsed.rows.length > PLACES_IMPORT_MAX_ROWS) throw new Error(`Up to ${PLACES_IMPORT_MAX_ROWS} rows per file. Split it (for example one file per site).`);
      setRows(parsed.rows);
      setPreview(await previewPlacesImport(parsed.rows));
    } catch (cause) {
      setError(cause instanceof Error && !("isAxiosError" in cause) ? cause.message : getApiErrorMessage(cause, "The file could not be checked."));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const saved = await savePlacesImport(rows);
      setResults(saved.results);
      onSaved();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Saving failed. Nothing or only part was saved; upload the file again to see what is left."));
    } finally {
      setBusy(null);
    }
  }

  function downloadProblems() {
    const fromPreview = (preview?.lines ?? []).filter((line) => line.status === "ERROR").map((line) => ({ row: line.row, message: line.messages.join(" ") }));
    const fromSave = (results ?? []).filter((result) => result.status === "ERROR").map((result) => ({ row: result.row, message: result.message ?? "" }));
    const merged = new Map([...fromPreview, ...fromSave].map((entry) => [entry.row, entry]));
    const url = URL.createObjectURL(new Blob([csv(Array.from(merged.values()).sort((a, b) => a.row - b.row))], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sites-locations-problems.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const created = results?.filter((result) => result.status === "CREATED").length ?? 0;
  const failed = results?.filter((result) => result.status === "ERROR").length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="places-import-title" className="flex max-h-[95dvh] w-full max-w-4xl flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 id="places-import-title" className="text-base font-semibold text-slate-900">Add sites and locations from Excel</h2>
            <p className="text-sm text-slate-600">One row per location, with its site. New ones are added; ones already in MaintainPro are left as they are.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {results ? (
            <section className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="flex items-center gap-2 text-base font-semibold">
                <CheckCircle2 size={18} aria-hidden /> {created} row{created === 1 ? "" : "s"} added{failed ? `, ${failed} not saved` : ""}
              </p>
              {failed || preview?.counts.errors ? (
                <button type="button" onClick={downloadProblems} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-slate-800">
                  <Download size={16} aria-hidden /> Download rows not saved
                </button>
              ) : null}
            </section>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy("template");
                    try {
                      await downloadPlacesTemplate();
                    } catch (cause) {
                      toast.error(getApiErrorMessage(cause, "The template could not be downloaded."));
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 font-medium text-slate-800 disabled:opacity-50"
                >
                  {busy === "template" ? <ButtonSpinner /> : <FileSpreadsheet size={16} aria-hidden />} Download template
                </button>
                <span className="text-slate-500">Site code + Site name on every row. Parent location code = the location it is inside.</span>
              </div>
              <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center text-sm hover:border-brand-400">
                {busy === "check" ? <ButtonSpinner /> : <Upload size={18} aria-hidden className="text-slate-500" />}
                <span className="font-medium text-slate-800">{fileName || "Choose the Excel file"}</span>
                <span className="text-xs text-slate-500">.xlsx, .xls or .csv · up to {PLACES_IMPORT_MAX_ROWS} rows</span>
                <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="sr-only" disabled={busy !== null} onChange={(event) => void onFile(event.target.files?.[0])} />
              </label>
            </>
          )}
          {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

          {preview && !results ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 ring-1 ring-emerald-200">New sites {preview.counts.newSites}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 ring-1 ring-emerald-200">New locations {preview.counts.newLocations}</span>
                {preview.counts.skipped ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200">Already there {preview.counts.skipped}</span> : null}
                {preview.counts.errors ? (
                  <button type="button" aria-pressed={onlyProblems} onClick={() => setOnlyProblems((value) => !value)} className={`rounded-full px-3 py-1 ring-1 ${onlyProblems ? "bg-red-700 text-white ring-red-700" : "bg-red-50 text-red-800 ring-red-200"}`}>
                    Fix needed {preview.counts.errors}
                  </button>
                ) : null}
              </div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                {lines.slice(0, 300).map((line) => (
                  <li key={line.row} className="grid gap-1 p-2 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] sm:items-start sm:gap-3">
                    <span className="text-xs text-slate-500">Row {line.row}</span>
                    <span>
                      <span className="font-medium text-slate-900">{line.site.name || line.site.code || "—"}</span>
                      <span className="block text-xs text-slate-500">
                        {[line.site.code, line.site.type ? formatEnumLabel(line.site.type) : null, line.creates.site ? "new site" : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span>
                      {line.location ? (
                        <>
                          <span className="font-medium text-slate-900">{line.location.name || "—"}</span>
                          <span className="block text-xs text-slate-500">
                            {line.location.code} · {formatEnumLabel(line.location.type)}
                            {line.location.parentCode ? ` · inside ${line.location.parentCode}` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">Site only</span>
                      )}
                    </span>
                    <span className="space-y-1">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS[line.status].className}`}>{STATUS[line.status].label}</span>
                      {line.status !== "NEW" && line.messages.length ? <span className="block text-xs text-slate-700">{line.messages.join(" ")}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              {lines.length > 300 ? <p className="text-xs text-slate-500">Showing the first 300 rows.</p> : null}
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 p-4">
          {preview?.counts.errors && !results ? (
            <button type="button" onClick={downloadProblems} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm">
              <Download size={16} aria-hidden /> Rows to fix
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm">
            {results ? "Done" : "Cancel"}
          </button>
          {!results ? (
            <button
              type="button"
              disabled={busy !== null || !toSave}
              onClick={() => void save()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === "save" ? <ButtonSpinner /> : null}
              {preview ? (toSave ? `Save ${preview.counts.newSites ? `${preview.counts.newSites} site${preview.counts.newSites === 1 ? "" : "s"}` : ""}${preview.counts.newSites && preview.counts.newLocations ? " + " : ""}${preview.counts.newLocations ? `${preview.counts.newLocations} location${preview.counts.newLocations === 1 ? "" : "s"}` : ""}` : "Nothing new to save") : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
