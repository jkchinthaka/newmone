"use client";

import { useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  type BulkImportEntitySlug,
  type BulkImportMode,
  type BulkImportPreviewResult,
  commitBulkImport,
  downloadBulkImportErrors,
  downloadBulkImportTemplate,
  previewBulkImport,
  triggerBlobDownload
} from "@/lib/bulk-import-api";
import { useFocusTrap } from "@/lib/use-focus-trap";

type WizardStep = "upload" | "preview" | "result";

export interface BulkImportWizardProps {
  entity: BulkImportEntitySlug;
  entityLabel: string;
  open: boolean;
  onClose: () => void;
  /** Called after a successful (or partial) commit so the caller can refresh its list. */
  onImported?: () => void;
}

const ROW_ACTION_STYLE: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-blue-50 text-blue-700",
  SKIP_EXISTING: "bg-slate-100 text-slate-600",
  SKIP_DUPLICATE_FILE_ROW: "bg-amber-50 text-amber-700",
  ERROR: "bg-rose-50 text-rose-700"
};

const ROW_ACTION_LABEL: Record<string, string> = {
  CREATE: "Will create",
  UPDATE: "Will update",
  SKIP_EXISTING: "Skip (exists)",
  SKIP_DUPLICATE_FILE_ROW: "Skip (duplicate)",
  ERROR: "Error"
};

/**
 * Reusable Bulk Import wizard: select file -> preview/validate (server-side,
 * non-mutating) -> confirm -> commit -> result. One component drives every
 * bulk-enabled entity — see docs/BULK_IMPORT_ARCHITECTURE.md.
 */
export function BulkImportWizard({ entity, entityLabel, open, onClose, onImported }: BulkImportWizardProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>("upload");
  const [mode, setMode] = useState<BulkImportMode>("CREATE_NEW_SKIP_EXISTING");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkImportPreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<{ status: string; message: string } | null>(null);

  const busy = false;

  function reset() {
    setStep("upload");
    setSelectedFileName(null);
    setPreview(null);
    setCommitResult(null);
    setMode("CREATE_NEW_SKIP_EXISTING");
  }

  function handleClose() {
    if (previewMutation.isPending || commitMutation.isPending) return;
    reset();
    onClose();
  }

  useFocusTrap(open, panelRef, { onEscape: handleClose });

  const previewMutation = useMutation({
    mutationFn: (file: File) => previewBulkImport(entity, file, mode),
    onSuccess: (result) => {
      setPreview(result);
      setStep("preview");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Preview failed"))
  });

  const commitMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Nothing to commit — generate a preview first.");
      return commitBulkImport(entity, preview.run.id);
    },
    onSuccess: (result) => {
      setCommitResult({ status: result.run.status, message: result.message });
      setStep("result");
      onImported?.();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Import failed"))
  });

  function handleFile(file: File) {
    setSelectedFileName(file.name);
    previewMutation.mutate(file);
  }

  async function handleDownloadTemplate(format: "csv" | "xlsx") {
    try {
      const blob = await downloadBulkImportTemplate(entity, format);
      triggerBlobDownload(blob, `${entity}-bulk-import-template.${format}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Template download failed"));
    }
  }

  async function handleDownloadErrors() {
    if (!preview) return;
    try {
      const blob = await downloadBulkImportErrors(entity, preview.run.id);
      triggerBlobDownload(blob, `bulk-import-${preview.run.id}-errors.csv`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error report download failed"));
    }
  }

  if (!open) {
    return null;
  }

  const steps: Array<{ id: WizardStep; label: string }> = [
    { id: "upload", label: "Select file" },
    { id: "preview", label: "Review" },
    { id: "result", label: "Result" }
  ];

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0"
        onClick={handleClose}
        disabled={busy}
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        role="dialog"
        ref={panelRef}
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Bulk Upload</p>
            <h2 id={titleId} className="mt-0.5 text-lg font-semibold text-slate-900">
              {entityLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  step === s.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {index + 1}
              </span>
              <span className={step === s.id ? "text-slate-900" : ""}>{s.label}</span>
              {index < steps.length - 1 ? <span className="mx-1 text-slate-300">&mdash;</span> : null}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Before you upload</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Download the template so column headers match exactly.</li>
                  <li>Supported formats: .csv and .xlsx, up to 10 MB and 5,000 rows.</li>
                  <li>Existing records are skipped by default — choose &ldquo;Update existing&rdquo; to change them instead.</li>
                  <li>Nothing is created or changed until you review the preview and confirm.</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDownloadTemplate("csv")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download size={13} /> CSV template
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadTemplate("xlsx")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download size={13} /> Excel template
                  </button>
                </div>
              </div>

              <fieldset className="flex flex-wrap gap-4 text-sm text-slate-700">
                <legend className="mb-1 w-full font-semibold text-slate-800">Existing record handling</legend>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="bulk-import-mode"
                    checked={mode === "CREATE_NEW_SKIP_EXISTING"}
                    onChange={() => setMode("CREATE_NEW_SKIP_EXISTING")}
                  />
                  Create new, skip existing (default)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="bulk-import-mode"
                    checked={mode === "UPDATE_EXISTING"}
                    onChange={() => setMode("UPDATE_EXISTING")}
                  />
                  Update existing records
                </label>
              </fieldset>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition ${
                  dragActive ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
                }`}
              >
                <UploadCloud size={28} className="text-slate-400" aria-hidden />
                <p className="text-sm text-slate-600">Drag &amp; drop a .csv or .xlsx file here</p>
                <p className="text-xs text-slate-400">or</p>
                <button
                  type="button"
                  disabled={previewMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {previewMutation.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                  Choose file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFile(file);
                    event.target.value = "";
                  }}
                />
                {selectedFileName ? <p className="text-xs text-slate-500">{selectedFileName}</p> : null}
              </div>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <SummaryTile label="Rows" value={preview.summary.totalRows} tone="slate" />
                <SummaryTile label="Will create" value={preview.summary.createCount} tone="emerald" />
                <SummaryTile label="Will update" value={preview.summary.updateCount} tone="blue" />
                <SummaryTile label="Skipped" value={preview.summary.skipCount} tone="amber" />
                <SummaryTile label="Errors" value={preview.summary.errorCount} tone="rose" />
              </div>

              {preview.blocked ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <p>No rows are ready to import. Download the error report, fix the file, and upload it again.</p>
                </div>
              ) : null}

              <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">{entityLabel} key</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{row.naturalKey ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              ROW_ACTION_STYLE[row.action] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {ROW_ACTION_LABEL[row.action] ?? row.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {[...row.errors, ...row.warnings].map((issue) => issue.message).join("; ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.summary.errorCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void handleDownloadErrors()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
                >
                  <Download size={13} /> Download error report
                </button>
              ) : null}
            </div>
          )}

          {step === "result" && commitResult && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2
                size={36}
                className={commitResult.status === "COMPLETED" ? "text-emerald-500" : "text-amber-500"}
                aria-hidden
              />
              <p className="text-base font-semibold text-slate-900">{commitResult.message}</p>
              {preview ? (
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryTile label="Created" value={preview.summary.createCount} tone="emerald" />
                  <SummaryTile label="Updated" value={preview.summary.updateCount} tone="blue" />
                  <SummaryTile label="Skipped" value={preview.summary.skipCount} tone="amber" />
                  <SummaryTile label="Errors" value={preview.summary.errorCount} tone="rose" />
                </div>
              ) : null}
              {preview && preview.summary.errorCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void handleDownloadErrors()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
                >
                  <Download size={13} /> Download error report
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {step === "result" ? "Close" : "Cancel"}
          </button>
          <div className="flex gap-2">
            {step === "preview" ? (
              <>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Start over
                </button>
                <button
                  type="button"
                  disabled={!preview?.commitAllowed || commitMutation.isPending}
                  onClick={() => commitMutation.mutate()}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {commitMutation.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                  Confirm &amp; Import
                </button>
              </>
            ) : null}
            {step === "result" ? (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Start another import
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "blue" | "amber" | "rose";
}) {
  const toneClass: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700"
  };
  return (
    <div className={`rounded-xl p-3 text-center ${toneClass[tone]}`}>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] uppercase tracking-wide">{label}</p>
    </div>
  );
}
