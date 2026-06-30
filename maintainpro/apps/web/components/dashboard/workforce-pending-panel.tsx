"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { toSafeApiErrorMessage } from "@/components/ui/page-state";

type WorkloadRow = {
  employeeId: string;
  employeeName: string;
  designation?: string | null;
  pendingCount: number;
  inProgressCount: number;
  overdueCount: number;
  todayAllocatedHours: number;
  monthlyCompletedTasks: number;
  workloadPercentage: number;
};

type WorkloadSummary = {
  generatedAt: string;
  rows: WorkloadRow[];
};

export function WorkforcePendingPanel() {
  const query = useQuery({
    queryKey: ["workforce", "workload-summary"],
    queryFn: async () => {
      const response = await apiClient.get<{ data: WorkloadSummary }>("/workforce/workload-summary");
      return response.data.data;
    },
    refetchInterval: 60_000
  });

  const rows = query.data?.rows ?? [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-brand-700" aria-hidden />
        <h3 className="text-lg font-semibold text-slate-900">Employee workload</h3>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Pending and in-progress tasks by employee with overdue counts and today&apos;s allocated hours.
      </p>

      {query.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading workforce summary...</p>
      ) : query.isError ? (
        <p className="mt-4 text-sm text-rose-600">
          {toSafeApiErrorMessage(query.error, "Could not load workforce summary.")}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No active assignments for workforce employees.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Employee</th>
                <th className="px-2 py-2">Designation</th>
                <th className="px-2 py-2">Pending</th>
                <th className="px-2 py-2">In progress</th>
                <th className="px-2 py-2">Overdue</th>
                <th className="px-2 py-2">Today hrs</th>
                <th className="px-2 py-2">Month done</th>
                <th className="px-2 py-2">Load</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row) => (
                <tr key={row.employeeId} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-900">{row.employeeName}</td>
                  <td className="px-2 py-2 text-slate-600">{row.designation ?? "—"}</td>
                  <td className="px-2 py-2">{row.pendingCount}</td>
                  <td className="px-2 py-2">{row.inProgressCount}</td>
                  <td className="px-2 py-2 text-rose-700">{row.overdueCount}</td>
                  <td className="px-2 py-2">{row.todayAllocatedHours.toFixed(1)}</td>
                  <td className="px-2 py-2">{row.monthlyCompletedTasks}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.workloadPercentage >= 90
                          ? "bg-rose-100 text-rose-800"
                          : row.workloadPercentage >= 70
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {row.workloadPercentage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
