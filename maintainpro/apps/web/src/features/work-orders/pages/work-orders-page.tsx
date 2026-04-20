import { useQuery } from "@tanstack/react-query";
import { ApiResponse, WorkOrder } from "@maintainpro/shared-types";

import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

const fetchWorkOrders = async (): Promise<WorkOrder[]> => {
  const response = await apiClient.get<ApiResponse<WorkOrder[]>>("/work-orders");
  return response.data.data;
};

export const WorkOrdersPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["work-orders"],
    queryFn: fetchWorkOrders
  });

  return (
    <div>
      <PageHeader
        title="Work Orders"
        description="Plan, assign, and track reactive or preventive maintenance jobs."
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={5}>
                    Loading work orders...
                  </td>
                </tr>
              ) : (
                (data ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.title}</td>
                    <td className="px-4 py-3 text-slate-600">{item.assetCode}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{item.priority}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{item.status.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-slate-600">{item.dueDate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
