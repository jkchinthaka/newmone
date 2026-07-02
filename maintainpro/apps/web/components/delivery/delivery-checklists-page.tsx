"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import {
  CATEGORY_LABELS,
  acceptDeliveryRisk,
  completeDeliveryItem,
  failDeliveryItem,
  fetchDeliveryCategories,
  fetchDeliveryItems,
  STATUS_STYLES,
  type DeliveryCategory,
  type DeliveryChecklistItem
} from "@/lib/delivery-api";

export function DeliveryChecklistsPage() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const categoriesQuery = useQuery({ queryKey: ["delivery", "categories"], queryFn: fetchDeliveryCategories });
  const itemsQuery = useQuery({
    queryKey: ["delivery", "items", categoryFilter, statusFilter],
    queryFn: () =>
      fetchDeliveryItems({
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {})
      })
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["delivery"] });
  };

  const passMutation = useMutation({
    mutationFn: (id: string) => completeDeliveryItem(id, {}),
    onSuccess: () => {
      toast.success("Item marked PASS");
      invalidate();
    },
    onError: () => toast.error("Could not update item")
  });

  const failMutation = useMutation({
    mutationFn: ({ id, blocker }: { id: string; blocker: boolean }) =>
      failDeliveryItem(id, { reason: "Failed during delivery readiness review.", blocker }),
    onSuccess: () => {
      toast.success("Item marked FAIL");
      invalidate();
    },
    onError: () => toast.error("Could not update item")
  });

  const riskMutation = useMutation({
    mutationFn: (id: string) =>
      acceptDeliveryRisk(id, { reason: "Manager accepted known limitation for pilot delivery." }),
    onSuccess: () => {
      toast.success("Risk accepted");
      invalidate();
    },
    onError: () => toast.error("Manager approval required to accept risk")
  });

  const grouped = useMemo(() => {
    const items = itemsQuery.data ?? [];
    const map = new Map<string, DeliveryChecklistItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [itemsQuery.data]);

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Delivery Checklists</h2>
          <p className="mt-1 text-sm text-slate-500">Review and update readiness items by category.</p>
        </div>
        <Link href={"/delivery-readiness" as Route} className="text-sm underline">
          Back to dashboard
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {(categoriesQuery.data ?? []).map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {["NOT_STARTED", "IN_PROGRESS", "PASS", "FAIL", "BLOCKED", "ACCEPTED_RISK", "NOT_APPLICABLE"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {itemsQuery.isLoading ? (
        <InlineLoadingState label="Loading checklist items…" />
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <section key={category} className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                {CATEGORY_LABELS[category as DeliveryCategory] ?? category}
              </h3>
              <ul className="mt-3 space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{item.title}</p>
                        {item.description ? <p className="mt-1 text-sm text-slate-600">{item.description}</p> : null}
                        {item.blocker ? (
                          <span className="mt-1 inline-block text-xs font-medium text-red-700">Blocker</span>
                        ) : null}
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                        {item.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                        disabled={passMutation.isPending}
                        onClick={() => passMutation.mutate(item.id)}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                        disabled={failMutation.isPending}
                        onClick={() => failMutation.mutate({ id: item.id, blocker: item.blocker })}
                      >
                        Fail
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                        disabled={riskMutation.isPending}
                        onClick={() => riskMutation.mutate(item.id)}
                      >
                        Accept risk
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
