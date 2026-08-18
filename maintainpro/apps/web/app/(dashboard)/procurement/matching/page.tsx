import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function MatchingPage() {
  return (
    <EnterpriseQueuePage
      kind="matching"
      title="Purchase order matching"
      description="Compares ordered vs received quantities. Invoice matching is insufficient data until a PO-linked supplier invoice exists."
    />
  );
}
