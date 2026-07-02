"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { fetchQaIssues } from "@/lib/qa-api";

export function QaIssuesListPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["qa", "issues", page, search, category, status],
    queryFn: () =>
      fetchQaIssues({
        page,
        pageSize: 20,
        search: search.trim() || undefined,
        category: category || undefined,
        status: status || undefined
      })
  });

  const rows = query.data?.items ?? [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Error Register</h2>
          <p className="text-sm text-slate-500">Incident log and software issue tracking.</p>
        </div>
        <Link href={"/qa/issues/new" as Route} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
          Report Issue
        </Link>
      </header>

      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="rounded border px-3 py-2 text-sm md:col-span-1"
        />
        <input
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {["REPORTED", "TRIAGED", "IN_PROGRESS", "FIXED", "RETESTING", "PASSED", "FAILED", "CLOSED", "REOPENED", "ACCEPTED_RISK"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
      </div>

      {query.isLoading ? (
        <InlineLoadingState label="Loading issues…" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">No issues found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">No</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Env</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/qa/issues/${row.id}` as Route} className="underline">
                      {row.issueNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.title}</td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3">{row.severity}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">{row.environment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta ? (
        <div className="flex justify-between text-sm">
          <span>
            Page {meta.page} / {meta.totalPages} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} className="rounded border px-3 py-1 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button
              type="button"
              disabled={page >= (meta.totalPages || 1)}
              className="rounded border px-3 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
