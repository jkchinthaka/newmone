import { motion } from "framer-motion";
import { Activity, AlertTriangle, Clock3, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ApiResponse, DashboardKpis } from "@maintainpro/shared-types";

import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

interface DashboardOverview {
  kpis: DashboardKpis;
  trend: Array<{ month: string; completed: number; backlog: number }>;
}

const fetchDashboardOverview = async (): Promise<DashboardOverview> => {
  const response = await apiClient.get<ApiResponse<DashboardOverview>>("/dashboard/overview");
  return response.data.data;
};

export const DashboardPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: fetchDashboardOverview
  });

  const kpis = data?.kpis;

  return (
    <div>
      <PageHeader
        title="Reliability Dashboard"
        description="Monitor MTTR, backlog trends, and preventive maintenance performance in real time."
      />

      {isLoading ? <p className="text-sm text-slate-500">Loading dashboard metrics...</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <StatCard
            label="Open Work Orders"
            value={String(kpis?.openWorkOrders ?? 0)}
            hint="Updated every 30 seconds"
            icon={<Wrench size={18} />}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <StatCard label="MTTR" value={`${kpis?.mttrHours ?? 0}h`} hint="Mean time to repair" icon={<Clock3 size={18} />} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <StatCard
            label="On-Time PM"
            value={`${kpis?.onTimePmRate ?? 0}%`}
            hint="Preventive compliance"
            icon={<Activity size={18} />}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <StatCard
            label="Low Stock SKUs"
            value={String(kpis?.lowStockItems ?? 0)}
            hint="Items below reorder level"
            icon={<AlertTriangle size={18} />}
          />
        </motion.div>
      </div>

      <Card className="mt-6 h-[360px]">
        <h3 className="mb-4 text-base font-semibold text-slate-900">Work Order Throughput</h3>
        <ResponsiveContainer width="100%" height="90%">
          <AreaChart data={data?.trend ?? []}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="completed" stroke="#0f766e" fill="rgba(15, 118, 110, 0.25)" />
            <Area type="monotone" dataKey="backlog" stroke="#2563eb" fill="rgba(37, 99, 235, 0.18)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};
