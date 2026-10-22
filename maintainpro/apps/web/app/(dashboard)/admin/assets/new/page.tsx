"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";

export default function RegisterAssetPage() {
  const user = useCurrentUser();
  const [assetTag, setAssetTag] = useState("");
  const [name, setName] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") return <p className="p-4">Access required</p>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await apiClient.post("/assets", { assetTag, name, category: "MACHINE" });
      setCreatedId(response.data?.data?.id ?? "");
      setAssetTag("");
      setName("");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The asset could not be registered."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Register asset</h1>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm" htmlFor="asset-tag">Asset tag</label>
        <input id="asset-tag" className="h-11 w-full rounded-md border px-3" required value={assetTag} onChange={(event) => setAssetTag(event.target.value)} />
        <label className="block text-sm" htmlFor="asset-name">Name</label>
        <input id="asset-name" className="h-11 w-full rounded-md border px-3" required value={name} onChange={(event) => setName(event.target.value)} />
        {error ? <p role="alert">{error}</p> : null}
        <button className="h-11 rounded-md bg-slate-900 px-4 text-white disabled:opacity-60" disabled={saving} type="submit">Register asset</button>
      </form>
      {createdId ? (
        <div className="space-y-2">
          <p role="status">Asset registered.</p>
          <Link href={`/assets?asset=${encodeURIComponent(createdId)}` as never}>Open asset</Link>
          <button type="button" onClick={() => setCreatedId("")}>Register another</button>
        </div>
      ) : null}
      <p><Link href="/admin/asset-tags">Bulk import and print QR labels</Link></p>
    </main>
  );
}
