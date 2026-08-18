import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function WarrantyPage() {
  return (
    <EnterpriseQueuePage
      kind="warranty"
      title="Warranty opportunities"
      description="Possible warranty claims detected when a tracked part fails inside date or mileage cover."
    />
  );
}
