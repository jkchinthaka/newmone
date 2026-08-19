import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function MappingsPage() {
  return (
    <EnterpriseQueuePage
      kind="mappings"
      title="Master data mapping"
      description="Unknown ERP items and warehouses stay as mapping required. They are never auto-created as active master data."
    />
  );
}
