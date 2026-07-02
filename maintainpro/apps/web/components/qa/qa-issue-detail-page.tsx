"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { addQaRca, addQaRegression, closeQaIssue, fetchQaIssue } from "@/lib/qa-api";

export function QaIssueDetailPage({ issueId }: { issueId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["qa", "issue", issueId], queryFn: () => fetchQaIssue(issueId) });
  const [resolutionNote, setResolutionNote] = useState("");
  const [rcaExplanation, setRcaExplanation] = useState("");

  const closeMutation = useMutation({
    mutationFn: () => closeQaIssue(issueId, { resolutionNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qa", "issue", issueId] });
      toast.success("Issue closed");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not close issue"))
  });

  const rcaMutation = useMutation({
    mutationFn: () =>
      addQaRca(issueId, {
        rootCauseType: "CODING_BUG",
        explanation: rcaExplanation
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qa", "issue", issueId] });
      toast.success("RCA saved");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save RCA"))
  });

  const regressionMutation = useMutation({
    mutationFn: () =>
      addQaRegression(issueId, {
        testCase: "Manual regression after fix",
        environment: "STAGING",
        result: "PASS"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qa", "issue", issueId] });
      toast.success("Regression recorded");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not record regression"))
  });

  if (query.isLoading) return <InlineLoadingState label="Loading issue…" />;
  const issue = query.data;
  if (!issue) return <p className="p-6 text-sm text-slate-500">Issue not found.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageBreadcrumbs />
      <header>
        <p className="font-mono text-xs text-slate-500">{issue.issueNo}</p>
        <h2 className="text-2xl font-semibold">{issue.title}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {issue.category} · {issue.severity} · {issue.status} · {issue.environment}
        </p>
      </header>

      <section className="rounded-xl border bg-white p-4 text-sm">
        <h3 className="font-semibold">Description</h3>
        <p className="mt-2 whitespace-pre-wrap text-slate-700">{String(issue.description ?? "")}</p>
        {issue.technicalDetailsRestricted ? (
          <p className="mt-2 text-xs text-amber-700">Sensitive technical details are restricted for your role.</p>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h3 className="text-sm font-semibold">Root Cause Analysis</h3>
          <textarea
            className="mt-2 w-full rounded border px-3 py-2 text-sm"
            rows={4}
            placeholder="Root cause explanation"
            value={rcaExplanation}
            onChange={(e) => setRcaExplanation(e.target.value)}
          />
          <button type="button" className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => rcaMutation.mutate()}>
            Save RCA
          </button>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h3 className="text-sm font-semibold">Regression & Close</h3>
          <button type="button" className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => regressionMutation.mutate()}>
            Record PASS regression
          </button>
          <textarea
            className="mt-3 w-full rounded border px-3 py-2 text-sm"
            rows={3}
            placeholder="Resolution note (required to close)"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />
          <button
            type="button"
            disabled={!resolutionNote.trim()}
            className="mt-2 rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-40"
            onClick={() => closeMutation.mutate()}
          >
            Close Issue
          </button>
        </div>
      </section>
    </div>
  );
}
