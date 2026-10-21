"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";

type PreviewRow = {
  rowNumber: number;
  assetTag: string;
  matchTarget: string;
  status: string;
  action: string;
  message: string;
};

type AppliedRow = PreviewRow & { entityId?: string; entityKind?: string };

export default function AssetTagUploadPage() {
  const user = useCurrentUser();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [allowReplace, setAllowReplace] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tags, setTags] = useState<AppliedRow[]>([]);
  const [saving, setSaving] = useState(false);
  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") return <p className="p-4">Access required</p>;

  async function preview(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError("");
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await apiClient.post("/admin/asset-tags/preview", body);
      setRows(response.data?.data ?? []);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The asset tag file could not be processed."));
    }
  }

  async function apply() {
    if (!file || saving) return;
    setSaving(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("allowReplace", String(allowReplace));
    body.set("replaceReason", reason);
    try {
      const response = await apiClient.post("/admin/asset-tags/apply", body);
      setTags((response.data?.data?.applied ?? []) as AppliedRow[]);
      setMessage("Valid rows applied.");
      const invalid = (response.data?.data?.invalid ?? []) as PreviewRow[];
      if (invalid.length) {
        const csv = ["rowNumber,assetTag,message", ...invalid.map((row) => `${row.rowNumber},${row.assetTag},"${row.message}"`)].join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "asset-tag-errors.csv";
        anchor.click();
      }
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The asset tag file could not be processed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Asset tag upload</h1>
      <p className="flex flex-wrap gap-3">
        <a href="/api/admin/asset-tags/template.csv">CSV template</a>
        <a href="/api/admin/asset-tags/template.xlsx">XLSX template</a>
        <Link href="/assets">Existing bulk import</Link>
      </p>
      <form className="space-y-3" onSubmit={preview}>
        <label className="block text-sm" htmlFor="tag-file">CSV or XLSX file</label>
        <input id="tag-file" accept=".csv,.xlsx" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button className="h-11 rounded-md border px-4" type="submit">Preview</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th>Row</th><th>Tag</th><th>Match</th><th>Status</th><th>Action</th><th>Explanation</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowNumber}>
                <td>{row.rowNumber}</td><td>{row.assetTag}</td><td>{row.matchTarget}</td><td>{row.status}</td><td>{row.action}</td><td>{row.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={allowReplace} onChange={(event) => setAllowReplace(event.target.checked)} /> Allow replace</label>
      <input aria-label="Replace reason" className="h-11 w-full rounded-md border px-3" value={reason} onChange={(event) => setReason(event.target.value)} />
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <button className="h-11 rounded-md bg-slate-900 px-4 text-white disabled:opacity-60" disabled={saving} type="button" onClick={() => void apply()}>Apply valid rows</button>
      {tags.length ? (
        <div className="space-y-2">
          <p>Print QR labels for this batch. Each code encodes the applied asset tag.</p>
          {tags.filter((row) => row.entityKind !== "vehicle" && row.entityId).map((row) => (
            <a key={row.entityId} href={`/api/assets/${row.entityId}/qr-code/download`}>{row.assetTag}</a>
          ))}
        </div>
      ) : null}
    </main>
  );
}
