"use client";

import { useState } from "react";
import { CheckCircle2, Download, Printer, Upload } from "lucide-react";
import { toast } from "sonner";

import { ButtonSpinner } from "@/components/ui/loading";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { LABEL_IDS_STORAGE_KEY } from "@/lib/asset-register-import";

type PreviewRow = {
  rowNumber: number;
  assetTag: string;
  matchTarget: string;
  status: string;
  action: string;
  message: string;
};

type AppliedRow = PreviewRow & { entityId?: string; entityKind?: string };

const ACTION_LABELS: Record<string, string> = {
  assign: "Give tag",
  replace: "Replace tag",
  unchanged: "Already has it",
  skip: "Skipped"
};

async function downloadTemplate(format: "csv" | "xlsx") {
  const response = await apiClient.get(`/admin/asset-tags/template.${format}`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `asset-tag-template.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Give AST- tags to machines and vehicles that are already in the system (matched by asset
 * code, serial number, ERP / fixed asset code or vehicle registration). Same API as before.
 */
export function AssetTagAssign() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [allowReplace, setAllowReplace] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<AppliedRow[] | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

  const valid = rows.filter((row) => row.status === "valid" && row.action !== "unchanged" && (row.action !== "replace" || allowReplace));
  const invalid = rows.filter((row) => row.status !== "valid");

  async function preview(next: File | null) {
    setFile(next);
    setRows([]);
    setApplied(null);
    setError("");
    if (!next) return;
    setBusy("preview");
    const body = new FormData();
    body.set("file", next);
    try {
      const response = await apiClient.post("/admin/asset-tags/preview", body);
      setRows((response.data?.data ?? []) as PreviewRow[]);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The asset tag file could not be checked."));
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!file || busy) return;
    if (allowReplace && reason.trim().length < 3) {
      setError("Write why the tags are being replaced.");
      return;
    }
    setBusy("apply");
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("allowReplace", String(allowReplace));
    body.set("replaceReason", reason.trim());
    try {
      const response = await apiClient.post("/admin/asset-tags/apply", body);
      setApplied((response.data?.data?.applied ?? []) as AppliedRow[]);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The tags could not be saved."));
    } finally {
      setBusy(null);
    }
  }

  function downloadProblems() {
    const csv = ["Row,Asset tag,Problem", ...invalid.map((row) => `${row.rowNumber},"${row.assetTag}","${row.message.replace(/"/g, '""')}"`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "asset-tag-problems.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printLabels() {
    const ids = (applied ?? []).filter((row) => row.entityKind !== "vehicle" && row.entityId).map((row) => row.entityId as string);
    try {
      sessionStorage.setItem(LABEL_IDS_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      toast.error("Labels could not be opened in this browser.");
      return;
    }
    window.open("/admin/assets/labels", "_blank", "noopener");
  }

  if (applied) {
    const assets = applied.filter((row) => row.entityKind !== "vehicle" && row.entityId).length;
    return (
      <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="flex items-center gap-2 text-base font-semibold">
          <CheckCircle2 size={18} aria-hidden /> {applied.length} tag{applied.length === 1 ? "" : "s"} saved
        </p>
        <div className="flex flex-wrap gap-2">
          {assets ? (
            <button type="button" onClick={printLabels} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 font-semibold text-white">
              <Printer size={16} aria-hidden /> Print QR labels ({assets})
            </button>
          ) : null}
          <button type="button" onClick={() => void preview(null)} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-slate-800">
            Upload another file
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          For machines and vehicles <strong>already in MaintainPro</strong> that need an AST- tag. Each row has the new tag and one of: asset code,
          serial number, ERP / fixed asset code, or vehicle registration.
        </p>
        <div className="flex flex-wrap gap-2">
          {(["xlsx", "csv"] as const).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => void downloadTemplate(format).catch((cause) => toast.error(getApiErrorMessage(cause, "The template could not be downloaded.")))}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 font-medium text-slate-800"
            >
              <Download size={16} aria-hidden /> {format === "xlsx" ? "Excel template" : "CSV template"}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm hover:border-brand-400">
          {busy === "preview" ? <ButtonSpinner /> : <Upload size={20} aria-hidden className="text-slate-500" />}
          <span className="font-medium text-slate-800">{file?.name || "Choose the tag file"}</span>
          <span className="text-xs text-slate-500">.xlsx or .csv</span>
          <input type="file" accept=".csv,.xlsx" className="sr-only" disabled={busy !== null} onChange={(event) => void preview(event.target.files?.[0] ?? null)} />
        </label>
        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

        {rows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Row</th>
                    <th className="px-2 py-2">New tag</th>
                    <th className="px-2 py-2">Matched on</th>
                    <th className="px-2 py-2">What happens</th>
                    <th className="px-2 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowNumber} className="border-t border-slate-100">
                      <td className="px-2 py-2 text-slate-500">{row.rowNumber}</td>
                      <td className="px-2 py-2 font-mono text-xs">{row.assetTag || "—"}</td>
                      <td className="px-2 py-2">{row.matchTarget || "—"}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${row.status === "valid" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-red-50 text-red-800 ring-red-200"}`}>
                          {row.status === "valid" ? ACTION_LABELS[row.action] ?? row.action : "Fix needed"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-700">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 md:hidden">
              {rows.map((row) => (
                <li key={row.rowNumber} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-mono text-xs">{row.assetTag || "—"} <span className="text-slate-500">· row {row.rowNumber}</span></p>
                  <p className="text-slate-700">{row.matchTarget || "—"}</p>
                  <p className="text-xs text-slate-600">{row.status === "valid" ? ACTION_LABELS[row.action] ?? row.action : "Fix needed"} — {row.message}</p>
                </li>
              ))}
            </ul>

            {rows.some((row) => row.action === "replace") ? (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={allowReplace} onChange={(event) => setAllowReplace(event.target.checked)} />
                  Replace tags that are already set (old QR labels stop matching)
                </label>
                {allowReplace ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-700">Why are the tags being replaced?</span>
                    <input className="min-h-11 w-full rounded-lg border border-slate-300 px-3" value={reason} onChange={(event) => setReason(event.target.value)} />
                  </label>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy !== null || valid.length === 0}
                onClick={() => void apply()}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy === "apply" ? <ButtonSpinner /> : null} Save {valid.length} tag{valid.length === 1 ? "" : "s"}
              </button>
              {invalid.length ? (
                <button type="button" onClick={downloadProblems} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm">
                  <Download size={16} aria-hidden /> Download rows to fix ({invalid.length})
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
