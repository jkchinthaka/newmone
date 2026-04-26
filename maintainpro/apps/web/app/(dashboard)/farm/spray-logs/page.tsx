"use client";

import { FarmListPage } from "@/components/farm/farm-list-page";

type Spray = {
  id: string;
  fieldId: string;
  date: string;
  chemicalName: string;
  chemicalType: string;
  unit: string;
  totalQuantityUsed?: number | null;
  priorHarvestDays?: number | null;
  complianceFlag: boolean;
};

export default function FarmSprayLogsPage() {
  return (
    <FarmListPage<Spray>
      eyebrow="Compliance"
      title="Spray Logs"
      description="Document chemical applications with PHI tracking and compliance flags."
      endpoint="/farm/spray-logs"
      queryKey="farm-spray-logs"
      columns={[
        { key: "date", label: "Date", render: (r) => new Date(r.date).toLocaleDateString() },
        { key: "chemicalName", label: "Chemical" },
        { key: "chemicalType", label: "Type" },
        {
          key: "totalQuantityUsed",
          label: "Qty",
          render: (r) => (r.totalQuantityUsed ? `${r.totalQuantityUsed} ${r.unit}` : "—")
        },
        { key: "priorHarvestDays", label: "PHI (days)" },
        {
          key: "complianceFlag",
          label: "Compliance",
          render: (r) =>
            r.complianceFlag ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">OK</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Pending</span>
            )
        }
      ]}
      fields={[
        { name: "fieldId", label: "Field ID", required: true },
        { name: "cropCycleId", label: "Crop cycle ID" },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "chemicalName", label: "Chemical name", required: true },
        {
          name: "chemicalType",
          label: "Chemical type",
          type: "select",
          required: true,
          options: ["HERBICIDE", "PESTICIDE", "FUNGICIDE", "FERTILIZER", "GROWTH_REGULATOR", "ORGANIC_INPUT", "OTHER"].map(
            (v) => ({ value: v, label: v })
          )
        },
        { name: "targetPestDisease", label: "Target pest/disease" },
        { name: "dosagePerHectare", label: "Dosage / ha", type: "number", step: "0.01" },
        { name: "totalQuantityUsed", label: "Total used", type: "number", step: "0.01" },
        { name: "unit", label: "Unit (L/kg)", required: true },
        { name: "priorHarvestDays", label: "PHI days", type: "number" },
        { name: "reEntryIntervalHrs", label: "Re-entry hours", type: "number" },
        { name: "costLkr", label: "Cost (LKR)", type: "number", step: "0.01" }
      ]}
    />
  );
}
