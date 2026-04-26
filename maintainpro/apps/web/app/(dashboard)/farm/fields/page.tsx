"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { FarmListPage } from "@/components/farm/farm-list-page";
import { Section } from "@/components/farm/farm-ui";
import { farmGet } from "@/lib/farm-api";

type Field = {
  id: string;
  name: string;
  blockCode?: string | null;
  areaHectares: number;
  soilType?: string | null;
  status?: string | null;
  irrigationZone?: string | null;
  gpsPolygon?: unknown;
};

const FieldMap = dynamic(() => import("@/components/farm/field-map").then((m) => m.FieldMap), {
  ssr: false,
  loading: () => <p className="text-xs text-slate-500">Loading map…</p>
});

export default function FarmFieldsPage() {
  const list = useQuery({ queryKey: ["farm-fields"], queryFn: () => farmGet<Field[]>("/farm/fields") });

  return (
    <div className="space-y-6">
      <FarmListPage<Field>
        eyebrow="Fields"
        title="Fields & Mapping"
        description="Manage cultivated parcels with geo-tagged polygons and soil profiles."
        endpoint="/farm/fields"
        queryKey="farm-fields"
        columns={[
          { key: "name", label: "Name" },
          { key: "blockCode", label: "Block" },
          { key: "areaHectares", label: "Area (ha)" },
          { key: "soilType", label: "Soil" },
          { key: "status", label: "Status" }
        ]}
        fields={[
          { name: "name", label: "Field name", required: true },
          { name: "blockCode", label: "Block code" },
          { name: "areaHectares", label: "Area (hectares)", type: "number", step: "0.01", required: true },
          {
            name: "soilType",
            label: "Soil type",
            type: "select",
            options: ["CLAY", "LOAM", "SANDY", "SILT", "PEAT", "CHALKY"].map((v) => ({ value: v, label: v }))
          },
          { name: "irrigationZone", label: "Irrigation zone" },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: ["ACTIVE", "FALLOW", "UNDER_PREPARATION", "FLOODED", "RESTING"].map((v) => ({ value: v, label: v }))
          }
        ]}
      />
      <Section title="Field map">
        <div className="h-[420px] w-full overflow-hidden rounded-xl border border-slate-200">
          <FieldMap fields={list.data ?? []} />
        </div>
      </Section>
    </div>
  );
}
