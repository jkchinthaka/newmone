import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function VehicleHealthPage() {
  return (
    <EnterpriseQueuePage
      kind="health"
      title="Vehicle health"
      description="Explainable 0–100 scores. Health is decision support and is not used as a legal or gate-out rule."
    />
  );
}
