import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function ExceptionsPage() {
  return (
    <EnterpriseQueuePage
      kind="exceptions"
      title="Business exceptions"
      description="Data quality and operational exceptions. Records are resolved or ignored with reason, never deleted."
    />
  );
}
