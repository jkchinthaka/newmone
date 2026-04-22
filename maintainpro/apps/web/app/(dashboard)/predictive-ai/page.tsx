"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiClient } from "@/lib/api-client";

type FocusArea = "GENERAL" | "MAINTENANCE" | "FLEET" | "CLEANING" | "INVENTORY" | "UTILITIES";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type PredictiveLogRow = {
  id: string;
  prediction: string;
  suggestedAction: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  analyzedAt: string;
  asset?: {
    name?: string | null;
    assetTag?: string | null;
  } | null;
};

const focusAreaOptions: Array<{ value: FocusArea; label: string }> = [
  { value: "GENERAL", label: "General operations" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "FLEET", label: "Fleet" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "INVENTORY", label: "Inventory" },
  { value: "UTILITIES", label: "Utilities" }
];

const starterPrompts: Record<FocusArea, string[]> = {
  GENERAL: [
    "Summarize the top operational risks I should review this morning.",
    "What KPIs should an operations manager watch in MaintainPro this week?",
    "Give me a practical checklist for reducing cross-team response delays."
  ],
  MAINTENANCE: [
    "How should I prioritize overdue preventive maintenance work orders?",
    "Suggest a downtime reduction plan for frequently failing vehicles.",
    "What information should a mechanic capture after an urgent repair?"
  ],
  FLEET: [
    "Give me a dispatch playbook for handling a live vehicle breakdown.",
    "How can I improve fleet availability without increasing overtime?",
    "What should I check first when a driver reports a route delay?"
  ],
  CLEANING: [
    "Suggest a supervisor follow-up process for missed QR scans.",
    "How should I investigate repeated cleaning sign-off rejections?",
    "Give me a quick SOP for responding to a critical facility issue."
  ],
  INVENTORY: [
    "How do I identify spare parts that are likely to stock out next?",
    "Suggest reorder rules for slow-moving but critical inventory.",
    "What should be on a weekly storeroom accuracy review?"
  ],
  UTILITIES: [
    "How should I investigate an unexpected spike in utility consumption?",
    "Suggest a response plan for a utility outage affecting operations.",
    "What cost-control measures should I review for utilities this month?"
  ]
};

const riskStyles: Record<PredictiveLogRow["riskLevel"], string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800"
};

export default function PredictiveAiPage() {
  const [focusArea, setFocusArea] = useState<FocusArea>("GENERAL");
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Ask about maintenance planning, fleet coordination, cleaning compliance, inventory risk, or utility anomalies. The assistant runs through the MaintainPro backend so your RapidAPI key stays server-side."
    }
  ]);
  const [logs, setLogs] = useState<PredictiveLogRow[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;

    apiClient
      .get("/predictive-ai/logs")
      .then((res) => {
        if (!mounted) {
          return;
        }
        const rows = (res.data?.data ?? res.data ?? []) as PredictiveLogRow[];
        setLogs(rows.slice(0, 5));
        setLogsError(null);
      })
      .catch((err: { response?: { data?: { message?: string } } }) => {
        if (!mounted) {
          return;
        }
        setLogsError(err?.response?.data?.message ?? "Predictive logs are unavailable for your role.");
      })
      .finally(() => {
        if (mounted) {
          setLoadingLogs(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const suggestions = useMemo(() => starterPrompts[focusArea], [focusArea]);

  async function sendMessage(rawMessage?: string) {
    const message = (rawMessage ?? draft).trim();
    if (!message || sending) {
      return;
    }

    const nextUserMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: message
    };

    setMessages((current) => [...current, nextUserMessage]);
    setDraft("");
    setSending(true);
    setChatError(null);

    try {
      const res = await apiClient.post("/predictive-ai/copilot", {
        message,
        conversationId,
        focusArea,
        mode: "CHAT",
        markdown: true
      });

      const data = res.data?.data ?? {};
      const reply =
        data?.response?.text ??
        data?.text ??
        "The assistant returned an empty response. Try refining the request.";

      setConversationId(data?.response?.conversationId ?? conversationId);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: String(reply)
        }
      ]);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setChatError(error?.response?.data?.message ?? "Failed to contact the AI assistant.");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">
            Predictive AI
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">MaintainPro AI Assistant</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Use the in-app assistant for operational guidance without exposing the RapidAPI key in
            the browser. Focus the chat on maintenance, fleet, cleaning, inventory, or utilities.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Conversation</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {conversationId ?? "New session"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Operations chat</h2>
                <p className="text-sm text-slate-500">
                  Responses come through the backend `predictive-ai/copilot` proxy.
                </p>
              </div>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Focus area
                <select
                  value={focusArea}
                  onChange={(event) => setFocusArea(event.target.value as FocusArea)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"
                >
                  {focusAreaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            {chatError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {chatError}
              </div>
            ) : null}

            <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    message.role === "assistant"
                      ? "border border-slate-200 bg-white text-slate-700"
                      : "ml-auto bg-brand-600 text-white"
                  }`}
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">
                    {message.role === "assistant" ? "Assistant" : "You"}
                  </p>
                  <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                </div>
              ))}

              {sending ? (
                <div className="max-w-[92%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                  Working on a response...
                </div>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={5}
                placeholder="Ask for help with an overdue maintenance queue, a fleet incident response, a cleaning compliance issue, or another operations question..."
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  The assistant keeps the conversation id so follow-up questions stay in the same
                  thread when the upstream service supports it.
                </p>
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Ask assistant"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Suggested prompts</h2>
            <p className="mt-1 text-sm text-slate-500">
              Start from one of these prompts and refine the answer with follow-up questions.
            </p>
            <div className="mt-4 space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void sendMessage(suggestion)}
                  disabled={sending}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Recent predictive logs</h2>
            <p className="mt-1 text-sm text-slate-500">
              Existing predictive maintenance output from the backend module.
            </p>

            <div className="mt-4 space-y-3">
              {loadingLogs ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Loading predictive logs...
                </div>
              ) : logsError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  {logsError}
                </div>
              ) : logs.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No predictive logs are available yet.
                </div>
              ) : (
                logs.map((log) => (
                  <article key={log.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{log.prediction}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {log.asset?.name ?? "Unassigned asset"}
                          {log.asset?.assetTag ? ` • ${log.asset.assetTag}` : ""}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${riskStyles[log.riskLevel]}`}>
                        {log.riskLevel}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{log.suggestedAction}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      {new Date(log.analyzedAt).toLocaleString()}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}