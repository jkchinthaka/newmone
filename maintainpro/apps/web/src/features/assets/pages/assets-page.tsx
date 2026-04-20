import { useQuery } from "@tanstack/react-query";
import { ApiResponse, Asset } from "@maintainpro/shared-types";

import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

const fetchAssets = async (): Promise<Asset[]> => {
  const response = await apiClient.get<ApiResponse<Asset[]>>("/assets");
  return response.data.data;
};

export const AssetsPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: fetchAssets
  });

  return (
    <div>
      <PageHeader title="Assets" description="Track critical equipment, status, and location across facilities." />

      {isLoading ? <p className="text-sm text-slate-500">Loading assets...</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((asset) => (
          <Card key={asset.id}>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{asset.code}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{asset.name}</h3>
            <p className="mt-2 text-sm text-slate-600">{asset.location}</p>
            <span className="mt-4 inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              {asset.status}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
};
