"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";

type DomainContext = {
  workOrderId: string;
  woNumber: string;
  jobDomain: string | null;
  identity: {
    machinery: Record<string, unknown> | null;
    service: Record<string, unknown> | null;
    vehicle: Record<string, unknown> | null;
  };
  completion: Record<string, unknown>;
  serviceDue: Record<string, unknown> | null;
  openJobsOnTarget: number;
  criticalOpenWorkOrders: number;
  controlIndicators: Array<{ code: string; label: string; severity: string }>;
  accident: { id: string; reportNumber: string; status: string } | null;
  readOnlyHints: Record<string, boolean>;
};

type Props = {
  workOrderId: string;
  workOrderStatus?: string;
  canReturnToService?: boolean;
};

function displayValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value);
  if (/^[A-Z0-9_]+$/.test(text) && text.includes("_")) {
    const words = text.toLowerCase().replaceAll("_", " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return text;
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-sm font-medium text-brand-800">{label}</dt>
      <dd className="break-words text-sm text-ink">{displayValue(value)}</dd>
    </div>
  );
}

export function WorkOrderDomainPanel({
  workOrderId,
  workOrderStatus,
  canReturnToService = false
}: Props) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["work-orders", workOrderId, "domain-context"],
    queryFn: async () => {
      const response = await apiClient.get<{ data: DomainContext }>(
        `/work-orders/${workOrderId}/domain-context`
      );
      return response.data.data;
    }
  });

  const rtsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/work-orders/${workOrderId}/return-to-service`, {
        note: "Authorized back in use after supervisor check"
      });
      return response.data?.data;
    },
    onSuccess: () => {
      toast.success("Back in use recorded");
      void queryClient.invalidateQueries({ queryKey: ["work-orders", workOrderId] });
      void query.refetch();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Back in use was blocked."));
    }
  });

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
        <div className="inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Loading domain context…
        </div>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {getApiErrorMessage(query.error, "Could not load domain context for this job.")}
      </section>
    );
  }

  const data = query.data;
  const domain = String(data.jobDomain ?? "").toUpperCase();
  const showRts =
    canReturnToService &&
    (workOrderStatus === "VERIFIED" || workOrderStatus === "CLOSED") &&
    (domain === "MACHINERY" || domain === "VEHICLE" || domain === "SERVICE");

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-2">
        <Wrench className="mt-0.5 h-4 w-4 text-brand-700" aria-hidden />
        <div>
          <h4 className="text-sm font-semibold text-ink">
            {domain === "VEHICLE"
              ? "Vehicle context"
              : domain === "SERVICE"
                ? "Facility / service context"
                : domain === "MACHINERY"
                  ? "Machinery context"
                  : "Domain context"}
          </h4>
          <p className="mt-1 text-sm text-brand-800">
            Canonical target identity and domain readiness. Job status stays separate from
            asset/vehicle operational status.
          </p>
        </div>
      </div>

      {data.controlIndicators.length > 0 ? (
        <div className="space-y-2">
          {data.controlIndicators.map((item) => (
            <div
              key={item.code}
              className={`rounded-lg border px-3 py-2 text-sm ${
                item.severity === "CRITICAL"
                  ? "border-rose-300 bg-rose-50 text-rose-950"
                  : "border-amber-300 bg-amber-50 text-amber-950"
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {data.identity.machinery ? (
        <dl className="grid gap-3 rounded-xl border border-brand-100 bg-white p-3 sm:grid-cols-2">
          <Field label="Machine" value={data.identity.machinery.label} />
          <Field label="Operational status" value={data.identity.machinery.operationalStatus} />
          <Field label="How important" value={data.identity.machinery.criticality} />
          <Field label="Site" value={data.identity.machinery.site} />
          <Field label="Location" value={data.identity.machinery.functionalLocation} />
          <Field label="Meter" value={data.identity.machinery.meterReading} />
        </dl>
      ) : null}

      {data.identity.service ? (
        <dl className="grid gap-3 rounded-xl border border-brand-100 bg-white p-3 sm:grid-cols-2">
          <Field label="Location / facility" value={data.identity.service.label} />
          <Field label="Site" value={data.identity.service.site} />
          <Field label="Parent" value={data.identity.service.parent} />
          <Field label="Type" value={data.identity.service.type} />
        </dl>
      ) : null}

      {data.identity.vehicle ? (
        <dl className="grid gap-3 rounded-xl border border-brand-100 bg-white p-3 sm:grid-cols-2">
          <Field label="Vehicle" value={data.identity.vehicle.label} />
          <Field label="Operational status" value={data.identity.vehicle.operationalStatus} />
          <Field label="Odometer" value={data.identity.vehicle.currentMileage} />
          <Field label="Service status" value={data.identity.vehicle.serviceStatus} />
          <Field label="Compliance" value={data.identity.vehicle.complianceStatus} />
          {data.serviceDue ? (
            <>
              <Field label="Next service (km)" value={data.serviceDue.nextServiceMileage} />
              <Field label="Overdue by (km)" value={data.serviceDue.overdueByKm} />
              <Field
                label="Service plan"
                value={data.serviceDue.configured ? "Configured" : "Not configured"}
              />
            </>
          ) : null}
        </dl>
      ) : null}

      <dl className="grid gap-3 rounded-xl border border-brand-100 bg-brand-50 p-3 sm:grid-cols-2">
        <Field label="Road / workshop test" value={data.completion.roadTestResult} />
        <Field label="Completion meter" value={data.completion.completionMeterReading} />
        <Field label="Operating restriction" value={data.completion.operatingRestriction} />
        <Field label="Production impact" value={data.completion.productionImpact} />
        <Field label="Temporary repair" value={data.completion.temporaryRepair} />
        <Field label="Production resumed" value={data.completion.productionResumedAt} />
      </dl>

      {data.accident ? (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          Accident reference: {data.accident.reportNumber} ({data.accident.status})
        </p>
      ) : null}

      {showRts ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="text-sm text-emerald-950">
            Supervisor return-to-service checks tests, critical open jobs, temporary restrictions, and
            compliance. Technician completion alone never marks the target available.
          </p>
          <button
            type="button"
            disabled={rtsMutation.isPending}
            onClick={() => rtsMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-70"
          >
            {rtsMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            Back in use
          </button>
        </div>
      ) : null}
    </section>
  );
}
