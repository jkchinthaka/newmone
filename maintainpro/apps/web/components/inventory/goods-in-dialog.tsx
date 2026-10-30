"use client";

import { ProofPhotoInput } from "@/components/ui/proof-photo-input";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, PackagePlus, X } from "lucide-react";
import { toast } from "sonner";

import { ButtonSpinner } from "@/components/ui/loading";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  downloadGoodsInTemplate,
  goodsInFormIssues,
  GOODS_IN_MAX_LINES,
  previewGoodsIn,
  readGoodsInWorkbook,
  receiveGoodsIn,
  type GoodsInLine,
  type GoodsInPreview
} from "@/lib/goods-in";

type PartHit = { id: string; name: string; partNumber: string; unit?: string | null; quantityInStock?: number | null };
type Mode = "item" | "excel";

const today = () => new Date().toISOString().slice(0, 10);
const field = "min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm";
const STATUS_STYLE: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-800",
  NEW: "bg-sky-50 text-sky-800",
  ERROR: "bg-rose-50 text-rose-800"
};
const STATUS_LABEL: Record<string, string> = { OK: "Ready", NEW: "New part", ERROR: "Fix" };

/**
 * Goods in: receive spare parts into the store. "One item" for a single delivery line,
 * "Excel file" for a whole GRN. Lines are checked by the server before anything is saved.
 */
export function GoodsInDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>("item");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shared delivery details.
  const [supplierName, setSupplierName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [grnPhoto, setGrnPhoto] = useState<File | null>(null);
  const [receivedDate, setReceivedDate] = useState(today());
  // One item.
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PartHit[]>([]);
  const [part, setPart] = useState<PartHit | null>(null);
  const [newPart, setNewPart] = useState(false);
  const [form, setForm] = useState({ partNumber: "", name: "", category: "", unit: "pcs", quantity: "", unitCost: "" });
  // Excel.
  const [fileName, setFileName] = useState<string | null>(null);
  const [excelLines, setExcelLines] = useState<GoodsInLine[]>([]);
  const [preview, setPreview] = useState<GoodsInPreview | null>(null);
  const batchKey = useRef(crypto.randomUUID());

  useEffect(() => {
    if (mode !== "item" || newPart || part || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void apiClient
        .get("/inventory/parts", { signal: controller.signal, params: { page: 1, pageSize: 8, q: query.trim() } })
        .then((response) => {
          const data = response.data?.data as { items?: PartHit[] } | PartHit[] | undefined;
          setHits(Array.isArray(data) ? data : data?.items ?? []);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [mode, newPart, part, query]);

  const itemIssues = useMemo(
    () => goodsInFormIssues({ partId: part?.id ?? "", newPart, partNumber: form.partNumber, name: form.name, quantity: form.quantity, unitCost: form.unitCost }),
    [form, newPart, part]
  );

  async function save(lines: GoodsInLine[]) {
    setBusy(true);
    setError(null);
    try {
      if (!referenceNo.trim()) {
        setError("Enter the GRN / invoice number of this delivery.");
        return;
      }
      const result = await receiveGoodsIn(
        {
          lines,
          supplierName: supplierName.trim() || undefined,
          referenceNo: referenceNo.trim(),
          receivedDate,
          idempotencyKey: batchKey.current
        },
        grnPhoto
      );
      toast.success(
        `Received ${result.totalQuantity} item(s) into ${result.store.name}${result.newParts ? ` · ${result.newParts} new part(s) added` : ""}.`
      );
      onDone();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Goods in could not be saved."));
      // A failed save may be retried with the same key (no double stock).
    } finally {
      setBusy(false);
    }
  }

  function saveItem() {
    if (itemIssues.length) {
      setError(itemIssues[0]);
      return;
    }
    void save([
      newPart
        ? { partNumber: form.partNumber.trim(), name: form.name.trim(), category: form.category.trim() || undefined, unit: form.unit.trim() || undefined, quantity: Number(form.quantity), unitCost: form.unitCost.trim() ? Number(form.unitCost) : null }
        : { partId: part?.id, quantity: Number(form.quantity), unitCost: form.unitCost.trim() ? Number(form.unitCost) : null }
    ]);
  }

  async function chooseFile(file: File | undefined) {
    setPreview(null);
    setError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Choose an Excel .xlsx file (use Download template).");
      return;
    }
    setFileName(file.name);
    setBusy(true);
    try {
      const { lines, missingColumns } = await readGoodsInWorkbook(file);
      if (missingColumns.length) {
        setError(`The file is missing: ${missingColumns.join(", ")}. Use Download template.`);
        return;
      }
      if (lines.length === 0) {
        setError("No lines found in the file.");
        return;
      }
      if (lines.length > GOODS_IN_MAX_LINES) {
        setError(`Too many lines (${lines.length}). Up to ${GOODS_IN_MAX_LINES} per goods in.`);
        return;
      }
      setExcelLines(lines);
      setPreview(await previewGoodsIn(lines));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The file could not be read."));
    } finally {
      setBusy(false);
    }
  }

  const tab = (value: Mode, label: string, Icon: typeof PackagePlus) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => {
        setMode(value);
        setError(null);
      }}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium ${
        mode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
      }`}
    >
      <Icon size={16} aria-hidden /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="goods-in-title" className="flex max-h-[100dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90dvh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 id="goods-in-title" className="text-base font-semibold text-slate-900">Goods in</h2>
            <p className="text-sm text-slate-600">Add received spare parts to the store. On hand goes up straight away.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <div role="tablist" aria-label="How to add" className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {tab("item", "One item", PackagePlus)}
            {tab("excel", "Excel file", FileSpreadsheet)}
          </div>

          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="sr-only">Delivery details</legend>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Supplier</span>
              <input className={field} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} maxLength={120} placeholder="Optional" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">GRN / Invoice no *</span>
              <input className={field} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} maxLength={64} placeholder="e.g. GRN-1001" required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Received on</span>
              <input type="date" className={field} value={receivedDate} max={today()} onChange={(e) => setReceivedDate(e.target.value)} />
            </label>
            <div className="sm:col-span-3">
              <ProofPhotoInput
                label="Photo of the GRN / invoice"
                hint="Needed to save. Large deliveries (over LKR 500,000 or 1,000 of one item) must be received by an Admin."
                file={grnPhoto}
                onChange={setGrnPhoto}
                disabled={busy}
              />
            </div>
          </fieldset>

          {mode === "item" ? (
            <div className="space-y-3">
              {!newPart ? (
                <div className="relative">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Part</span>
                    {part ? (
                      <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm">
                        <span className="truncate">
                          <strong>{part.partNumber}</strong> · {part.name}
                          {part.quantityInStock != null ? <span className="text-slate-600"> · {part.quantityInStock} on hand</span> : null}
                        </span>
                        <button type="button" className="font-medium text-brand-700 underline" onClick={() => setPart(null)}>Change</button>
                      </div>
                    ) : (
                      <input className={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search part name or code" autoComplete="off" />
                    )}
                  </label>
                  {!part && hits.length > 0 ? (
                    <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {hits.map((hit) => (
                        <li key={hit.id}>
                          <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-slate-50" onClick={() => { setPart(hit); setHits([]); }}>
                            <span className="truncate"><strong>{hit.partNumber}</strong> · {hit.name}</span>
                            <span className="shrink-0 text-xs text-slate-500">{hit.quantityInStock ?? 0} on hand</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Part code</span><input className={field} value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} maxLength={64} /></label>
                  <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Part name</span><input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} /></label>
                  <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Category</span><input className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="General" maxLength={100} /></label>
                  <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Unit</span><input className={field} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} maxLength={20} /></label>
                </div>
              )}
              <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4" checked={newPart} onChange={(e) => { setNewPart(e.target.checked); setPart(null); setError(null); }} />
                New part (not in Spare Parts yet)
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Quantity received</span><input inputMode="numeric" className={field} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/[^\d]/g, "") })} /></label>
                <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Unit cost (LKR)</span><input inputMode="decimal" className={field} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value.replace(/[^\d.]/g, "") })} placeholder="Optional" /></label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={downloadGoodsInTemplate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700">
                  <Download size={16} aria-hidden /> Download template
                </button>
                <label className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-3 text-sm font-semibold text-brand-800">
                  <FileSpreadsheet size={16} aria-hidden /> {fileName ? `Change file (${fileName})` : "Choose Excel file"}
                  <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => { void chooseFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                </label>
              </div>
              <p className="text-xs text-slate-500">Columns: Part code and Quantity are needed. Part name is needed only for new codes. Supplier / GRN in the file override the boxes above.</p>
              {preview ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-700">
                    {preview.counts.total} line(s) · {preview.totalQuantity} item(s) ·{" "}
                    <span className="text-emerald-700">{preview.counts.ok} ready</span>
                    {preview.counts.newParts ? <span className="text-sky-700"> · {preview.counts.newParts} new part(s)</span> : null}
                    {preview.counts.errors ? <span className="font-semibold text-rose-700"> · {preview.counts.errors} to fix</span> : null}
                  </p>
                  <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
                        <tr><th className="px-3 py-2">Line</th><th className="px-3 py-2">Part</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.lines.map((line) => (
                          <tr key={line.row}>
                            <td className="px-3 py-2 text-slate-500">{line.row}</td>
                            <td className="px-3 py-2"><strong>{line.partNumber || "—"}</strong>{line.name ? ` · ${line.name}` : ""}</td>
                            <td className="px-3 py-2 text-right">{line.quantity || "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[line.status]}`}>{STATUS_LABEL[line.status]}</span>
                              {line.status === "ERROR" && line.message ? <span className="ml-2 text-xs text-rose-700">{line.message}</span> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.counts.errors ? <p className="text-xs text-rose-700">Fix the lines marked Fix in the file and choose it again. Line 1 is the first row under the headings (blank rows are skipped).</p> : null}
                </div>
              ) : null}
            </div>
          )}

          {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700">Cancel</button>
          {mode === "item" ? (
            <button type="button" disabled={busy} onClick={saveItem} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <ButtonSpinner /> : null} Receive
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !preview || preview.counts.errors > 0}
              onClick={() => void save(excelLines)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? <ButtonSpinner /> : null} Receive {preview ? `${preview.counts.total} line(s)` : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
