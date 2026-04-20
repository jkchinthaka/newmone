import { useQuery } from "@tanstack/react-query";
import { ApiResponse } from "@maintainpro/shared-types";

import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

interface PmSchedule {
  id: string;
  task: string;
  assetCode: string;
  frequency: string;
  nextDueDate: string;
}

const fetchSchedules = async (): Promise<PmSchedule[]> => {
  const response = await apiClient.get<ApiResponse<PmSchedule[]>>("/preventive-maintenance");
  return response.data.data;
};

export const PreventiveMaintenancePage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["preventive-maintenance"],
    queryFn: fetchSchedules
  });

  return (
    <div>
      <PageHeader
        title="Preventive Maintenance"
        description="Optimize routine work to reduce unplanned downtime and extend asset life."
      />

      <div className="space-y-3">
        {isLoading ? <p className="text-sm text-slate-500">Loading schedules...</p> : null}
        {(data ?? []).map((item) => (
          <Card key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.task}</p>
              <p className="text-xs text-slate-500">
                {item.assetCode} • {item.frequency}
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">Due {item.nextDueDate}</span>
          </Card>
        ))}
      </div>
    </div>
  );
};
