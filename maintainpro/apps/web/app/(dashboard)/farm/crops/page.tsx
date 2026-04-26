"use client";

import { FarmListPage } from "@/components/farm/farm-list-page";

type Crop = {
  id: string;
  cropType: string;
  variety?: string | null;
  status?: string | null;
  plantingDate: string;
  expectedHarvestDate?: string | null;
  field?: { name: string } | null;
};

export default function FarmCropsPage() {
  return (
    <FarmListPage<Crop>
      eyebrow="Crops"
      title="Crop Cycles"
      description="Plan, track, and review every cropping cycle from planting to harvest."
      endpoint="/farm/crops"
      queryKey="farm-crops"
      columns={[
        { key: "cropType", label: "Crop" },
        { key: "variety", label: "Variety" },
        { key: "field", label: "Field", render: (r) => r.field?.name ?? "—" },
        { key: "plantingDate", label: "Planted", render: (r) => new Date(r.plantingDate).toLocaleDateString() },
        {
          key: "expectedHarvestDate",
          label: "Expected harvest",
          render: (r) => (r.expectedHarvestDate ? new Date(r.expectedHarvestDate).toLocaleDateString() : "—")
        },
        { key: "status", label: "Status" }
      ]}
      fields={[
        { name: "fieldId", label: "Field ID", required: true },
        { name: "cropType", label: "Crop type", required: true },
        { name: "variety", label: "Variety" },
        { name: "plantingDate", label: "Planting date", type: "date", required: true },
        { name: "expectedHarvestDate", label: "Expected harvest date", type: "date" },
        { name: "expectedYieldKg", label: "Expected yield (kg)", type: "number", step: "0.01" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: ["PLANNED", "PLANTED", "GROWING", "FLOWERING", "HARVEST_READY", "HARVESTED", "FAILED", "ABANDONED"].map(
            (v) => ({ value: v, label: v })
          )
        }
      ]}
    />
  );
}
