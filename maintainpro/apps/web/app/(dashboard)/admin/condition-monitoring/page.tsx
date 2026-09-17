"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type Rule = {
  id: string;
  code: string;
  name: string;
  measurementType: string;
  upperWarning: number | null;
  upperCritical: number | null;
  lowerWarning: number | null;
  lowerCritical: number | null;
  active: boolean;
};

type EventRow = {
  id: string;
  severity: string;
  status: string;
  readingValue: number;
  message: string;
  rule?: { code: string; name: string };
};

export default function AdminConditionMonitoringPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: "",
    name: "",
    measurementType: "TEMPERATURE",
    upperWarning: "",
    upperCritical: ""
  });

  const rulesQuery = useQuery({
    queryKey: withTenantScope(["admin", "condition-rules"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Rule[] }>("/condition-rules");
      return res.data.data;
    }
  });

  const eventsQuery = useQuery({
    queryKey: withTenantScope(["admin", "condition-events"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: EventRow[] }>("/condition-events?status=OPEN");
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/condition-rules", {
        ...form,
        upperWarning: form.upperWarning ? Number(form.upperWarning) : null,
        upperCritical: form.upperCritical ? Number(form.upperCritical) : null,
        reason: "Admin condition rule upsert"
      });
    },
    onSuccess: () => {
      toast.success("Rule saved");
      setForm((f) => ({ ...f, code: "", name: "", upperWarning: "", upperCritical: "" }));
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "condition-rules"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Save failed"))
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/condition-events/${id}`, { status: "RESOLVED" });
    },
    onSuccess: () => {
      toast.success("Event resolved");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "condition-events"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Resolve failed"))
  });

  if (rulesQuery.isLoading) {
    return <LoadingState title="Loading CBM rules" description="Condition monitoring." />;
  }
  if (rulesQuery.isError) {
    return (
      <ErrorState
        title="Unable to load rules"
        description={getApiErrorMessage(rulesQuery.error, "Request failed")}
        onRetry={() => rulesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Maintenance config", href: "/admin/maintenance-config" },
          { label: "Condition monitoring" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Condition-based monitoring</h1>
        <p className="mt-1 text-sm text-slate-600">
          Threshold rules evaluated on meter readings. Open events are deduplicated until resolved.
        </p>
      </div>

      <div className="grid max-w-xl gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Code"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <select
          className="rounded border px-3 py-2 text-sm"
          value={form.measurementType}
          onChange={(e) => setForm((f) => ({ ...f, measurementType: e.target.value }))}
        >
          {["TEMPERATURE", "VIBRATION", "PRESSURE", "VOLTAGE", "CURRENT", "OIL", "GENERIC"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Upper warning"
            value={form.upperWarning}
            onChange={(e) => setForm((f) => ({ ...f, upperWarning: e.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Upper critical"
            value={form.upperCritical}
            onChange={(e) => setForm((f) => ({ ...f, upperCritical: e.target.value }))}
          />
        </div>
        <button
          type="button"
          className="w-fit rounded bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={!form.code || !form.name || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Save rule
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Warn / Crit</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(rulesQuery.data ?? []).map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2">{r.measurementType}</td>
                <td className="px-3 py-2">
                  {r.upperWarning ?? "—"} / {r.upperCritical ?? "—"}
                </td>
                <td className="px-3 py-2">{r.active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Open events</h2>
        <div className="space-y-2">
          {(eventsQuery.data ?? []).map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded border bg-white p-3 text-sm">
              <div>
                <span className="font-medium text-amber-800">{e.severity}</span>{" "}
                <span className="text-slate-600">{e.rule?.code}</span>
                <p className="mt-1 text-slate-700">{e.message}</p>
              </div>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => resolveMutation.mutate(e.id)}
              >
                Resolve
              </button>
            </div>
          ))}
          {(eventsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No open condition events.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
