import { useQuery } from "@tanstack/react-query";
import { ApiResponse, InventoryItem } from "@maintainpro/shared-types";

import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

const fetchInventory = async (): Promise<InventoryItem[]> => {
  const response = await apiClient.get<ApiResponse<InventoryItem[]>>("/inventory");
  return response.data.data;
};

export const InventoryPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventory
  });

  return (
    <div>
      <PageHeader title="Inventory" description="Monitor spares, reorder levels, and stock criticality." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? <p className="text-sm text-slate-500">Loading inventory...</p> : null}
        {(data ?? []).map((item) => {
          const lowStock = item.quantity <= item.reorderLevel;

          return (
            <Card key={item.id} className={lowStock ? "border-rose-200" : ""}>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.sku}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.name}</h3>
              <p className="mt-2 text-sm text-slate-600">Qty: {item.quantity}</p>
              <p className="mt-1 text-sm text-slate-600">Reorder Level: {item.reorderLevel}</p>
              {lowStock ? <p className="mt-3 text-xs font-semibold text-rose-600">Needs replenishment</p> : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
