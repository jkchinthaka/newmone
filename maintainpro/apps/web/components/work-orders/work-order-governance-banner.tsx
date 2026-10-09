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
};

export function WorkOrderGovernanceBanner({ workOrder }: Props) {
  const verificationStatus = (workOrder.verificationStatus ?? "NOT_REQUIRED") as WorkOrderVerificationStatus;
  const warnings: string[] = [];
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

  if (workOrder.status === "TECHNICIAN_COMPLETED") {
    warnings.push(GOVERNANCE_MESSAGES.supervisorRequired);
  }
  if (verificationStatus === "REJECTED") {
    warnings.push("Supervisor rejected this job. Rework is required before closing.");
  }
  if (workOrder.status === "IN_PROGRESS" || workOrder.status === "ON_HOLD") {
    warnings.push(GOVERNANCE_MESSAGES.lockedAfterStart);
  }

  return (
    <section className="space-y-2 rounded-xl border border-brand-100 bg-brand-50 p-3">
      <div>
        <h4 className="text-sm font-semibold text-ink">Governance and lifecycle</h4>
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
            <dt className="font-medium text-brand-800">Verification</dt>
            <dd>{getVerificationStatusLabel(verificationStatus)}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-800">Operational risk score</dt>
            <dd>
              {riskScore ? (
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-sm font-semibold ${severityClass(riskScore.severity as "LOW")}`}>
                  {riskScore.score} · {riskScore.severity}
                </span>
              ) : (
                "Not available"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-brand-800">Evidence requirement</dt>
            <dd>Upload before/after photos on the Evidence tab when storage is enabled.</dd>
          </div>
        </dl>
      </div>

      {warnings.length > 0 ? (
        <ul className="space-y-2">
          {warnings.map((message) => (
            <li
              key={message}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
