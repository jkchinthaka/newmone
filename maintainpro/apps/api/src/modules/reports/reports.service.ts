import { enqueueReportJob } from "../../jobs/queues/report.queue";
import { getMaintenanceSuggestion } from "../../integrations/ai/anthropic.client";

export interface ReportRequest {
  reportType: "work-orders" | "assets" | "inventory";
  dateFrom: string;
  dateTo: string;
  requestedBy: string;
}

export const reportsService = {
  async queueReport(request: ReportRequest): Promise<{ accepted: true }> {
    await enqueueReportJob({
      reportType: request.reportType,
      requestedBy: request.requestedBy,
      dateRange: {
        from: request.dateFrom,
        to: request.dateTo
      }
    });

    return { accepted: true };
  },

  async suggestSummary(reportContext: string): Promise<{ summary: string }> {
    const summary = await getMaintenanceSuggestion(
      `Create an executive maintenance summary in 4 bullet points:\n${reportContext}`
    );

    return { summary };
  }
};
