"use client";

import { FarmListPage } from "@/components/farm/farm-list-page";
import { formatLkr } from "@/lib/farm-api";

type Worker = {
  id: string;
  name: string;
  nic?: string | null;
  phone?: string | null;
  workerType: string;
  dailyWageLkr?: number | null;
  status: string;
};

export default function FarmWorkersPage() {
  return (
    <FarmListPage<Worker>
      eyebrow="People"
      title="Farm Workers"
      description="Register permanent, seasonal and daily workers with QR-tagged IDs."
      endpoint="/farm/workers"
      queryKey="farm-workers"
      columns={[
        { key: "name", label: "Name" },
        { key: "nic", label: "NIC" },
        { key: "phone", label: "Phone" },
        { key: "workerType", label: "Type" },
        { key: "dailyWageLkr", label: "Daily wage", render: (r) => formatLkr(r.dailyWageLkr ?? null) },
        { key: "status", label: "Status" }
      ]}
      fields={[
        { name: "name", label: "Worker name", required: true },
        { name: "nic", label: "NIC" },
        { name: "phone", label: "Phone" },
        { name: "address", label: "Address", type: "textarea" },
        {
          name: "workerType",
          label: "Worker type",
          type: "select",
          required: true,
          options: ["PERMANENT", "SEASONAL", "CONTRACT", "DAILY"].map((v) => ({ value: v, label: v }))
        },
        { name: "dailyWageLkr", label: "Daily wage (LKR)", type: "number", step: "0.01" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: ["ACTIVE", "INACTIVE", "SUSPENDED"].map((v) => ({ value: v, label: v }))
        }
      ]}
    />
  );
}
