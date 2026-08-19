import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function AssetHealthPage() {
  return (
    <EnterpriseQueuePage
      kind="assets"
      title="Asset health"
      description="Explainable asset scores and criticality. Health is decision support and is not a legal or safety gate."
    />
  );
}
