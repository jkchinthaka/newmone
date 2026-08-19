"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import {
  applyErpExcelImport,
  ErpExcelColumnMapping,
  ErpExcelImportRun,
  ErpExcelPreviewRow,
  fetchErpExcelImportHistory,
  uploadErpExcelImport,
  validateErpExcelImport
} from "@/lib/erp-excel-import-api";

type Step = "upload" | "map" | "preview" | "confirm" | "done";

const CONFIRM_TEXT =
  "You are about to synchronize MaintainPro stock quantities to the uploaded ERP stock snapshot.";

export function ErpExcelImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<ErpExcelImportRun | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ErpExcelColumnMapping>({
    itemCode: "",
    quantity: "",
    itemName: "",
    warehouse: "",
    uom: "",
    businessDate: ""
  });
  const [sheetName, setSheetName] = useState("");
  const [warehouseScope, setWarehouseScope] = useState("");
  const [preview, setPreview] = useState<ErpExcelPreviewRow[]>([]);
  const [summary, setSummary] = useState<{
    totalRows: number;
    matched: number;
    changed: number;
    unchanged: number;
    unmapped: number;
    duplicates: number;
    invalid: number;
  } | null>(null);
  const [history, setHistory] = useState<ErpExcelImportRun[]>([]);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const statusTone = useMemo(
    () =>
      ({
        CHANGE: "text-amber-700 bg-amber-50",
        UNCHANGED: "text-slate-700 bg-slate-50",
        MATCHED: "text-emerald-700 bg-emerald-50",
        UNMAPPED: "text-violet-700 bg-violet-50",
        DUPLICATE: "text-rose-700 bg-rose-50",
        INVALID: "text-rose-800 bg-rose-100"
      }) as Record<string, string>,
    []
  );

  async function refreshHistory() {
    try {
      const data = await fetchErpExcelImportHistory();
      setHistory(data.items);
    } catch {
      // history is optional on first paint
    }
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const data = await uploadErpExcelImport(file);
      setRun(data.run);
      setHeaders(data.insight.headers);
      setSheetNames(data.insight.sheetNames);
      setWarehouses(data.insight.warehousesDetected);
      setSheetName(data.insight.selectedSheet);
      setMapping({
        itemCode: data.insight.suggestedMapping.itemCode ?? "",
        quantity: data.insight.suggestedMapping.quantity ?? "",
        itemName: data.insight.suggestedMapping.itemName ?? "",
        warehouse: data.insight.suggestedMapping.warehouse ?? "",
        uom: data.insight.suggestedMapping.uom ?? "",
        businessDate: data.insight.suggestedMapping.businessDate ?? ""
      });
      if (data.insight.warehousesDetected.length === 1) {
        setWarehouseScope(data.insight.warehousesDetected[0]);
      }
      setStep("map");
      toast.success(data.reused ? "Recovered existing import for this file" : "Workbook uploaded");
      void refreshHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onValidate() {
    if (!run) return;
    if (!mapping.itemCode || !mapping.quantity) {
      toast.error("Select Item Code and Quantity columns");
      return;
    }
    setBusy(true);
    try {
      const data = await validateErpExcelImport(run.id, {
        sheetName,
        mapping: {
          itemCode: mapping.itemCode,
          quantity: mapping.quantity,
          itemName: mapping.itemName || null,
          warehouse: mapping.warehouse || null,
          uom: mapping.uom || null,
          businessDate: mapping.businessDate || null
        },
        warehouseScope: warehouseScope || null
      });
      setRun(data.run);
      setPreview(data.preview);
      setSummary(data.summary);
      setWarehouses((data.run.warehousesDetected as string[]) ?? warehouses);
      setStep("preview");
      if (data.blocked) {
        toast.error("Import blocked until duplicates/invalid rows are resolved");
      } else {
        toast.success("Preview ready");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function onApply() {
    if (!run || !confirmChecked) {
      toast.error("Confirm the synchronization statement before applying");
      return;
    }
    setBusy(true);
    try {
      const data = await applyErpExcelImport(run.id);
      setRun(data.run);
      setPreview(data.preview);
      setResultMessage(data.message);
      setStep("done");
      toast.success(data.reused ? "Returned existing apply result" : "Stock synchronized");
      void refreshHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">ERP Stock Import</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload the daily ERP Excel stock balance, map columns, preview differences, then synchronize
            absolute quantities into MaintainPro.
          </p>
        </div>
        <Link href="/inventory" className="text-sm font-medium text-brand-700 hover:underline">
          Back to Inventory
        </Link>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {(["upload", "map", "preview", "confirm", "done"] as Step[]).map((item) => (
          <li
            key={item}
            className={`rounded-full px-3 py-1 ${
              step === item ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {item}
          </li>
        ))}
      </ol>

      {step === "upload" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">1. Upload ERP Excel</h2>
          <p className="mt-1 text-sm text-slate-600">Accepts `.xlsx` only, maximum 10 MB.</p>
          <input
            className="mt-4 block w-full text-sm"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={busy}
            onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
          />
        </section>
      ) : null}

      {step === "map" && run ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">2. Sheet & column mapping</h2>
          <p className="text-sm text-slate-600">
            Confirm the ERP Item Code and Current Quantity columns before preview. File:{" "}
            <strong>{run.originalFilename}</strong>
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Sheet
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={sheetName}
                onChange={(event) => setSheetName(event.target.value)}
              >
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {warehouses.length > 1 ? (
              <label className="text-sm">
                Warehouse scope
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={warehouseScope}
                  onChange={(event) => setWarehouseScope(event.target.value)}
                >
                  <option value="">Select warehouse…</option>
                  {warehouses.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {(
              [
                ["itemCode", "Item Code / Part Number"],
                ["quantity", "Current Quantity"],
                ["itemName", "Item Name (optional)"],
                ["warehouse", "Warehouse (optional)"],
                ["uom", "UOM (optional)"],
                ["businessDate", "Business Date (optional)"]
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={mapping[key] ?? ""}
                  onChange={(event) => setMapping((prev) => ({ ...prev, [key]: event.target.value }))}
                >
                  <option value="">—</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onValidate()}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Validate & preview
          </button>
        </section>
      ) : null}

      {(step === "preview" || step === "confirm") && summary ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {[
              ["Total", summary.totalRows],
              ["Matched", summary.matched],
              ["Changed", summary.changed],
              ["Unchanged", summary.unchanged],
              ["Unmapped", summary.unmapped],
              ["Duplicates", summary.duplicates],
              ["Invalid", summary.invalid]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">ERP Item Code</th>
                  <th className="px-3 py-2">Item Name</th>
                  <th className="px-3 py-2">MaintainPro Item</th>
                  <th className="px-3 py-2">MP Qty</th>
                  <th className="px-3 py-2">ERP Qty</th>
                  <th className="px-3 py-2">Diff</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 200).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{row.erpItemCode ?? "—"}</td>
                    <td className="px-3 py-2">{row.itemName ?? "—"}</td>
                    <td className="px-3 py-2">{row.maintainProItem ?? "—"}</td>
                    <td className="px-3 py-2">{row.maintainProQuantity ?? "—"}</td>
                    <td className="px-3 py-2">{row.erpQuantity ?? "—"}</td>
                    <td className="px-3 py-2">{row.difference ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[row.status] ?? ""}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {run?.status === "VALIDATED" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-950">3. Confirm & sync</h3>
              <p className="mt-2 text-sm text-amber-900">{CONFIRM_TEXT}</p>
              <label className="mt-3 flex items-start gap-2 text-sm text-amber-950">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(event) => {
                    setConfirmChecked(event.target.checked);
                    setStep(event.target.checked ? "confirm" : "preview");
                  }}
                />
                I understand MaintainPro quantities will be set to the ERP Excel balances (absolute sync).
              </label>
              <button
                type="button"
                disabled={busy || !confirmChecked}
                onClick={() => void onApply()}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Confirm & Sync
              </button>
            </div>
          ) : (
            <p className="text-sm text-rose-700">
              Apply is blocked while duplicates or invalid rows remain. Fix the workbook or warehouse scope and
              validate again.
            </p>
          )}
        </section>
      ) : null}

      {step === "done" && run ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold text-emerald-950">Import completed</h2>
          <p className="mt-2 text-sm text-emerald-900">{resultMessage}</p>
          <ul className="mt-3 grid gap-1 text-sm text-emerald-950 sm:grid-cols-2">
            <li>Updated items: {run.updatedRows}</li>
            <li>Unchanged items: {run.unchangedRows}</li>
            <li>Unmapped items: {run.unmappedRows}</li>
            <li>Failed items: {run.failedRows}</li>
            <li>Status: {run.status}</li>
            <li>Reference: ERP-EXCEL:{run.id}</li>
          </ul>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-brand-800 underline"
            onClick={() => {
              setStep("upload");
              setRun(null);
              setPreview([]);
              setSummary(null);
              setConfirmChecked(false);
            }}
          >
            Start another import
          </button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Import history</h2>
          <button
            type="button"
            className="text-sm font-medium text-brand-700 hover:underline"
            onClick={() => void refreshHistory()}
          >
            Refresh history
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Changed</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{new Date(item.uploadedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{item.originalFilename}</td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="px-3 py-2">{item.changedRows}</td>
                  <td className="px-3 py-2">{item.updatedRows}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>
                    No imports yet for this tenant.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default ErpExcelImportPage;
