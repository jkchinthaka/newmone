import { useState } from "react";

import toast from "react-hot-toast";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

export const ReportsPage = () => {
  const [summary, setSummary] = useState<string>("");
  const [context, setContext] = useState<string>("Summarize this week maintenance performance and key risks.");

  const queueReport = async (reportType: "work-orders" | "assets" | "inventory") => {
    try {
      await apiClient.post("/reports/queue", {
        reportType,
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        requestedBy: "admin@maintainpro.local"
      });

      toast.success(`${reportType} report queued`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to queue report");
    }
  };

  const generateSummary = async () => {
    try {
      const response = await apiClient.post("/reports/ai-summary", { context });
      setSummary(response.data.data.summary as string);
      toast.success("AI summary generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI summary failed");
    }
  };

  return (
    <div>
      <PageHeader title="Reports" description="Queue operational reports and generate AI summaries for leadership reviews." />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="text-base font-semibold text-slate-900">Generate Reports</h3>
          <p className="mt-1 text-sm text-slate-600">Queue downloadable report jobs processed by the worker service.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void queueReport("work-orders")}>Queue Work Orders</Button>
            <Button variant="secondary" onClick={() => void queueReport("assets")}>
              Queue Assets
            </Button>
            <Button variant="ghost" onClick={() => void queueReport("inventory")}>
              Queue Inventory
            </Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-900">AI Executive Summary</h3>
          <textarea
            className="mt-3 h-32 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-brand-400 focus:outline-none"
            value={context}
            onChange={(event) => setContext(event.target.value)}
          />
          <div className="mt-3">
            <Button onClick={() => void generateSummary()}>Generate Summary</Button>
          </div>
          {summary ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{summary}</p> : null}
        </Card>
      </div>
    </div>
  );
};
