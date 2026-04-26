"use client";

import { FarmListPage } from "@/components/farm/farm-list-page";

type Irrigation = {
  id: string;
  fieldId: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  waterUsedLiters?: number | null;
  method: string;
};

export default function FarmIrrigationPage() {
  return (
    <FarmListPage<Irrigation>
      eyebrow="Irrigation"
      title="Irrigation Logs"
      description="Track water usage and irrigation duration per field."
      endpoint="/farm/irrigation"
      queryKey="farm-irrigation"
      columns={[
        { key: "startTime", label: "Start", render: (r) => new Date(r.startTime).toLocaleString() },
        {
          key: "endTime",
          label: "End",
          render: (r) => (r.endTime ? new Date(r.endTime).toLocaleString() : "—")
        },
        { key: "durationMinutes", label: "Duration (min)" },
        { key: "waterUsedLiters", label: "Water (L)" },
        { key: "method", label: "Method" }
      ]}
      fields={[
        { name: "fieldId", label: "Field ID", required: true },
        { name: "startTime", label: "Start time", type: "datetime-local", required: true },
        { name: "endTime", label: "End time", type: "datetime-local" },
        { name: "waterUsedLiters", label: "Water used (L)", type: "number", step: "0.1" },
        {
          name: "method",
          label: "Method",
          type: "select",
          required: true,
          options: ["FLOOD", "DRIP", "SPRINKLER", "FURROW", "CHANNEL", "MANUAL"].map((v) => ({ value: v, label: v }))
        },
        { name: "costLkr", label: "Cost (LKR)", type: "number", step: "0.01" }
      ]}
    />
  );
}
