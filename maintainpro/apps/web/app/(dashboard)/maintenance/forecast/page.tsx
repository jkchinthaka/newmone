import { EnterpriseQueuePage } from "@/components/enterprise-ops/enterprise-queue-page";

export default function ForecastPage() {
  return (
    <EnterpriseQueuePage
      kind="forecasts"
      title="Maintenance forecast"
      description="Estimated due dates from current meters and usage. Insufficient data is shown instead of invented predictions."
    />
  );
}
