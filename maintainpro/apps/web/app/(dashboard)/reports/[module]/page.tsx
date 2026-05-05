import { ReportModulePage } from "@/components/reports/report-module-page";

export default function ReportModuleRoute({ params }: { params: { module: string } }) {
  return <ReportModulePage module={params.module} />;
}