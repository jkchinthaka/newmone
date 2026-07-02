"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { createQaIssue, fetchQaCategories, type QaCategoryMeta } from "@/lib/qa-api";

export function ReportQaIssuePage() {
  const categoriesQuery = useQuery({ queryKey: ["qa", "categories"], queryFn: fetchQaCategories });
  const [form, setForm] = useState({
    title: "",
    category: "BACKEND_ERROR",
    affectedModule: "",
    affectedPage: "",
    affectedApi: "",
    environment: "STAGING",
    severity: "MEDIUM",
    priority: "MEDIUM",
    description: "",
    reproductionSteps: "",
    expectedResult: "",
    actualResult: "",
    businessImpact: "",
    linkedUatPhase: ""
  });

  const mutation = useMutation({
    mutationFn: () =>
      createQaIssue({
        ...form,
        reproductionSteps: form.reproductionSteps || undefined,
        expectedResult: form.expectedResult || undefined,
        actualResult: form.actualResult || undefined,
        businessImpact: form.businessImpact || undefined,
        linkedUatPhase: form.linkedUatPhase || undefined
      }),
    onSuccess: () => toast.success("Issue reported successfully"),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not report issue"))
  });

  const categories = categoriesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageBreadcrumbs />
      <header>
        <Link href={"/qa" as Route} className="text-sm text-slate-500 underline">
          Back to QA dashboard
        </Link>
        <h2 className="mt-2 text-2xl font-semibold">Report New Issue</h2>
        <p className="mt-1 text-sm text-amber-800">
          Do not paste passwords, tokens, or secret URLs. Add exact steps to reproduce and mention the user role used.
        </p>
      </header>

      {categoriesQuery.isLoading ? (
        <InlineLoadingState label="Loading categories…" />
      ) : (
        <form
          className="space-y-4 rounded-xl border bg-white p-5 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <input
            required
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            {categories.map((c: QaCategoryMeta) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          {categories.find((c) => c.key === form.category) ? (
            <p className="text-xs text-slate-500">
              {categories.find((c) => c.key === form.category)?.description}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Affected module"
              value={form.affectedModule}
              onChange={(e) => setForm({ ...form, affectedModule: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              placeholder="Affected page or API"
              value={form.affectedPage}
              onChange={(e) => setForm({ ...form, affectedPage: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={form.environment}
              onChange={(e) => setForm({ ...form, environment: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="LOCAL">Local</option>
              <option value="STAGING">Staging</option>
              <option value="PRODUCTION">Production</option>
            </select>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            >
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={form.linkedUatPhase}
              onChange={(e) => setForm({ ...form, linkedUatPhase: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">UAT phase (optional)</option>
              {["UAT-017", "UAT-018", "UAT-019", "UAT-020", "UAT-021", "UAT-022", "UAT-023", "UAT-024", "UAT-025"].map(
                (p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                )
              )}
            </select>
          </div>
          <textarea
            required
            placeholder="Description *"
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Steps to reproduce"
            rows={3}
            value={form.reproductionSteps}
            onChange={(e) => setForm({ ...form, reproductionSteps: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Expected result"
            rows={2}
            value={form.expectedResult}
            onChange={(e) => setForm({ ...form, expectedResult: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Actual result"
            rows={2}
            value={form.actualResult}
            onChange={(e) => setForm({ ...form, actualResult: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {mutation.isPending ? "Submitting…" : "Submit Issue"}
          </button>
        </form>
      )}
    </div>
  );
}
