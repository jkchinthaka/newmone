"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Printer, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

import { ButtonSpinner } from "@/components/ui/loading";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  ASSET_IMPORT_MAX_ROWS,
  LABEL_IDS_STORAGE_KEY,
  chunkForSave,
  downloadAssetImportTemplate,
  importErrorsCsv,
  lineProblems,
  previewAssetImport,
  readAssetWorkbook,
  rowsToSave,
  saveAssetImportChunk,
  type AssetImportLine,
  type AssetImportPreview,
  type AssetImportRow,
  type AssetImportSaveResult
} from "@/lib/asset-register-import";

type Filter = "ALL" | "NEW" | "UPDATE" | "SKIP" | "ERROR";
const PAGE_SIZE = 50;

const STATUS_STYLE: Record<AssetImportLine["status"], { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  UPDATE: { label: "Update", className: "bg-sky-50 text-sky-800 ring-sky-200" },
  SKIP: { label: "Already in system", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  ERROR: { label: "Fix needed", className: "bg-red-50 text-red-800 ring-red-200" }
};

function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Excel tab of Add assets: template → upload → check → fix tags → save in parts → QR labels. */
export function AssetExcelImport() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<AssetImportRow[]>([]);
  const [preview, setPreview] = useState<AssetImportPreview | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [tagEdits, setTagEdits] = useState<Record<number, string>>({});
  const [stale, setStale] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<"read" | "check" | "save" | "template" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<AssetImportSaveResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const lines = preview?.lines ?? [];
    return filter === "ALL" ? lines : lines.filter((line) => line.status === filter);
  }, [preview, filter]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageLines = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toSave = (preview?.counts.new ?? 0) + (preview?.counts.update ?? 0);

  function reset() {
    setFileName("");
    setRows([]);
    setPreview(null);
    setTagEdits({});
    setStale(false);
    setFilter("ALL");
    setPage(1);
    setResults(null);
    setProgress(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function check(nextRows: AssetImportRow[], edits: Record<number, string>, update: boolean) {
    setBusy("check");
    setError(null);
    try {
      // Typed tag changes are sent as the person's own tags; other tags are numbered again.
      const sent = nextRows.map((row) => (edits[row.row] !== undefined ? { ...row, assetTag: edits[row.row].trim().toUpperCase(), autoTag: false } : row));
      setPreview(await previewAssetImport(sent, update));
      setStale(false);
      setPage(1);
    } catch (cause) {
      setPreview(null);
      setError(getApiErrorMessage(cause, "The file could not be checked."));
    } finally {
      setBusy(null);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    reset();
    setFileName(file.name);
    setBusy("read");
    try {
      const parsed = await readAssetWorkbook(file);
      if (parsed.missingColumns.length) {
        setError(`These columns are missing: ${parsed.missingColumns.join(", ")}. Use the template, or rename your column headings.`);
        return;
      }
      if (!parsed.rows.length) {
        setError("The file has no asset rows.");
        return;
      }
      if (parsed.rows.length > ASSET_IMPORT_MAX_ROWS) {
        setError(`This file has ${parsed.rows.length} assets. Up to ${ASSET_IMPORT_MAX_ROWS} per file: split it (for example one file per site).`);
        return;
      }
      setRows(parsed.rows);
      if (parsed.unknownColumns.length) toast.message(`Not used: ${parsed.unknownColumns.slice(0, 5).join(", ")}${parsed.unknownColumns.length > 5 ? "…" : ""}`);
      await check(parsed.rows, {}, updateExisting);
    } catch {
      setError("This file could not be read. Save it as an Excel file (.xlsx) and try again.");
    } finally {
      setBusy((current) => (current === "read" ? null : current));
    }
  }

  async function save() {
    if (!preview || stale || !toSave) return;
    const sending = rowsToSave(rows, preview.lines, tagEdits);
    const chunks = chunkForSave(sending, preview.lines);
    setBusy("save");
    setError(null);
    setProgress({ done: 0, total: sending.length });
    const collected: AssetImportSaveResult[] = [];
    try {
      for (const chunk of chunks) {
        const result = await saveAssetImportChunk(chunk, updateExisting);
        collected.push(...result.results);
        setProgress((current) => (current ? { ...current, done: current.done + chunk.length } : current));
      }
    } catch (cause) {
      setError(`${getApiErrorMessage(cause, "Saving stopped.")} ${collected.length} rows were saved before it stopped. Upload the same file again: saved assets show as already in the system.`);
    } finally {
      setBusy(null);
      setResults(collected.sort((left, right) => left.row - right.row));
    }
  }

  const created = results?.filter((result) => result.status === "CREATED") ?? [];
  const updated = results?.filter((result) => result.status === "UPDATED") ?? [];
  const failedSave = results?.filter((result) => result.status === "ERROR") ?? [];

  function problemsCsv() {
    const fromPreview = (preview?.lines ?? [])
      .filter((line) => line.status === "ERROR")
      .map((line) => ({ row: line.row, assetTag: line.assetTag, name: line.name, message: lineProblems(line) }));
    const fromSave = failedSave.map((result) => ({ row: result.row, assetTag: result.assetTag, name: result.name, message: result.message ?? "" }));
    downloadText(importErrorsCsv([...fromPreview, ...fromSave].sort((a, b) => a.row - b.row)), "asset-import-problems.csv");
  }

  function printLabels() {
    const ids = [...created, ...updated].map((result) => result.assetId).filter((id): id is string => Boolean(id));
    try {
      sessionStorage.setItem(LABEL_IDS_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      toast.error("Labels could not be opened in this browser.");
      return;
    }
    window.open("/admin/assets/labels", "_blank", "noopener");
  }

  if (results) {
    return (
      <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="flex items-center gap-2 text-base font-semibold">
          <CheckCircle2 size={18} aria-hidden /> {created.length} added{updated.length ? `, ${updated.length} updated` : ""}
          {failedSave.length ? `, ${failedSave.length} not saved` : ""}
        </p>
        <p>New assets are saved as Draft unless the file said otherwise. A manager makes them Active on Machines &amp; Equipment (select them, then Bulk status).</p>
        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-white p-3 text-red-800">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {created.length + updated.length ? (
            <button type="button" onClick={printLabels} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 font-semibold text-white">
              <Printer size={16} aria-hidden /> Print QR labels ({created.length + updated.length})
            </button>
          ) : null}
          {failedSave.length || preview?.counts.error ? (
            <button type="button" onClick={problemsCsv} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-slate-800">
              <Download size={16} aria-hidden /> Download rows not saved
            </button>
          ) : null}
          <Link href={"/assets" as Route} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-slate-800">
            Open Machines &amp; Equipment
          </Link>
          <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-slate-800">
            Upload another file
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="font-semibold text-slate-900">1. Get the template</p>
          <p className="mt-1 text-slate-600">Drop-downs come from your sites, locations, departments and asset groups.</p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("template");
              try {
                await downloadAssetImportTemplate();
              } catch (cause) {
                toast.error(getApiErrorMessage(cause, "The template could not be downloaded."));
              } finally {
                setBusy(null);
              }
            }}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 font-medium text-slate-800 disabled:opacity-50"
          >
            {busy === "template" ? <ButtonSpinner /> : <FileSpreadsheet size={16} aria-hidden />} Download template
          </button>
        </div>
        <div>
          <p className="font-semibold text-slate-900">2. Fill it in</p>
          <p className="mt-1 text-slate-600">
            One row per asset. Asset group, Category, Name and Site are required. Leave Asset tag empty to get the next number.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">3. Upload and check</p>
          <p className="mt-1 text-slate-600">Nothing is saved until you press Save. Up to {ASSET_IMPORT_MAX_ROWS.toLocaleString()} assets per file.</p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm hover:border-brand-400">
          {busy === "read" || busy === "check" ? <ButtonSpinner /> : <Upload size={20} aria-hidden className="text-slate-500" />}
          <span className="font-medium text-slate-800">{fileName || "Choose the Excel file"}</span>
          <span className="text-xs text-slate-500">.xlsx, .xls or .csv</span>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            disabled={busy !== null}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={updateExisting}
            disabled={busy !== null}
            onChange={(event) => {
              setUpdateExisting(event.target.checked);
              if (rows.length) void check(rows, tagEdits, event.target.checked);
            }}
          />
          <span>
            Update assets that are already in the system
            <span className="block text-xs text-slate-500">Matched by asset tag, serial number or ERP code. Empty cells do not clear anything. Site and status are not changed.</span>
          </span>
        </label>
        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      </section>

      {preview ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show rows">
            {(
              [
                ["ALL", `All ${preview.counts.total}`],
                ["NEW", `New ${preview.counts.new}`],
                ["UPDATE", `Update ${preview.counts.update}`],
                ["SKIP", `Already in system ${preview.counts.skip}`],
                ["ERROR", `Fix needed ${preview.counts.error}`]
              ] as Array<[Filter, string]>
            )
              .filter(([value]) => value === "ALL" || preview.counts[value.toLowerCase() as "new" | "update" | "skip" | "error"] > 0)
              .map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setPage(1);
                  }}
                  className={`min-h-9 rounded-full px-3 text-sm ring-1 ${
                    filter === value ? "bg-slate-900 text-white ring-slate-900" : value === "ALL" ? "bg-white text-slate-700 ring-slate-300" : STATUS_STYLE[value as AssetImportLine["status"]].className
                  }`}
                >
                  {label}
                </button>
              ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Row</th>
                  <th className="px-2 py-2">Asset tag</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Group / category</th>
                  <th className="px-2 py-2">Site / location</th>
                  <th className="px-2 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {pageLines.map((line) => (
                  <tr key={line.row} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-2 text-slate-500">{line.row}</td>
                    <td className="px-2 py-2">
                      <TagCell line={line} edit={tagEdits[line.row]} onEdit={(value) => {
                        setTagEdits((current) => ({ ...current, [line.row]: value }));
                        setStale(true);
                      }} />
                    </td>
                    <td className="px-2 py-2 font-medium text-slate-900">{line.name || "—"}</td>
                    <td className="px-2 py-2 text-slate-700">
                      {line.display.assetGroup || "—"}
                      <span className="block text-xs text-slate-500">{[line.display.category, line.display.type].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      {line.display.site || "—"}
                      <span className="block text-xs text-slate-500">{line.display.functionalLocation}</span>
                    </td>
                    <td className="max-w-sm px-2 py-2">
                      <ResultCell line={line} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {pageLines.map((line) => (
              <li key={line.row} className="space-y-1 rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{line.name || "—"}</p>
                  <span className="text-xs text-slate-500">Row {line.row}</span>
                </div>
                <TagCell line={line} edit={tagEdits[line.row]} onEdit={(value) => {
                  setTagEdits((current) => ({ ...current, [line.row]: value }));
                  setStale(true);
                }} />
                <p className="text-xs text-slate-600">
                  {[line.display.assetGroup, line.display.category].filter(Boolean).join(" · ")} — {[line.display.site, line.display.functionalLocation].filter(Boolean).join(" · ")}
                </p>
                <ResultCell line={line} />
              </li>
            ))}
          </ul>

          {pages > 1 ? (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="min-h-10 rounded-lg border border-slate-300 px-3 disabled:opacity-40">
                  Previous
                </button>
                <button type="button" disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="min-h-10 rounded-lg border border-slate-300 px-3 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {progress ? (
            <div aria-live="polite" className="space-y-1 text-sm text-slate-700">
              <p>
                Saving {progress.done.toLocaleString()} of {progress.total.toLocaleString()}…
              </p>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {stale ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void check(rows, tagEdits, updateExisting)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "check" ? <ButtonSpinner /> : <RefreshCw size={16} aria-hidden />} Check again
              </button>
            ) : (
              <button
                type="button"
                disabled={busy !== null || !toSave}
                onClick={() => void save()}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy === "save" ? <ButtonSpinner /> : null}
                {toSave ? `Save ${toSave.toLocaleString()} asset${toSave === 1 ? "" : "s"}` : "Nothing to save"}
              </button>
            )}
            {preview.counts.error ? (
              <button type="button" onClick={problemsCsv} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm text-slate-800">
                <Download size={16} aria-hidden /> Download rows to fix
              </button>
            ) : null}
            <p className="text-xs text-slate-500">
              {stale
                ? "You changed a tag. Check again before saving."
                : preview.counts.error
                  ? "Rows that need a fix are not saved. Fix them in Excel and upload the file again later; saved rows will show as already in the system."
                  : "Everything looks fine."}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TagCell({ line, edit, onEdit }: { line: AssetImportLine; edit?: string; onEdit: (value: string) => void }) {
  if (line.status !== "NEW") return <span className="font-mono text-xs text-slate-800">{line.assetTag || "—"}</span>;
  return (
    <span className="block">
      <input
        aria-label={`Asset tag for row ${line.row}`}
        value={edit ?? line.assetTag}
        onChange={(event) => onEdit(event.target.value.toUpperCase())}
        className="min-h-9 w-36 rounded-md border border-slate-300 px-2 font-mono text-xs"
      />
      {line.autoTag && edit === undefined ? <span className="block text-[11px] text-slate-500">Next number (you can change it)</span> : null}
    </span>
  );
}

function ResultCell({ line }: { line: AssetImportLine }) {
  const style = STATUS_STYLE[line.status];
  return (
    <span className="block space-y-1">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${style.className}`}>{style.label}</span>
      {line.messages.length ? <span className="block text-xs text-slate-700">{line.messages.join(" ")}</span> : null}
      {line.warnings.length ? <span className="block text-xs text-amber-800">{line.warnings.join(" ")}</span> : null}
    </span>
  );
}
