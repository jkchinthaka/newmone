"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { KpiCard } from "@/components/ui/kpi-card";

const monthlyCost = [
  { month: "Jan", cost: 12000 },
  { month: "Feb", cost: 10500 },
  { month: "Mar", cost: 13200 },
  { month: "Apr", cost: 11800 },
  { month: "May", cost: 14050 },
  { month: "Jun", cost: 15500 }
];

const workOrdersStatus = [
  { name: "Open", value: 32 },
  { name: "In Progress", value: 21 },
  { name: "On Hold", value: 8 },
  { name: "Completed", value: 120 }
];

const fleetStatus = [
  { name: "Available", value: 26 },
  { name: "In Use", value: 12 },
  { name: "Maintenance", value: 6 }
];

const fuelTrend = [
  { month: "Jan", liters: 1100 },
  { month: "Feb", liters: 1200 },
  { month: "Mar", liters: 1160 },
  { month: "Apr", liters: 1280 },
  { month: "May", liters: 1310 },
  { month: "Jun", liters: 1380 }
];

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Operations Dashboard</h2>
        <p className="text-sm text-slate-500">Asset health, fleet movement, service workload, and utility trends in one view.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Assets" value="1,284" delta="+4.2% vs last month" />
        <KpiCard label="Fleet Available" value="26 / 44" delta="+3 vehicles today" />
        <KpiCard label="Open Work Orders" value="61" delta="-8 since yesterday" />
        <KpiCard label="Low Stock Items" value="18" delta="Needs restock in 3 days" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card h-80">
          <p className="text-sm font-medium text-slate-700">Monthly Maintenance Cost</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyCost}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="cost" stroke="#1476d6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card h-80">
          <p className="text-sm font-medium text-slate-700">Work Orders by Status</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workOrdersStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2c92f2" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card h-80">
          <p className="text-sm font-medium text-slate-700">Fleet Status Distribution</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fleetStatus} dataKey="value" nameKey="name" outerRadius={90} fill="#2c92f2" label />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card h-80">
          <p className="text-sm font-medium text-slate-700">Fuel Consumption Trend</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fuelTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="liters" stroke="#115ea8" fill="#bce0ff" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
