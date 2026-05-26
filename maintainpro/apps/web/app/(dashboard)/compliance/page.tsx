"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, ShieldX, RefreshCw, FileWarning } from "lucide-react";

import {
  formatDate,
  p4Get
} from "@/lib/phase4-api";
import { getApiErrorMessage } from "@/lib/api-client";

interface Summary {
  total: number;
  compliant: number;
  attention: number;
  nonCompliant: number;
}

interface ExpiringDoc {
  id: string;
  documentType: string;
  documentNumber?: string | null;
  expiryDate: string;
  status: string;
  vehicle?: { id: string; registrationNo: string; make: string; vehicleModel: string };
}

export default function CompliancePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [docs, setDocs] = useState<ExpiringDoc[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        p4Get<Summary>("/compliance/summary"),
        p4Get<ExpiringDoc[]>("/compliance/expiring-documents", { days })
      ]);
      setSummary(s);
      setDocs(d);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load compliance overview"));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vehicle Compliance</h1>
          <p className="text-sm text-slate-600">
            Fleet-wide compliance status and upcoming document expirations.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Vehicles"
          value={summary?.total ?? 0}
          icon={<RefreshCw size={18} />}
          tone="bg-slate-100 text-slate-700"
        />
        <SummaryCard
          label="Compliant"
          value={summary?.compliant ?? 0}
          icon={<CheckCircle2 size={18} />}
          tone="bg-emerald-100 text-emerald-700"
        />
        <SummaryCard
          label="Attention Required"
          value={summary?.attention ?? 0}
          icon={<AlertTriangle size={18} />}
          tone="bg-amber-100 text-amber-700"
        />
        <SummaryCard
          label="Non-Compliant"
          value={summary?.nonCompliant ?? 0}
          icon={<ShieldX size={18} />}
          tone="bg-rose-100 text-rose-700"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileWarning size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-900">Documents expiring within</h2>
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value) || 30)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
            >
              <option value={7}>7 days</option>
              <option value={15}>15 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <span className="text-xs text-slate-500">{docs.length} document(s)</span>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Number</th>
                <th className="px-4 py-2 text-left">Expiry</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? "Loading..." : "No documents expiring in this window."}
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">
                        {doc.vehicle?.registrationNo ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {doc.vehicle?.make} {doc.vehicle?.vehicleModel}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{doc.documentType}</td>
                    <td className="px-4 py-2 text-slate-700">{doc.documentNumber ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{formatDate(doc.expiryDate)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        EXPIRING
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${tone}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
