"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

type Item = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
};

type Detail = {
  id: string;
  displayCode: string;
  status: string;
  result?: string | null;
  findings?: string | null;
  scheduledAt?: string | null;
  subjectName?: string;
  template?: { name?: string; version?: number } | null;
  asset?: { name?: string; assetTag?: string } | null;
  vehicle?: { registrationNo?: string; make?: string; vehicleModel?: string } | null;
  correctiveWorkOrderId?: string | null;
  findingRecords?: Array<{
    id: string;
    severity: string;
    description: string;
    itemKey?: string | null;
    maintenanceRequestId?: string | null;
    workOrderId?: string | null;
  }>;
  execution?: { templateSnapshot?: string; completedAt?: string | null; answers?: string | null } | null;
};

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [answers, setAnswers] = useState<Record<string, { value: string; comment: string; evidenceRefs: string[] }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const response = await apiClient.get<{ data: Detail }>(`/planning/inspections/${params.id}`);
      setDetail(response.data.data);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) setMissing(true);
      else setError(getApiErrorMessage(err, "Unable to load inspection."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  const items: Item[] = (() => {
    if (!detail?.execution?.templateSnapshot) return [];
    try {
      const snapshot = JSON.parse(detail.execution.templateSnapshot) as { items?: Item[] };
      return snapshot.items ?? [];
    } catch {
      return [];
    }
  })();
  const locked = detail?.status === "COMPLETED";

  if (loading) return <p className="p-6 text-sm text-slate-600">Loading inspection...</p>;
  if (missing) return <p className="p-6 text-sm">Inspection not found.</p>;
  if (error || !detail) {
    return <div className="p-6"><ErrorState title="Unable to load inspection" description={error ?? ""} onRetry={() => void load()} retryLabel="Retry" /></div>;
  }

  const subject = detail.asset?.name || [detail.vehicle?.make, detail.vehicle?.vehicleModel].filter(Boolean).join(" ") || detail.vehicle?.registrationNo || "Unassigned";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <PageBreadcrumbs />
      <Link href={"/maintenance/inspections" as Route} className="text-sm text-brand-700">Back to inspections</Link>
      <header>
        <p className="text-sm text-slate-500">{detail.displayCode}</p>
        <h1 className="text-2xl font-semibold">{detail.template?.name || detail.findings || "Inspection"}</h1>
        <p className="mt-1 text-sm text-slate-600">{subject}</p>
        <p className="text-sm">Status: {detail.status}{detail.result ? ` · Result: ${detail.result}` : ""}</p>
        {detail.template?.version ? <p className="text-sm text-slate-500">Template version {detail.template.version}</p> : null}
      </header>

      {detail.status === "SCHEDULED" || detail.status === "OPEN" ? (
        <button
          type="button"
          className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white"
          onClick={async () => {
            try {
              await apiClient.post(`/planning/inspections/${detail.id}/start`);
              toast.success("Inspection started");
              await load();
            } catch (err) {
              toast.error(getApiErrorMessage(err, "Could not start the inspection"));
            }
          }}
        >
          Start Inspection
        </button>
      ) : null}

      <section className="space-y-3">
        {items.map((item) => (
          <label key={item.key} className="block rounded-xl border bg-white p-3 text-sm">
            <span className="font-medium">{item.label}</span>
            {item.required ? <span className="text-rose-700"> required</span> : null}
            <input
              className="mt-2 min-h-11 w-full rounded-lg border px-3"
              disabled={locked}
              value={answers[item.key]?.value ?? ""}
              placeholder={item.type === "NUMERIC" ? `${item.minValue ?? ""}–${item.maxValue ?? ""} ${item.unit ?? ""}` : item.type}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [item.key]: { value: event.target.value, comment: current[item.key]?.comment ?? "", evidenceRefs: current[item.key]?.evidenceRefs ?? [] }
                }))
              }
            />
            {!locked ? (
              <input
                type="file"
                accept="image/*"
                className="mt-2 block w-full text-sm"
                aria-label={`Evidence for ${item.label}`}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file || !detail) return;
                  const contentBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const raw = String(reader.result ?? "");
                      resolve(raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw);
                    };
                    reader.onerror = () => reject(new Error("read failed"));
                    reader.readAsDataURL(file);
                  });
                  try {
                    const uploaded = await apiClient.post<{ data: { id: string } }>(`/planning/inspections/${detail.id}/evidence`, {
                      checklistItemKey: item.key,
                      fileName: file.name,
                      mimeType: file.type || "application/octet-stream",
                      contentBase64
                    });
                    const id = uploaded.data.data.id;
                    setAnswers((current) => ({
                      ...current,
                      [item.key]: {
                        value: current[item.key]?.value ?? "",
                        comment: current[item.key]?.comment ?? "",
                        evidenceRefs: [...(current[item.key]?.evidenceRefs ?? []), id]
                      }
                    }));
                    toast.success("Evidence attached");
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, "Could not attach evidence"));
                  }
                }}
              />
            ) : null}
          </label>
        ))}
        {!items.length ? <p className="text-sm text-slate-600">Start the inspection to load the checklist snapshot. Ad hoc inspections can be completed from the list.</p> : null}
      </section>

      {!locked && detail.status === "IN_PROGRESS" ? (
        <button
          type="button"
          className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
          onClick={async () => {
            try {
              await apiClient.post(`/planning/inspections/${detail.id}/complete`, { answers });
              toast.success("Inspection completed");
              await load();
            } catch (err) {
              toast.error(getApiErrorMessage(err, "Could not complete the inspection"));
            }
          }}
        >
          Complete Inspection
        </button>
      ) : null}

      {locked ? <p className="text-sm text-slate-600">This inspection is completed and read-only. Schedule a re-inspection instead of editing it.</p> : null}
      {locked ? (
        <button
          type="button"
          className="min-h-11 rounded-lg border px-4 text-sm"
          onClick={async () => {
            try {
              const response = await apiClient.post<{ data: { id: string } }>(`/planning/inspections/${detail.id}/reinspect`);
              toast.success("Re-inspection scheduled");
              window.location.href = `/maintenance/inspections/${response.data.data.id}`;
            } catch (err) {
              toast.error(getApiErrorMessage(err, "Could not schedule a re-inspection"));
            }
          }}
        >
          Create Re-inspection
        </button>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">Findings</h2>
        {(detail.findingRecords ?? []).map((finding) => (
          <article key={finding.id} className="rounded-xl border bg-white p-3 text-sm">
            <p className="font-medium">{finding.severity}</p>
            <p>{finding.description}</p>
            {finding.itemKey ? <p className="text-slate-500">Item: {finding.itemKey}</p> : null}
            {finding.maintenanceRequestId ? <Link className="text-brand-700" href={`/requests/${finding.maintenanceRequestId}` as Route}>Request</Link> : null}
            {finding.workOrderId ? <Link className="ml-3 text-brand-700" href={`/work-orders?wo=${finding.workOrderId}` as Route}>Work order</Link> : null}
          </article>
        ))}
        {detail.correctiveWorkOrderId ? <Link className="text-sm text-brand-700" href={`/work-orders?wo=${detail.correctiveWorkOrderId}` as Route}>Corrective work order</Link> : null}
      </section>
    </div>
  );
}
