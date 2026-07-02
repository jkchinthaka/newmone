"use client";

import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { fetchQaIssues } from "@/lib/qa-api";

export function QaKnownIssuesPage() {
  const query = useQuery({
    queryKey: ["qa", "known-issues"],
    queryFn: () => fetchQaIssues({ knownOnly: "true", pageSize: 100 })
  });

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header>
        <h2 className="text-2xl font-semibold">Known Issues / Accepted Risks</h2>
        <p className="text-sm text-slate-500">Documented limitations visible to management before full go-live.</p>
      </header>
      {query.isLoading ? (
        <InlineLoadingState label="Loading known issues…" />
      ) : (query.data?.items ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">
          No accepted risks documented yet.
        </div>
      ) : (
        <div className="space-y-3">
          {(query.data?.items ?? []).map((issue) => (
            <article key={issue.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="font-semibold">
                {issue.issueNo} — {issue.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{issue.description}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
