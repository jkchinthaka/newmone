import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function SlaPage() {
  return (
    <EnterpriseQueuePage
      kind="sla"
      title="SLA risk"
      description="Response and resolution clocks use the tenant business calendar. On-hold work does not consume SLA time."
    />
  );
}
