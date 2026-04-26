"use client";

import { FarmListPage } from "@/components/farm/farm-list-page";

type Soil = {
  id: string;
  fieldId: string;
  testDate: string;
  ph?: number | null;
  organicMatterPct?: number | null;
  recommendation?: string | null;
  field?: { name: string } | null;
};

export default function FarmSoilTestsPage() {
  return (
    <FarmListPage<Soil>
      eyebrow="Agronomy"
      title="Soil Tests"
      description="Lab-confirmed soil profile tests per field with recommendations."
      endpoint="/farm/soil-tests"
      queryKey="farm-soil-tests"
      columns={[
        { key: "testDate", label: "Date", render: (r) => new Date(r.testDate).toLocaleDateString() },
        { key: "field", label: "Field", render: (r) => r.field?.name ?? "—" },
        { key: "ph", label: "pH" },
        { key: "organicMatterPct", label: "OM %" },
        { key: "recommendation", label: "Recommendation" }
      ]}
      fields={[
        { name: "fieldId", label: "Field ID", required: true },
        { name: "testDate", label: "Test date", type: "date", required: true },
        { name: "ph", label: "pH", type: "number", step: "0.1" },
        { name: "nitrogenPpm", label: "Nitrogen (ppm)", type: "number", step: "0.1" },
        { name: "phosphorusPpm", label: "Phosphorus (ppm)", type: "number", step: "0.1" },
        { name: "potassiumPpm", label: "Potassium (ppm)", type: "number", step: "0.1" },
        { name: "organicMatterPct", label: "Organic matter (%)", type: "number", step: "0.1" },
        { name: "labName", label: "Lab name" },
        { name: "recommendation", label: "Recommendation", type: "textarea" }
      ]}
    />
  );
}
