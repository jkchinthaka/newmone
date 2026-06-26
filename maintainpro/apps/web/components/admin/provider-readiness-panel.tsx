"use client";

import { useCallback, useEffect, useState } from "react";
import { HardDrive, Loader2, Mail, Radio } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import type { NotificationReadinessSummary } from "@/lib/notification-uat";
import { useCurrentUser } from "@/lib/use-current-user";

type EvidenceReadiness = {
  indicator: "ENABLED" | "DISABLED" | "MISCONFIGURED";
  mode: string;
  state: string;
  uploadsEnabled: boolean;
  message: string;
};

type ApiEnvelope<T> = {
  data: T;
  message?: string;
};

function indicatorTone(indicator: string): string {
  if (indicator.endsWith("_ENABLED") || indicator === "ENABLED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (indicator.endsWith("_NOOP") || indicator === "DISABLED") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export function ProviderReadinessPanel() {
  const currentUser = useCurrentUser();
  const canView = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState<EvidenceReadiness | null>(null);
  const [notifications, setNotifications] = useState<NotificationReadinessSummary | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [evidenceResponse, notificationResponse] = await Promise.all([
        apiClient.get<ApiEnvelope<EvidenceReadiness>>("/evidence/readiness"),
        apiClient.get<ApiEnvelope<NotificationReadinessSummary>>("/notifications/readiness")
      ]);
      setEvidence(evidenceResponse.data.data);
      setNotifications(notificationResponse.data.data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load provider readiness."));
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return null;
  }

  return (
    <section
      aria-labelledby="provider-readiness-heading"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
        <Radio size={18} aria-hidden="true" />
        <span>Integration readiness</span>
      </div>
      <h2 id="provider-readiness-heading" className="mt-2 text-lg font-semibold text-slate-900">
        Provider diagnostics (cutover)
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        Honest provider status for evidence storage and outbound notifications. Staging remains disabled until operator
        credentials are configured — no fake success states.
      </p>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading provider readiness…
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className={`rounded-lg border p-4 ${indicatorTone(evidence?.indicator ?? "DISABLED")}`}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
              <HardDrive size={14} aria-hidden="true" />
              Evidence storage
            </div>
            <p className="mt-2 text-sm font-semibold">{evidence?.indicator ?? "UNKNOWN"}</p>
            <p className="mt-1 text-xs opacity-90">{evidence?.message ?? "No readiness data"}</p>
          </article>
          <article className={`rounded-lg border p-4 ${indicatorTone(notifications?.email.indicator ?? "EMAIL_DISABLED")}`}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
              <Mail size={14} aria-hidden="true" />
              Email
            </div>
            <p className="mt-2 text-sm font-semibold">{notifications?.email.indicator ?? "EMAIL_DISABLED"}</p>
            <p className="mt-1 text-xs opacity-90">{notifications?.email.message ?? "No readiness data"}</p>
          </article>
          <article className={`rounded-lg border p-4 ${indicatorTone(notifications?.sms.indicator ?? "SMS_DISABLED")}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">SMS</p>
            <p className="mt-2 text-sm font-semibold">{notifications?.sms.indicator ?? "SMS_DISABLED"}</p>
            <p className="mt-1 text-xs opacity-90">{notifications?.sms.message ?? "No readiness data"}</p>
          </article>
          <article className={`rounded-lg border p-4 ${indicatorTone(notifications?.push.indicator ?? "PUSH_DISABLED")}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">Push</p>
            <p className="mt-2 text-sm font-semibold">{notifications?.push.indicator ?? "PUSH_DISABLED"}</p>
            <p className="mt-1 text-xs opacity-90">{notifications?.push.message ?? "No readiness data"}</p>
          </article>
        </div>
      )}
    </section>
  );
}
