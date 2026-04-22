import { JobEditorScreen } from "@/components/maintenance-job/screens";

export default function MachineryJobDetail({ params }: { params: { id: string } }) {
  return <JobEditorScreen module="machinery" jobId={params.id} />;
}
