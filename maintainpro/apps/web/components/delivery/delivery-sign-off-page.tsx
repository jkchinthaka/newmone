"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { fetchDeliveryDashboard, signOffDelivery } from "@/lib/delivery-api";

export function DeliverySignOffPage() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [department, setDepartment] = useState("");
  const [acceptedRisks, setAcceptedRisks] = useState("");

  const dashboardQuery = useQuery({
    queryKey: ["delivery", "dashboard"],
    queryFn: fetchDeliveryDashboard
  });

  const signOffMutation = useMutation({
    mutationFn: () =>
      signOffDelivery({
        notes: notes.trim() || undefined,
        department: department.trim() || undefined,
        acceptedRisks: acceptedRisks.trim() || undefined,
        reason: notes.trim() || "Client delivery sign-off recorded after readiness review."
      }),
    onSuccess: () => {
      toast.success("Delivery sign-off recorded");
      void queryClient.invalidateQueries({ queryKey: ["delivery"] });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "response" in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message)
          : "Sign-off blocked — resolve critical blockers first";
      toast.error(message || "Sign-off failed");
    }
  });

  const verdict = String(dashboardQuery.data?.currentVerdict ?? "NOT_READY").replace(/_/g, " ");

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Client Sign-off</h2>
          <p className="mt-1 text-sm text-slate-500">
            Formal delivery acceptance. Blocked while critical items fail or open QA critical issues exist.
          </p>
        </div>
        <Link href={"/delivery-readiness/final-report" as Route} className="text-sm underline">
          View final report
        </Link>
      </header>

      {dashboardQuery.isLoading ? (
        <InlineLoadingState label="Loading sign-off status…" />
      ) : (
        <div className="max-w-2xl space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">
            Current verdict: <strong>{verdict}</strong>
          </p>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Department</span>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. IT / Operations"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Sign-off notes</span>
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summary of readiness review and client acceptance…"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Accepted risks (optional)</span>
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2"
              rows={3}
              value={acceptedRisks}
              onChange={(e) => setAcceptedRisks(e.target.value)}
              placeholder="Document any accepted limitations for the handover pack…"
            />
          </label>

          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={signOffMutation.isPending}
            onClick={() => signOffMutation.mutate()}
          >
            Record delivery sign-off
          </button>
        </div>
      )}
    </div>
  );
}
