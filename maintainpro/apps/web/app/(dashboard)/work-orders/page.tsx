"use client";

import { useState } from "react";

const columns = {
  OPEN: ["WO-2026-0001", "WO-2026-0002"],
  IN_PROGRESS: ["WO-2026-0006"],
  ON_HOLD: ["WO-2026-0010"],
  COMPLETED: ["WO-2026-0005"]
};

export default function WorkOrdersPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Work Orders</h2>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
          <button className={`rounded-md px-3 py-1 ${view === "kanban" ? "bg-brand-100 text-brand-700" : "text-slate-600"}`} onClick={() => setView("kanban")}>Kanban</button>
          <button className={`rounded-md px-3 py-1 ${view === "list" ? "bg-brand-100 text-brand-700" : "text-slate-600"}`} onClick={() => setView("list")}>List</button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {Object.entries(columns).map(([status, items]) => (
            <section key={status} className="card">
              <p className="text-sm font-medium text-slate-700">{status.replace("_", " ")}</p>
              <div className="mt-3 space-y-2">
                {items.map((item) => (
                  <article key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    {item}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card text-sm text-slate-700">List view placeholder with server pagination and filtering.</div>
      )}
    </div>
  );
}
