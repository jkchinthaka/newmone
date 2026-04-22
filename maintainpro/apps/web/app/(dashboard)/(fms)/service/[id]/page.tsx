import { JobEditorScreen } from "@/components/maintenance-job/screens";

export default function ServiceJobDetail({ params }: { params: { id: string } }) {
  return <JobEditorScreen module="service" jobId={params.id} />;
}
