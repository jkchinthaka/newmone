import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function ProcurementRecommendationsPage() {
  return (
    <EnterpriseQueuePage
      kind="procurement"
      title="Procurement recommendations"
      description="Suggested reorders from available stock, incoming POs, and upcoming maintenance demand. Nothing is purchased automatically."
    />
  );
}
