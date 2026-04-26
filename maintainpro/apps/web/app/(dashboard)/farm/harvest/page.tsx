"use client";

import { FarmListPage } from "@/components/farm/farm-list-page";
import { formatLkr } from "@/lib/farm-api";

type Harvest = {
  id: string;
  cropCycleId: string;
  harvestDate: string;
  quantityKg: number;
  qualityGrade?: string | null;
  pricePerKgLkr?: number | null;
  totalValueLkr?: number | null;
  buyerName?: string | null;
};

export default function FarmHarvestPage() {
  return (
    <FarmListPage<Harvest>
      eyebrow="Harvest"
      title="Harvest Records"
      description="Capture every harvest with weight, grade, buyer and pricing data."
      endpoint="/farm/harvest"
      queryKey="farm-harvest"
      columns={[
        { key: "harvestDate", label: "Date", render: (r) => new Date(r.harvestDate).toLocaleDateString() },
        { key: "quantityKg", label: "Qty (kg)" },
        { key: "qualityGrade", label: "Grade" },
        { key: "pricePerKgLkr", label: "Price/kg", render: (r) => formatLkr(r.pricePerKgLkr ?? null) },
        { key: "totalValueLkr", label: "Total", render: (r) => formatLkr(r.totalValueLkr ?? null) },
        { key: "buyerName", label: "Buyer" }
      ]}
      fields={[
        { name: "cropCycleId", label: "Crop cycle ID", required: true },
        { name: "harvestDate", label: "Harvest date", type: "date", required: true },
        { name: "quantityKg", label: "Quantity (kg)", type: "number", step: "0.01", required: true },
        {
          name: "qualityGrade",
          label: "Quality grade",
          type: "select",
          options: ["A", "B", "C", "REJECT"].map((v) => ({ value: v, label: v }))
        },
        { name: "moistureLevel", label: "Moisture (%)", type: "number", step: "0.1" },
        { name: "pricePerKgLkr", label: "Price per kg (LKR)", type: "number", step: "0.01" },
        { name: "totalValueLkr", label: "Total value (LKR)", type: "number", step: "0.01" },
        { name: "buyerName", label: "Buyer name" },
        { name: "storageLocation", label: "Storage location" },
        { name: "batchCode", label: "Batch code" }
      ]}
    />
  );
}
