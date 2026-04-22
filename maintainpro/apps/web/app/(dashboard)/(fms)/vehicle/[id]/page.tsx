import { JobEditorScreen } from "@/components/maintenance-job/screens";

export default function VehicleJobDetail({ params }: { params: { id: string } }) {
  return <JobEditorScreen module="vehicle" jobId={params.id} />;
}
