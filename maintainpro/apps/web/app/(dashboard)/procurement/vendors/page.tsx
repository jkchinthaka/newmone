"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ErrorState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";

type Reason = { code: string; message: string };
type VendorRow = {
  id: string;
  name: string;
  vendorCode: string | null;
  availability: string;
  eligibility: string;
  assignmentAllowed: boolean;
  reasons: Reason[];
  contract: { state: string; startDate: string | null; endDate: string | null };
  insurance: { state: string; expiresAt: string | null; required: boolean };
  blacklistReason: string | null;
};

type Counts = { all: number; eligible: number; needsReview: number; ineligible: number; expiringSoon: number };

const VIEWS = [
  ["", "All", "all"],
  ["ELIGIBLE", "Eligible", "eligible"],
  ["NEEDS_REVIEW", "Needs review", "needsReview"],
  ["INELIGIBLE", "Ineligible", "ineligible"]
] as const;

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
}

export default function VendorEligibilityPage() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const search = params.get("search") || "";
  const eligibility = params.get("eligibility") || "";
  const availability = params.get("availability") || "";
  const document = params.get("document") || "";
  const page = Math.max(1, Number(params.get("page") || "1"));
  const [searchInput, setSearchInput] = useState(search);
  const [items, setItems] = useState<VendorRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [total, setTotal] = useState(0);
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VendorRow | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"].includes(user.role ?? "");

  const writeQuery = (next: Record<string, string | null>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) query.delete(key);
      else query.set(key, value);
    }
    query.delete("page");
    const text = query.toString();
    router.replace((text ? `${pathname}?${text}` : pathname) as Route);
  };

  const refresh = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("You are offline. Vendor eligibility was not refreshed.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/enterprise-ops/vendors", {
        params: {
          search: search || undefined,
          eligibility: eligibility || undefined,
          availability: availability || undefined,
          document: document || undefined,
          page,
          pageSize: 25
        }
      });
      const payload = response.data as { data?: { items?: VendorRow[]; counts?: Counts; evaluatedAt?: string }; meta?: { total?: number } };
      setItems(payload.data?.items ?? []);
      setCounts(payload.data?.counts ?? null);
      setEvaluatedAt(payload.data?.evaluatedAt ?? null);
      setTotal(payload.meta?.total ?? 0);
    } catch (err) {
      setItems([]);
      setCounts(null);
      setError(getApiErrorMessage(err, "We couldn't load vendor eligibility."));
    } finally {
      setLoading(false);
    }
  }, [availability, document, eligibility, page, search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setBlocked(vendor: VendorRow, blocked: boolean) {
    if (!reason.trim()) {
      setNotice("Enter a reason before blocking or unblocking.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await apiClient.patch(`/suppliers/${vendor.id}/blacklist`, { blacklisted: blocked, reason });
      setReason("");
      setSelected(null);
      await refresh();
    } catch (err) {
      setNotice(getApiErrorMessage(err, "The vendor status was not changed."));
    } finally {
      setSaving(false);
    }
  }

  const filtersActive = Boolean(search || eligibility || availability || document);
  const configured = (counts?.all ?? total) === 0 && !filtersActive && !loading && !error;

  return (
    <div className="ops-page">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Vendor Eligibility</h1>
          <p className="mt-1 text-sm text-slate-600">Review vendor availability and required documents before assigning work.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Link href={"/master-data/suppliers" as Route} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm">
              Manage vendors
            </Link>
          ) : null}
          <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => void refresh()}>Refresh</button>
        </div>
      </header>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Eligibility views">
        {VIEWS.map(([value, labelText, key]) => (
          <button key={labelText} type="button" role="tab" aria-selected={eligibility === value} className={`min-h-11 rounded-full border px-3 text-sm ${eligibility === value ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"}`} onClick={() => writeQuery({ eligibility: value || null })}>
            {labelText} <span className="font-semibold">{counts ? counts[key] : "—"}</span>
          </button>
        ))}
        <button type="button" aria-pressed={document === "expiring"} className={`min-h-11 rounded-full border px-3 text-sm ${document === "expiring" ? "border-amber-600 bg-amber-50" : "border-slate-300 bg-white"}`} onClick={() => writeQuery({ document: document === "expiring" ? null : "expiring" })}>
          Expiring soon <span className="font-semibold">{counts ? counts.expiringSoon : "—"}</span>
        </button>
      </div>
      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); writeQuery({ search: searchInput || null }); }}>
        <label className="text-sm">Search<input className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Vendor name or code" /></label>
        <label className="text-sm">Availability
          <select className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={availability} onChange={(event) => writeQuery({ availability: event.target.value || null })}>
            <option value="">Any</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </label>
        <label className="text-sm">Document
          <select className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={document} onChange={(event) => writeQuery({ document: event.target.value || null })}>
            <option value="">Any</option>
            <option value="expiring">Expiring soon</option>
          </select>
        </label>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>{loading ? "Loading results" : `${total} vendor${total === 1 ? "" : "s"}`}</span>
        {evaluatedAt ? <span>Checked {new Date(evaluatedAt).toLocaleString()}</span> : null}
        {filtersActive ? <button type="button" className="min-h-11 rounded border border-slate-300 px-3" onClick={() => { setSearchInput(""); writeQuery({ search: null, eligibility: null, availability: null, document: null }); }}>Clear filters</button> : null}
      </div>
      {notice ? <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm" role="alert">{notice}</p> : null}
      {error ? <ErrorState title="We couldn't load vendor eligibility." description={error} onRetry={() => void refresh()} /> : null}
      {loading ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-busy="true" /> : null}
      {!loading && !error && configured ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">No vendors configured</h2>
          <p className="mt-1 text-sm text-slate-600">Add a vendor before checking assignment eligibility.</p>
        </div>
      ) : null}
      {!loading && !error && !configured && items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">No vendors match these filters</h2>
          <button type="button" className="mt-3 min-h-11 rounded border px-3 text-sm" onClick={() => { setSearchInput(""); writeQuery({ search: null, eligibility: null, availability: null, document: null }); }}>Clear filters</button>
        </div>
      ) : null}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Availability</th>
              <th className="px-3 py-2">Eligibility</th>
              <th className="px-3 py-2">Contract</th>
              <th className="px-3 py-2">Insurance</th>
              <th className="px-3 py-2">Next action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((vendor) => (
              <tr key={vendor.id} className="border-b">
                <td className="px-3 py-3"><button type="button" className="font-medium text-brand-700 underline" onClick={() => setSelected(vendor)}>{vendor.name}</button><div className="text-xs text-slate-500">{vendor.vendorCode || "No code"}</div></td>
                <td className="px-3 py-3">{label(vendor.availability)}</td>
                <td className="px-3 py-3">{label(vendor.eligibility)}<div className="text-xs text-slate-600">{vendor.reasons[0]?.message || "Meets the rules currently enforced."}</div></td>
                <td className="px-3 py-3">{label(vendor.contract.state)}</td>
                <td className="px-3 py-3">{label(vendor.insurance.state)}</td>
                <td className="px-3 py-3">{vendor.assignmentAllowed ? "Available to assign" : "Resolve before assigning"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {items.map((vendor) => (
          <li key={vendor.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setSelected(vendor)}>{vendor.name}</button>
            <p className="text-sm text-slate-600">{vendor.vendorCode || "No code"}</p>
            <p className="mt-1 text-sm">{label(vendor.availability)} · {label(vendor.eligibility)}</p>
            <p className="mt-1 text-sm text-slate-600">{vendor.reasons[0]?.message || "Meets the rules currently enforced."}</p>
          </li>
        ))}
      </ul>
      {selected ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="vendor-detail-title">
          <h2 id="vendor-detail-title" className="font-semibold">{selected.name}</h2>
          <p className="mt-1 text-sm">{label(selected.availability)} · {label(selected.eligibility)}</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
            {selected.reasons.length === 0 ? <li>This vendor meets every enforced requirement.</li> : selected.reasons.map((item) => <li key={item.code}>{item.message}</li>)}
          </ul>
          <p className="mt-2 text-sm">Contract: {label(selected.contract.state)}. Insurance: {label(selected.insurance.state)}{selected.insurance.required ? "" : " (not required)"}.</p>
          {selected.blacklistReason ? <p className="mt-2 text-sm">Block reason: {selected.blacklistReason}</p> : null}
          {canManage ? (
            <div className="mt-3 space-y-2">
              <label className="block text-sm">Reason<textarea className="mt-1 w-full rounded border px-3 py-2" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
              {selected.availability === "BLOCKED" ? (
                <button type="button" className="min-h-11 rounded bg-slate-900 px-3 text-sm text-white" disabled={saving} onClick={() => void setBlocked(selected, false)}>Unblock</button>
              ) : (
                <button type="button" className="min-h-11 rounded bg-slate-900 px-3 text-sm text-white" disabled={saving} onClick={() => void setBlocked(selected, true)}>Block vendor</button>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
