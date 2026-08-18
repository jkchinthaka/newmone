import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function VehicleCostsPage() {
  return (
    <EnterpriseQueuePage
      kind="costs"
      title="Vehicle costs"
      description="Allocated operating costs from live work orders, parts, fuel, fines, and accidents. Cost/km requires a valid distance."
    />
  );
}
