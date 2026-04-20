import type { RequestHandler } from "express";
import { z } from "zod";

import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/response";
import { reportsService } from "./reports.service";

const queueReportSchema = z.object({
  reportType: z.enum(["work-orders", "assets", "inventory"]),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  requestedBy: z.string().email()
});

const aiSummarySchema = z.object({
  context: z.string().min(10)
});

const queueReport: RequestHandler = asyncHandler(async (req, res) => {
  const payload = queueReportSchema.parse(req.body);
  const result = await reportsService.queueReport(payload);

  return sendSuccess(res, result, "Report generation queued", 202);
});

const aiSummary: RequestHandler = asyncHandler(async (req, res) => {
  const payload = aiSummarySchema.parse(req.body);
  const result = await reportsService.suggestSummary(payload.context);

  return sendSuccess(res, result, "AI report summary generated");
});

export const reportsController = {
  queueReport,
  aiSummary
};
