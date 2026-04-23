"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Clock3,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  TriangleAlert,
  WandSparkles
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { apiClient } from "@/lib/api-client";

type FocusArea = "GENERAL" | "MAINTENANCE" | "FLEET" | "CLEANING" | "INVENTORY" | "UTILITIES";
type CopilotMode = "CHAT" | "ANALYZE" | "PREDICT" | "RECOMMEND";
type SuggestedActionType =
  | "CREATE_WORK_ORDER"
  | "SCHEDULE_MAINTENANCE"
  | "ASSIGN_TECHNICIAN"
  | "GENERATE_REPORT";

type ApiEnvelope<T> = {
  data: T;
  message?: string;
};

type CopilotActionSuggestion = {
  id: string;
  type: SuggestedActionType;
  label: string;
  description: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  disabledReason?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  actions: CopilotActionSuggestion[];
};

type ConversationListItem = {
  id: string;
  title: string;
  focusArea: string;
  mode: string;
  providerConversationId: string | null;
  lastMessageAt: string;
  createdAt: string;
  preview: string;
  lastRole: string | null;
  lastMessageCreatedAt: string | null;
};

type StoredConversationMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  focusArea: string;
  mode: string;
  actions: unknown;
};

type ConversationDetail = {
  id: string;
  title: string;
  focusArea: string;
  mode: string;
  providerConversationId: string | null;
  lastMessageAt: string;
  createdAt: string;
  messages: StoredConversationMessage[];
};

type CopilotContextSnapshot = {
  generatedAt: string;
  roleScope: string;
  focusArea: FocusArea;
  mode: CopilotMode;
  summary: {
    activeWorkOrders: number;
    overdueTasks: number;
    assignedToMe: number;
    fleetOutOfService: number;
    utilityAnomalies: number;
    lowStockItems: number;
  };
  maintenance: {
    overdueWorkOrders: Array<{
      id: string;
      woNumber: string;
      title: string;
      priority: string;
      dueDate: string | null;
    }>;
  };
  fleet: {
    fuelAnomalies: Array<{
      vehicleId: string;
      registrationNo: string;
      variancePercent: number;
    }>;
    overdueServiceVehicles: Array<{
      id: string;
      registrationNo: string;
      nextServiceDate: string | null;
    }>;
  };
  utilities: {
    overdueBills: number;
    anomalies: Array<{
      meterId: string;
      meterNumber: string;
      location: string;
      variancePercent: number;
    }>;
  };
  inventory: {
    lowStockParts: Array<{
      id: string;
      partNumber: string;
      name: string;
      quantityInStock: number;
      reorderPoint: number;
    }>;
    projectedStockouts: Array<{
      partId: string;
      partNumber: string;
      name: string;
      projectedDaysLeft: number;
    }>;
  };
  smartSuggestions: string[];
};

type CopilotChatResult = {
  conversation?: {
    id: string;
    title: string;
    focusArea: string;
    mode: string;
    providerConversationId: string | null;
    lastMessageAt: string;
    createdAt: string;
  } | null;
  context?: CopilotContextSnapshot;
  response?: {
    conversationId: string | null;
    providerConversationId: string | null;
    text: string;
    markdown: boolean;
    source: string;
    suggestedActions: unknown;
    suggestedPrompts: string[];
    generatedAt: string;
    raw: unknown;
  };
  exchange?: {
    userMessage?: {
      id: string;
      createdAt: string;
    } | null;
    assistantMessage?: {
      id: string;
      createdAt: string;
    } | null;
  };
};

type CopilotLogRow = {
  id: string;
  query: string;
  response: string;
  focusArea: string;
  mode: string;
  source: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  conversation: {
    id: string;
    title: string;
  } | null;
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

type ActionComposerState = {
  messageId: string;
  action: CopilotActionSuggestion;
  payloadText: string;
};

const focusAreaOptions: Array<{ value: FocusArea; label: string; subtitle: string }> = [
  { value: "GENERAL", label: "General", subtitle: "Cross-module operations" },
  { value: "MAINTENANCE", label: "Maintenance", subtitle: "Reliability and work orders" },
  { value: "FLEET", label: "Fleet", subtitle: "Vehicles and fuel behavior" },
  { value: "CLEANING", label: "Cleaning", subtitle: "Compliance and site quality" },
  { value: "INVENTORY", label: "Inventory", subtitle: "Stock health and reorders" },
  { value: "UTILITIES", label: "Utilities", subtitle: "Consumption and anomaly control" }
];

const modeOptions: Array<{ value: CopilotMode; label: string; description: string }> = [
  { value: "CHAT", label: "Chat", description: "Fast operational Q&A" },
  { value: "ANALYZE", label: "Analyze", description: "Root-cause and trend analysis" },
  { value: "PREDICT", label: "Predict", description: "Near-term risk projection" },
  { value: "RECOMMEND", label: "Recommend", description: "Action plans with ownership" }
];

const starterPrompts: Record<FocusArea, string[]> = {
  GENERAL: [
    "Summarize the top operational risks for today and the immediate owner for each.",
    "Give me a cross-team action plan to reduce response time on urgent incidents.",
    "Which KPI movements should I monitor in the next 24 hours?"
  ],
  MAINTENANCE: [
    "Prioritize overdue preventive maintenance work orders and explain why.",
    "What failure patterns suggest an asset needs a preventive strategy change?",
    "Build a practical checklist for shift handover in the maintenance team."
  ],
  FLEET: [
    "Show me a practical response playbook for a live vehicle breakdown.",
    "Identify likely causes of fuel anomalies and immediate validation steps.",
    "How should dispatch adapt when multiple vehicles are near service due dates?"
  ],
  CLEANING: [
    "Recommend follow-up actions for repeated cleaning sign-off failures.",
    "How should supervisors prioritize unresolved facility issues this week?",
    "Suggest a compliance workflow for missed QR cleaning scans."
  ],
  INVENTORY: [
    "Highlight parts with stockout risk in the next 3 weeks and propose mitigations.",
    "Suggest reorder priorities aligned with active overdue work orders.",
    "How can I reduce emergency part purchases without risking downtime?"
  ],
  UTILITIES: [
    "Investigate utility anomalies and suggest the first validation checks.",
    "Build a cost-control action plan for utility spikes this month.",
    "Which meters should be escalated today based on latest billing variance?"
  ]
};

const actionEndpoints: Record<SuggestedActionType, string> = {
  CREATE_WORK_ORDER: "/predictive-ai/actions/create-work-order",
  SCHEDULE_MAINTENANCE: "/predictive-ai/actions/schedule-maintenance",
  ASSIGN_TECHNICIAN: "/predictive-ai/actions/assign-technician",
  GENERATE_REPORT: "/predictive-ai/actions/generate-report"
};

const riskStyles: Record<PredictiveLogRow["riskLevel"], string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800"
};

const welcomeMessage: ChatMessage = {
  id: "assistant-welcome",
  role: "assistant",
  content: [
    "### MaintainPro AI Copilot",
    "I can analyze live operational context across maintenance, fleet, cleaning, inventory, and utilities.",
    "",
    "Use the controls above to switch between **Chat**, **Analyze**, **Predict**, and **Recommend** modes.",
    "When responses include actions, use the action buttons to execute workflows directly."
  ].join("\n"),
  actions: []
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeFocusArea(value: unknown): FocusArea | null {
  const candidate = asString(value)?.toUpperCase();
  if (!candidate) {
    return null;
  }

  return focusAreaOptions.some((option) => option.value === candidate)
    ? (candidate as FocusArea)
    : null;
}

function normalizeMode(value: unknown): CopilotMode | null {
  const candidate = asString(value)?.toUpperCase();
  if (!candidate) {
    return null;
  }

  return modeOptions.some((option) => option.value === candidate)
    ? (candidate as CopilotMode)
    : null;
}

function extractErrorMessage(error: unknown, fallback: string) {
  const candidate = error as { response?: { data?: { message?: string } } };
  return candidate?.response?.data?.message ?? fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function trimText(value: string, maxLength = 140) {
  const normalized = value.trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function compactJson(value: unknown, maxLength = 1_400) {
  const serialized = JSON.stringify(value, null, 2) ?? "{}";
  return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}\n...` : serialized;
}

function normalizeActions(rawActions: unknown): CopilotActionSuggestion[] {
  if (!Array.isArray(rawActions)) {
    return [];
  }

  const normalized: CopilotActionSuggestion[] = [];

  for (const entry of rawActions) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const action = entry as Record<string, unknown>;
    const type = asString(action.type)?.toUpperCase() as SuggestedActionType | undefined;

    if (!type || !(type in actionEndpoints)) {
      continue;
    }

    const label = asString(action.label) ?? type.replaceAll("_", " ");
    const description = asString(action.description) ?? "Execute this assistant action.";
    const payload =
      action.payload && typeof action.payload === "object"
        ? (action.payload as Record<string, unknown>)
        : {};

    normalized.push({
      id: asString(action.id) ?? createId("action"),
      type,
      label,
      description,
      payload,
      enabled: typeof action.enabled === "boolean" ? action.enabled : true,
      disabledReason: asString(action.disabledReason) ?? undefined
    });
  }

  return normalized;
}

function mapStoredMessage(message: StoredConversationMessage): ChatMessage {
  const normalizedRole = asString(message.role)?.toLowerCase() === "assistant" ? "assistant" : "user";

  return {
    id: message.id,
    role: normalizedRole,
    content: message.content,
    createdAt: message.createdAt,
    actions: normalizeActions(message.actions)
  };
}

export default function PredictiveAiPage() {
  const [focusArea, setFocusArea] = useState<FocusArea>("GENERAL");
  const [mode, setMode] = useState<CopilotMode>("CHAT");
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [conversationFilter, setConversationFilter] = useState("");
  const [sessionSuggestions, setSessionSuggestions] = useState<string[]>([]);

  const [context, setContext] = useState<CopilotContextSnapshot | null>(null);
  const [copilotLogs, setCopilotLogs] = useState<CopilotLogRow[]>([]);
  const [predictiveLogs, setPredictiveLogs] = useState<PredictiveLogRow[]>([]);

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [openingConversationId, setOpeningConversationId] = useState<string | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingPredictiveLogs, setLoadingPredictiveLogs] = useState(true);
  const [sending, setSending] = useState(false);
  const [executingAction, setExecutingAction] = useState(false);

  const [conversationError, setConversationError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [predictiveLogsError, setPredictiveLogsError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const [actionComposer, setActionComposer] = useState<ActionComposerState | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const currentFocus = useMemo(
    () => focusAreaOptions.find((option) => option.value === focusArea),
    [focusArea]
  );

  const suggestionChips = useMemo(() => {
    if (sessionSuggestions.length > 0) {
      return sessionSuggestions.slice(0, 8);
    }

    if (context?.smartSuggestions?.length) {
      return context.smartSuggestions.slice(0, 8);
    }

    return starterPrompts[focusArea];
  }, [context, focusArea, sessionSuggestions]);

  const filteredConversations = useMemo(() => {
    const query = conversationFilter.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const searchable = `${conversation.title} ${conversation.preview}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [conversationFilter, conversations]);

  const summaryCards = useMemo(() => {
    if (!context) {
      return [];
    }

    return [
      { label: "Active Work Orders", value: context.summary.activeWorkOrders },
      { label: "Overdue Tasks", value: context.summary.overdueTasks },
      { label: "Fleet Out Of Service", value: context.summary.fleetOutOfService },
      { label: "Utility Anomalies", value: context.summary.utilityAnomalies },
      { label: "Low Stock Items", value: context.summary.lowStockItems },
      { label: "Assigned To Me", value: context.summary.assignedToMe }
    ];
  }, [context]);

  useEffect(() => {
    void loadConversations();
    void loadPredictiveLogs();
  }, []);

  useEffect(() => {
    let active = true;

    setLoadingContext(true);
    setContextError(null);
    apiClient
      .get<ApiEnvelope<CopilotContextSnapshot>>("/predictive-ai/context", {
        params: {
          focusArea,
          mode
        }
      })
      .then((response) => {
        if (!active) {
          return;
        }

        setContext(response.data?.data ?? null);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setContextError(extractErrorMessage(error, "Unable to load assistant context."));
      })
      .finally(() => {
        if (active) {
          setLoadingContext(false);
        }
      });

    setLoadingLogs(true);
    setLogsError(null);
    apiClient
      .get<ApiEnvelope<CopilotLogRow[]>>("/predictive-ai/logs", {
        params: {
          focusArea,
          mode,
          limit: "8"
        }
      })
      .then((response) => {
        if (!active) {
          return;
        }

        setCopilotLogs(response.data?.data ?? []);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setLogsError(
          extractErrorMessage(error, "Conversation logs are unavailable for your current role.")
        );
        setCopilotLogs([]);
      })
      .finally(() => {
        if (active) {
          setLoadingLogs(false);
        }
      });

    return () => {
      active = false;
    };
  }, [focusArea, mode, refreshTick]);

  async function loadConversations(preferredConversationId?: string | null) {
    setLoadingConversations(true);
    setConversationError(null);

    try {
      const response = await apiClient.get<ApiEnvelope<ConversationListItem[]>>(
        "/predictive-ai/conversations",
        {
          params: {
            limit: "40"
          }
        }
      );

      const items = response.data?.data ?? [];
      setConversations(items);

      if (preferredConversationId) {
        const exists = items.some((item) => item.id === preferredConversationId);
        if (exists) {
          setConversationId(preferredConversationId);
        }
      }
    } catch (error: unknown) {
      setConversationError(
        extractErrorMessage(error, "Unable to load conversation memory for this account.")
      );
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }

  async function loadPredictiveLogs() {
    setLoadingPredictiveLogs(true);
    setPredictiveLogsError(null);

    try {
      const response = await apiClient.get<ApiEnvelope<PredictiveLogRow[]>>(
        "/predictive-ai/predictive-logs"
      );

      setPredictiveLogs((response.data?.data ?? []).slice(0, 6));
    } catch (error: unknown) {
      setPredictiveLogsError(
        extractErrorMessage(error, "Predictive maintenance signals are unavailable for this role.")
      );
      setPredictiveLogs([]);
    } finally {
      setLoadingPredictiveLogs(false);
    }
  }

  async function openConversation(targetConversationId: string) {
    setOpeningConversationId(targetConversationId);
    setChatError(null);

    try {
      const response = await apiClient.get<ApiEnvelope<ConversationDetail>>(
        `/predictive-ai/conversations/${targetConversationId}`,
        {
          params: {
            limit: "300"
          }
        }
      );

      const conversation = response.data?.data;
      if (!conversation) {
        toast.error("Conversation data was empty.");
        return;
      }

      setConversationId(conversation.id);
      setMessages(
        conversation.messages.length > 0
          ? conversation.messages.map((message) => mapStoredMessage(message))
          : [welcomeMessage]
      );
      setActionComposer(null);
      setSessionSuggestions([]);

      const nextFocusArea = normalizeFocusArea(conversation.focusArea);
      const nextMode = normalizeMode(conversation.mode);

      if (nextFocusArea) {
        setFocusArea(nextFocusArea);
      }

      if (nextMode) {
        setMode(nextMode);
      }
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, "Failed to open conversation."));
    } finally {
      setOpeningConversationId(null);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([welcomeMessage]);
    setActionComposer(null);
    setChatError(null);
    setSessionSuggestions([]);
  }

  async function sendMessage(rawMessage?: string) {
    const message = (rawMessage ?? draft).trim();
    if (!message || sending) {
      return;
    }

    const optimisticUserMessage: ChatMessage = {
      id: createId("user"),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
      actions: []
    };

    setMessages((current) => [...current, optimisticUserMessage]);
    setDraft("");
    setSending(true);
    setChatError(null);

    try {
      const response = await apiClient.post<ApiEnvelope<CopilotChatResult>>(
        "/predictive-ai/copilot",
        {
          message,
          conversationId,
          focusArea,
          mode,
          markdown: true
        }
      );

      const payload = response.data?.data;
      const assistantText =
        asString(payload?.response?.text) ??
        "The assistant returned an empty response. Please refine your request.";

      const assistantMessage: ChatMessage = {
        id: asString(payload?.exchange?.assistantMessage?.id) ?? createId("assistant"),
        role: "assistant",
        content: assistantText,
        createdAt:
          asString(payload?.exchange?.assistantMessage?.createdAt) ??
          asString(payload?.response?.generatedAt) ??
          new Date().toISOString(),
        actions: normalizeActions(payload?.response?.suggestedActions)
      };

      setMessages((current) => [...current, assistantMessage]);

      const nextConversationId =
        asString(payload?.conversation?.id) ??
        asString(payload?.response?.conversationId) ??
        conversationId;

      if (nextConversationId) {
        setConversationId(nextConversationId);
      }

      if (payload?.context) {
        setContext(payload.context);
      }

      if (Array.isArray(payload?.response?.suggestedPrompts)) {
        setSessionSuggestions(
          payload.response.suggestedPrompts.filter((item): item is string => typeof item === "string")
        );
      }

      setRefreshTick((current) => current + 1);
      await loadConversations(nextConversationId ?? undefined);
    } catch (error: unknown) {
      const messageText = extractErrorMessage(error, "Failed to contact the AI assistant.");
      setChatError(messageText);
      toast.error(messageText);
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage();
  }

  function openActionComposer(messageId: string, action: CopilotActionSuggestion) {
    if (!action.enabled) {
      toast.error(action.disabledReason ?? "This action is currently unavailable.");
      return;
    }

    setActionComposer({
      messageId,
      action,
      payloadText: JSON.stringify(action.payload, null, 2)
    });
  }

  async function executeAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!actionComposer || executingAction) {
      return;
    }

    let parsedPayload: Record<string, unknown>;
    try {
      const candidate = JSON.parse(actionComposer.payloadText) as unknown;
      parsedPayload =
        candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
    } catch {
      toast.error("Action payload must be valid JSON.");
      return;
    }

    const endpoint = actionEndpoints[actionComposer.action.type];

    setExecutingAction(true);
    try {
      const response = await apiClient.post<ApiEnvelope<unknown>>(endpoint, parsedPayload);
      const resultPayload = response.data?.data;

      setMessages((current) => [
        ...current,
        {
          id: createId("assistant"),
          role: "assistant",
          createdAt: new Date().toISOString(),
          content: [
            `### Action completed: ${actionComposer.action.label}`,
            "",
            "```json",
            compactJson(resultPayload),
            "```"
          ].join("\n"),
          actions: []
        }
      ]);

      setActionComposer(null);
      setRefreshTick((current) => current + 1);
      void loadPredictiveLogs();
      void loadConversations(conversationId);
      toast.success(`${actionComposer.action.label} executed successfully.`);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, `Failed to execute ${actionComposer.action.label}.`));
    } finally {
      setExecutingAction(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50/40 px-6 py-5 shadow-sm">
        <div className="absolute -right-20 -top-16 h-44 w-44 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">
              MaintainPro AI Copilot
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Production Operations Command</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              Context-aware Copilot with multi-mode analysis, conversation memory, and direct
              action execution for maintenance, fleet, utilities, cleaning, and inventory.
            </p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current Session</p>
            <p className="font-semibold text-slate-900">{conversationId ?? "New conversation"}</p>
            <p className="text-xs text-slate-500">
              {currentFocus?.label} • {modeOptions.find((item) => item.value === mode)?.label}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <aside className="space-y-4 xl:col-span-3 2xl:col-span-2">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Conversation Memory</h2>
                <p className="text-xs text-slate-500">Recent copilot sessions</p>
              </div>
              <button
                type="button"
                onClick={startNewConversation}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                New
              </button>
            </div>

            <div className="space-y-3 p-4">
              <input
                value={conversationFilter}
                onChange={(event) => setConversationFilter(event.target.value)}
                placeholder="Filter conversations"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />

              <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                {loadingConversations ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading conversations...
                  </div>
                ) : conversationError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                    {conversationError}
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                    No conversation history yet.
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const isActive = conversation.id === conversationId;
                    const isOpening = openingConversationId === conversation.id;

                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => void openConversation(conversation.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          isActive
                            ? "border-brand-300 bg-brand-50"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-900">{conversation.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{trimText(conversation.preview || "No preview yet.", 90)}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                          {isOpening ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Opening...
                            </>
                          ) : (
                            <>
                              <Clock3 className="h-3 w-3" />
                              {formatDateTime(conversation.lastMessageAt)}
                            </>
                          )}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Focus Area</p>
            <div className="mt-3 space-y-2">
              {focusAreaOptions.map((option) => {
                const isActive = option.value === focusArea;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setFocusArea(option.value);
                      setSessionSuggestions([]);
                    }}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      isActive
                        ? "border-brand-300 bg-brand-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900">{option.label}</p>
                    <p className="text-xs text-slate-500">{option.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="space-y-4 xl:col-span-6 2xl:col-span-7">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Copilot Workspace</p>
                  <p className="text-xs text-slate-500">{currentFocus?.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {modeOptions.map((option) => {
                    const isActive = option.value === mode;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMode(option.value)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                          isActive
                            ? "border-brand-300 bg-brand-50 text-brand-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                        title={option.description}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              {chatError ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <TriangleAlert className="mt-0.5 h-4 w-4" />
                  <span>{chatError}</span>
                </div>
              ) : null}

              <div className="max-h-[31rem] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[94%] rounded-2xl px-4 py-3 shadow-sm ${
                      message.role === "assistant"
                        ? "border border-slate-200 bg-white text-slate-700"
                        : "ml-auto bg-brand-600 text-white"
                    }`}
                  >
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
                      {message.role === "assistant" ? <Bot className="h-3 w-3" /> : null}
                      {message.role === "assistant" ? "Copilot" : "You"}
                    </p>

                    {message.role === "assistant" ? (
                      <div className="space-y-3 text-sm leading-6 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-slate-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                    )}

                    {message.actions.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                        {message.actions.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => openActionComposer(message.id, action)}
                            disabled={!action.enabled}
                            title={action.disabledReason}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}

                {sending ? (
                  <div className="max-w-[94%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Copilot is analyzing live context...
                    </div>
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={4}
                  placeholder="Ask about incidents, trends, predictions, or optimization actions..."
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Mode: {modeOptions.find((option) => option.value === mode)?.description}
                  </p>
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Ask Copilot"}
                  </button>
                </div>
              </form>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  Smart Suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestionChips.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendMessage(suggestion)}
                      disabled={sending}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside className="space-y-4 xl:col-span-3">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Activity className="h-4 w-4 text-brand-600" />
              Live Context Snapshot
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Focused on {currentFocus?.label} in {mode.toLowerCase()} mode.
            </p>

            <div className="mt-3 space-y-3">
              {loadingContext ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading context...
                </div>
              ) : contextError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                  {contextError}
                </div>
              ) : !context ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  No context snapshot available.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {summaryCards.map((card) => (
                      <article key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{card.value}</p>
                      </article>
                    ))}
                  </div>

                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Priority Signals
                    </p>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {context.maintenance.overdueWorkOrders.slice(0, 2).map((item) => (
                        <li key={item.id}>
                          WO {item.woNumber}: {item.title}
                        </li>
                      ))}
                      {context.inventory.projectedStockouts.slice(0, 2).map((item) => (
                        <li key={item.partId}>
                          {item.partNumber} stockout in ~{item.projectedDaysLeft.toFixed(1)} days
                        </li>
                      ))}
                      {context.fleet.fuelAnomalies.slice(0, 1).map((item) => (
                        <li key={item.vehicleId}>
                          {item.registrationNo} fuel variance {item.variancePercent.toFixed(1)}%
                        </li>
                      ))}
                      {context.utilities.anomalies.slice(0, 1).map((item) => (
                        <li key={item.meterId}>
                          Meter {item.meterNumber} variance {item.variancePercent.toFixed(1)}%
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <WandSparkles className="h-4 w-4 text-brand-600" />
              Action Composer
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Trigger workflow actions from assistant recommendations.
            </p>

            {actionComposer ? (
              <form onSubmit={executeAction} className="mt-3 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-900">{actionComposer.action.label}</p>
                  <p className="mt-1 text-xs text-slate-600">{actionComposer.action.description}</p>
                </div>

                <textarea
                  value={actionComposer.payloadText}
                  onChange={(event) =>
                    setActionComposer((current) =>
                      current
                        ? {
                            ...current,
                            payloadText: event.target.value
                          }
                        : current
                    )
                  }
                  rows={10}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={executingAction}
                    className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {executingAction ? "Executing..." : "Run action"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionComposer(null)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                Select an action from an assistant response to open the JSON payload editor.
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Filtered Copilot Logs</p>
            <p className="mt-1 text-xs text-slate-500">
              {focusArea} • {mode} • latest 8 events
            </p>

            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {loadingLogs ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading logs...
                </div>
              ) : logsError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                  {logsError}
                </div>
              ) : copilotLogs.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  No copilot logs found for this filter.
                </div>
              ) : (
                copilotLogs.map((log) => (
                  <article key={log.id} className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-xs font-medium text-slate-900">{trimText(log.query, 72)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{trimText(log.response, 90)}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(log.timestamp)}</p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Predictive Signals</p>
            <p className="mt-1 text-xs text-slate-500">Latest backend predictive maintenance outputs</p>

            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {loadingPredictiveLogs ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading predictive signals...
                </div>
              ) : predictiveLogsError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                  {predictiveLogsError}
                </div>
              ) : predictiveLogs.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  No predictive logs are available yet.
                </div>
              ) : (
                predictiveLogs.map((log) => (
                  <article key={log.id} className="rounded-xl border border-slate-200 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-slate-900">{trimText(log.prediction, 72)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskStyles[log.riskLevel]}`}>
                        {log.riskLevel}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{trimText(log.suggestedAction, 90)}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(log.analyzedAt)}</p>
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
