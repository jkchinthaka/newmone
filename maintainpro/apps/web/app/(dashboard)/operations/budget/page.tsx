import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function BudgetPage() {
  return (
    <EnterpriseQueuePage
      kind="budget"
      title="Budget commitments"
      description="Committed amounts come from approved open purchase orders. Missing budget configuration is shown as insufficient data, not zero."
    />
  );
}
