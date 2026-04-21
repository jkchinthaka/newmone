"use client";

import { useState } from "react";

const tabs = ["dashboard", "maintenance", "fleet", "downtime", "work-orders", "inventory", "utilities"];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Reports</h2>
        <div className="flex gap-2">
          <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100">Export CSV</button>
          <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100">Export PDF</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`rounded-md px-3 py-1.5 text-sm ${activeTab === tab ? "bg-brand-600 text-white" : "bg-white text-slate-700"}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="card text-sm text-slate-700">{activeTab} report content placeholder wired for API aggregation endpoints.</div>
    </div>
  );
}
