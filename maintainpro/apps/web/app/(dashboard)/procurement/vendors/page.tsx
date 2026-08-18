import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function VendorsPage() {
  return (
    <EnterpriseQueuePage
      kind="vendors"
      title="Vendor eligibility"
      description="Active and blocked status is enforced. Contract and insurance dates are insufficient data until captured on the vendor record."
    />
  );
}
