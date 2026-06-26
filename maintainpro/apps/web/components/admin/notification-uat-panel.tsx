"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  canAccessNotificationUat,
  formatNotificationUatResultSummary,
  NOTIFICATION_UAT_TEMPLATE_OPTIONS,
  notificationUatRecipientPlaceholder,
  type NotificationReadinessSummary,
  type NotificationUatSendResult
} from "@/lib/notification-uat";
import { useCurrentUser } from "@/lib/use-current-user";

type ApiEnvelope<T> = {
  data: T;
  message?: string;
};

export function NotificationUatPanel() {
  const currentUser = useCurrentUser();
  const canManage = canAccessNotificationUat(currentUser?.role);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"email" | "sms" | null>(null);
  const [readiness, setReadiness] = useState<NotificationReadinessSummary | null>(null);
  const [lastResult, setLastResult] = useState<NotificationUatSendResult | null>(null);
  const [recipient, setRecipient] = useState("");
  const [templateKey, setTemplateKey] = useState<string>("critical_facility_issue");

  const loadReadiness = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get<ApiEnvelope<NotificationReadinessSummary>>("/notifications/readiness");
      setReadiness(response.data.data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load notification readiness."));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  if (!canManage) {
    return null;
  }

  const sendTest = async (channel: "email" | "sms") => {
    if (!recipient.trim()) {
      toast.error("Enter an allowlisted recipient before sending a UAT test.");
      return;
    }

    setSubmitting(channel);
    setLastResult(null);

    try {
      const response = await apiClient.post<ApiEnvelope<NotificationUatSendResult>>(
        `/notifications/uat/${channel}-test`,
        {
          recipient: recipient.trim(),
          templateKey
        }
      );
      const result = response.data.data;
      setLastResult(result);
      toast.message(formatNotificationUatResultSummary(result));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Notification UAT test failed."));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section
      aria-labelledby="notification-uat-heading"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <Mail size={18} aria-hidden="true" />
            <span>Notification UAT</span>
          </div>
          <h2 id="notification-uat-heading" className="mt-2 text-lg font-semibold text-slate-900">
            Staged Email/SMS test sends
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Send controlled UAT messages only to allowlisted recipients when UAT flags and provider credentials are
            enabled. No bulk sends. No secrets are shown here.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading notification readiness…
        </div>
      ) : readiness ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{readiness.email.indicator}</p>
              <p className="mt-1 text-xs text-slate-600">{readiness.email.message}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">SMS</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{readiness.sms.indicator}</p>
              <p className="mt-1 text-xs text-slate-600">{readiness.sms.message}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Push</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{readiness.push.indicator}</p>
              <p className="mt-1 text-xs text-slate-600">{readiness.push.message}</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            UAT controls:{" "}
            {readiness.uat.uatEnabled && readiness.uat.realSendsEnabled
              ? `${readiness.uat.allowlistCount} allowlisted recipient(s) — ${readiness.uat.message}`
              : readiness.uat.message}
          </div>
        </>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Allowlisted recipient</span>
          <input
            type="text"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder={notificationUatRecipientPlaceholder("email")}
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Template</span>
          <select
            value={templateKey}
            onChange={(event) => setTemplateKey(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          >
            {NOTIFICATION_UAT_TEMPLATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void sendTest("email")}
          disabled={submitting !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
        >
          {submitting === "email" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send UAT email
        </button>
        <button
          type="button"
          onClick={() => void sendTest("sms")}
          disabled={submitting !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-70"
        >
          {submitting === "sms" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <MessageSquare size={14} aria-hidden="true" />
          )}
          Send UAT SMS
        </button>
      </div>

      {lastResult ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700" role="status">
          <p className="font-semibold text-slate-900">{formatNotificationUatResultSummary(lastResult)}</p>
          <p className="mt-1">Recipient: {lastResult.recipientMasked}</p>
          <p className="mt-1">Provider: {lastResult.provider}</p>
          {lastResult.messageId ? <p className="mt-1">Message ID: {lastResult.messageId}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
