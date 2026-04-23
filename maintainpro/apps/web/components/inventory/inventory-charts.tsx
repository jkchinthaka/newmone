import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatDate } from "./helpers";
import { TopUsedPartPoint, UsageTrendPoint } from "./types";

type InventoryChartsProps = {
  usageTrend: UsageTrendPoint[];
  topUsedParts: TopUsedPartPoint[];
};

function EmptyChartState({ title }: { title: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
      {title}
    </div>
  );
}

export function InventoryCharts({ usageTrend, topUsedParts }: InventoryChartsProps) {
  const usageData = usageTrend.map((point) => ({
    ...point,
    label: formatDate(point.date)
  }));

  const topData = topUsedParts.map((point) => ({
    ...point,
    label: point.partName.length > 18 ? `${point.partName.slice(0, 18)}...` : point.partName
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-900">Inventory Usage Trend</p>
          <p className="text-xs text-slate-500">Last 30 days of stock deduction volume</p>
        </div>

        {usageData.length === 0 ? (
          <EmptyChartState title="No movement data yet" />
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usageData} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                <defs>
                  <linearGradient id="usageStroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" minTickGap={18} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }}
                  formatter={(value) => [`${value} units`, "Used"]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line type="monotone" dataKey="quantity" stroke="url(#usageStroke)" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-900">Top Consumed Parts</p>
          <p className="text-xs text-slate-500">Highest outgoing stock in the same period</p>
        </div>

        {topData.length === 0 ? (
          <EmptyChartState title="No top-consumed part data yet" />
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topData} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }}
                  formatter={(value) => [`${value} units`, "Used"]}
                  labelFormatter={(label) => `Part: ${label}`}
                />
                <Bar dataKey="quantity" radius={[8, 8, 0, 0]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
