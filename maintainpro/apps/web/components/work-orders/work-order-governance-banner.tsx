"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import {
  getApprovalStatusLabel,
  getLifecycleStageLabel,
  getVerificationStatusLabel,
  GOVERNANCE_MESSAGES,
  type WorkOrderVerificationStatus
} from "@/lib/work-order-governance";
import { fetchWorkOrderRiskScore, severityClass } from "@/components/reports/maintenance-reports-api";
import type { WorkOrder } from "./types";

type Props = {
  workOrder: WorkOrder;
  /** Extra one-line warnings (e.g. repeat issue) merged into the single warning box. */
  extraWarnings?: string[];
};

export function WorkOrderGovernanceBanner({ workOrder, extraWarnings = [] }: Props) {
  const verificationStatus = (workOrder.verificationStatus ?? "NOT_REQUIRED") as WorkOrderVerificationStatus;
  const warnings: string[] = [...extraWarnings];
  const [riskScore, setRiskScore] = useState<{ score: number; severity: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchWorkOrderRiskScore(workOrder.id)
      .then((data) => {
        if (!cancelled) setRiskScore({ score: data.score, severity: data.severity });
      })
      .catch(() => {
        if (!cancelled) setRiskScore(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workOrder.id]);

  if (verificationStatus === "REJECTED") {
    warnings.push("Supervisor rejected this job. It must be fixed again before closing.");
  }
  if (workOrder.status === "IN_PROGRESS" || workOrder.status === "ON_HOLD") {
    warnings.push(GOVERNANCE_MESSAGES.lockedAfterStart);
  }

  return (
    <section className="space-y-3">
      <details>
        <summary className="cursor-pointer text-sm font-medium text-brand-700">More details (lifecycle, approval, risk)</summary>
        <dl className="mt-2 grid gap-x-4 gap-y-2 text-sm text-ink sm:grid-cols-2">
          <div>
            <dt className="font-medium text-brand-800">Lifecycle stage</dt>
            <dd>{getLifecycleStageLabel(workOrder.status)}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-800">Approval</dt>
            <dd>{getApprovalStatusLabel(workOrder.approvalStatus)}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-800">Supervisor check</dt>
            <dd>{getVerificationStatusLabel(verificationStatus)}</dd>
          </div>
          {riskScore && Number.isFinite(riskScore.score) ? (
            <div>
              <dt className="font-medium text-brand-800">Operational risk score</dt>
              <dd>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-sm font-semibold ${severityClass(riskScore.severity as "LOW")}`}>
                  {riskScore.score} · {riskScore.severity}
                </span>
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="font-medium text-brand-800">Photos requirement</dt>
            <dd>Add before and after photos on the photos tab.</dd>
          </div>
        </dl>
      </details>
      {workOrder.status === "CANCELLED" ? (
        <p className="text-sm text-slate-800">
          Lifecycle is Cancelled. Approval stays as the historical decision and is not a reason to reopen this job.
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{warnings.join(" · ")}</span>
        </div>
      ) : null}
    </section>
  );
}
