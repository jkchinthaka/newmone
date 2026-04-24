"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CreditCard, Loader2, Receipt, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api-client";

type ApiEnvelope<T> = {
  data: T;
};

type TenantContext = {
  activeTenant?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type SubscriptionPayload = {
  id: string;
  status: string;
  billingInterval: "MONTHLY" | "YEARLY";
  seats: number;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    priceMonthly: string;
    priceYearly: string;
    entitlements: Array<{
      key: string;
      type: string;
      enabled: boolean;
      limitValue: number | null;
      unit: string | null;
    }>;
  };
} | null;

type UsagePayload = {
  usage: Array<{
    key: string;
    used: number;
    limit: number | null;
    remaining: number | null;
    percent: number | null;
    unit: string | null;
  }>;
  recentInvoices: Array<{
    id: string;
    stripeInvoiceId: string;
    amountDue: string;
    amountPaid: string;
    currency: string;
    status: string;
    createdAt: string;
    hostedInvoiceUrl?: string | null;
  }>;
};

type CheckoutResponse = {
  mode: "mock" | "live";
  checkoutUrl: string | null;
  sessionId: string | null;
};

const planCatalog = [
  {
    code: "STARTER",
    name: "Starter",
    monthlyPrice: "$29",
    yearlyPrice: "$290",
    description: "For early-stage operations teams"
  },
  {
    code: "GROWTH",
    name: "Growth",
    monthlyPrice: "$99",
    yearlyPrice: "$990",
    description: "For scaling maintenance and fleet ops"
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    monthlyPrice: "$299",
    yearlyPrice: "$2,990",
    description: "For multi-site organizations with heavy usage"
  }
] as const;

function formatMetricKey(key: string) {
  return key
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const candidate = error as {
      response?: {
        data?: {
          message?: string | string[];
        };
      };
      message?: string;
    };

    const message = candidate.response?.data?.message;
    if (Array.isArray(message) && message.length > 0) {
      return String(message[0]);
    }
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    if (typeof candidate.message === "string" && candidate.message.trim().length > 0) {
      return candidate.message;
    }
  }

  return fallback;
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");

  const tenantContextQuery = useQuery({
    queryKey: ["billing", "tenant-context"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<TenantContext>>("/tenants/me");
      return response.data.data;
    }
  });

  const subscriptionQuery = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<SubscriptionPayload>>(
        "/billing/subscription"
      );
      return response.data.data;
    }
  });

  const usageQuery = useQuery({
    queryKey: ["billing", "usage"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<UsagePayload>>("/billing/usage");
      return response.data.data;
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: async (payload: { planCode: string; billingInterval: "MONTHLY" | "YEARLY" }) => {
      const response = await apiClient.post<ApiEnvelope<CheckoutResponse>>(
        "/billing/checkout-session",
        payload
      );
      return response.data.data;
    },
    onSuccess: (payload) => {
      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      if (payload.mode === "mock") {
        toast.success("Plan updated in mock mode");
        queryClient.invalidateQueries({ queryKey: ["billing"] });
        return;
      }

      toast.info("Checkout session created");
    },
    onError: (error: unknown) => {
      toast.error(toErrorMessage(error, "Failed to create checkout session"));
    }
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: {
      tenantId: string;
      email: string;
      firstName?: string;
      lastName?: string;
    }) => {
      return apiClient.post(`/tenants/${payload.tenantId}/invitations`, {
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        membershipRole: "MEMBER"
      });
    },
    onSuccess: () => {
      toast.success("Invitation created");
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
    },
    onError: (error: unknown) => {
      toast.error(toErrorMessage(error, "Failed to create invitation"));
    }
  });

  const currentPlanCode = subscriptionQuery.data?.plan.code ?? null;

  const usageRows = useMemo(() => usageQuery.data?.usage ?? [], [usageQuery.data]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-[#09203f] via-[#13315a] to-[#1a4a7a] p-6 text-white shadow-[0_24px_70px_rgba(9,32,63,0.3)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">Phase 1 SaaS Billing</p>
            <h1 className="mt-3 text-3xl font-semibold">Organization Billing & Usage Command Center</h1>
            <p className="mt-3 max-w-2xl text-sm text-sky-100/90">
              Control plan upgrades, track entitlement usage, and manage tenant invitations from one workspace.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
            <p className="font-medium text-sky-100">Active Organization</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {tenantContextQuery.data?.activeTenant?.name ?? "No tenant selected"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {planCatalog.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          return (
            <article
              key={plan.code}
              className={`rounded-2xl border p-5 shadow-sm transition ${
                isCurrent
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
                {isCurrent ? (
                  <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">Current</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
              <div className="mt-4 space-y-1 text-sm text-slate-700">
                <p>Monthly: {plan.monthlyPrice}</p>
                <p>Yearly: {plan.yearlyPrice}</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    checkoutMutation.mutate({
                      planCode: plan.code,
                      billingInterval: "MONTHLY"
                    })
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? "Working..." : "Choose Monthly"}
                </button>
                <button
                  onClick={() =>
                    checkoutMutation.mutate({
                      planCode: plan.code,
                      billingInterval: "YEARLY"
                    })
                  }
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? "Working..." : "Choose Yearly"}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">Entitlement Usage</h3>
          </div>

          <div className="mt-4 space-y-3">
            {usageQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading usage metrics...</p>
            ) : usageRows.length === 0 ? (
              <p className="text-sm text-slate-500">No tracked usage metrics yet.</p>
            ) : (
              usageRows.map((row) => {
                const percent = row.percent ?? 0;
                return (
                  <div key={row.key} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-medium text-slate-800">{formatMetricKey(row.key)}</p>
                      <p className="text-slate-500">
                        {row.used}
                        {typeof row.limit === "number" ? ` / ${row.limit}` : ""}
                        {row.unit ? ` ${row.unit}` : ""}
                      </p>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-indigo-600"
                        style={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-900">Invite Team Members</h3>
          </div>
          <p className="text-sm text-slate-500">
            Invite users to the active organization. Seats are validated against the plan entitlement.
          </p>

          <label className="block text-sm text-slate-600">
            Email
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              type="email"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="user@company.com"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={inviteFirstName}
              onChange={(event) => setInviteFirstName(event.target.value)}
              type="text"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="First name"
            />
            <input
              value={inviteLastName}
              onChange={(event) => setInviteLastName(event.target.value)}
              type="text"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Last name"
            />
          </div>

          <button
            onClick={() => {
              const tenantId = tenantContextQuery.data?.activeTenant?.id;

              if (!tenantId) {
                toast.error("Select an active tenant before inviting users");
                return;
              }

              inviteMutation.mutate({
                tenantId,
                email: inviteEmail,
                firstName: inviteFirstName || undefined,
                lastName: inviteLastName || undefined
              });
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            disabled={inviteMutation.isPending || inviteEmail.trim().length === 0}
          >
            {inviteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Send Invitation
          </button>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-slate-700" />
          <h3 className="text-lg font-semibold text-slate-900">Recent Invoices</h3>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Amount Due</th>
                <th className="px-3 py-2 font-medium">Amount Paid</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Issued</th>
              </tr>
            </thead>
            <tbody>
              {(usageQuery.data?.recentInvoices ?? []).map((invoice) => (
                <tr key={invoice.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">
                    {invoice.hostedInvoiceUrl ? (
                      <a className="text-sky-700 hover:text-sky-800" href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                        {invoice.stripeInvoiceId}
                      </a>
                    ) : (
                      invoice.stripeInvoiceId
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{invoice.amountDue} {invoice.currency.toUpperCase()}</td>
                  <td className="px-3 py-2 text-slate-700">{invoice.amountPaid} {invoice.currency.toUpperCase()}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{new Date(invoice.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(usageQuery.data?.recentInvoices ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No invoice events yet.</p>
        ) : null}
      </section>

      {subscriptionQuery.isLoading ? (
        <div className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading subscription...
        </div>
      ) : subscriptionQuery.data ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-violet-600" />
            <h3 className="text-lg font-semibold text-slate-900">Current Subscription</h3>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
            <p>
              <span className="font-medium text-slate-800">Plan:</span> {subscriptionQuery.data.plan.name}
            </p>
            <p>
              <span className="font-medium text-slate-800">Status:</span> {subscriptionQuery.data.status}
            </p>
            <p>
              <span className="font-medium text-slate-800">Cycle:</span> {subscriptionQuery.data.billingInterval}
            </p>
          </div>
        </section>
      ) : (
        <p className="text-sm text-slate-500">No active subscription found for this tenant.</p>
      )}
    </div>
  );
}
