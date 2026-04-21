"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const trend = [
  { month: "Jan", electricity: 640, water: 120 },
  { month: "Feb", electricity: 612, water: 118 },
  { month: "Mar", electricity: 668, water: 124 },
  { month: "Apr", electricity: 690, water: 130 },
  { month: "May", electricity: 710, water: 132 },
  { month: "Jun", electricity: 745, water: 138 }
];

export default function UtilitiesPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Utilities</h2>
      <div className="card h-80">
        <p className="text-sm font-medium text-slate-700">Monthly Consumption Trend</p>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line dataKey="electricity" stroke="#1476d6" strokeWidth={2} />
              <Line dataKey="water" stroke="#0f766e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card text-sm text-slate-700">Bill management table placeholder with pay and overdue actions.</div>
    </div>
  );
}
