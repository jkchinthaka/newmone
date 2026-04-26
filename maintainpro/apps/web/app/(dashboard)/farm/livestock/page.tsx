"use client";

import { FarmListPage } from "@/components/farm/farm-list-page";

type Animal = {
  id: string;
  tagNumber: string;
  species: string;
  breed?: string | null;
  gender: string;
  weightKg?: number | null;
  status?: string | null;
};

export default function FarmLivestockPage() {
  return (
    <FarmListPage<Animal>
      eyebrow="Livestock"
      title="Livestock Animals"
      description="Manage the herd register with health and production logs per animal."
      endpoint="/farm/livestock/animals"
      queryKey="farm-livestock"
      columns={[
        { key: "tagNumber", label: "Tag" },
        { key: "species", label: "Species" },
        { key: "breed", label: "Breed" },
        { key: "gender", label: "Gender" },
        { key: "weightKg", label: "Weight (kg)" },
        { key: "status", label: "Status" }
      ]}
      fields={[
        { name: "tagNumber", label: "Tag number", required: true },
        {
          name: "species",
          label: "Species",
          type: "select",
          required: true,
          options: ["CATTLE", "BUFFALO", "GOAT", "SHEEP", "CHICKEN", "DUCK", "PIG", "OTHER"].map((v) => ({
            value: v,
            label: v
          }))
        },
        { name: "breed", label: "Breed" },
        {
          name: "gender",
          label: "Gender",
          type: "select",
          required: true,
          options: ["MALE", "FEMALE"].map((v) => ({ value: v, label: v }))
        },
        { name: "dateOfBirth", label: "Date of birth", type: "date" },
        { name: "weightKg", label: "Weight (kg)", type: "number", step: "0.1" },
        { name: "purchasePriceLkr", label: "Purchase price (LKR)", type: "number", step: "0.01" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: ["ACTIVE", "SOLD", "DECEASED", "QUARANTINE", "SICK"].map((v) => ({ value: v, label: v }))
        }
      ]}
    />
  );
}
