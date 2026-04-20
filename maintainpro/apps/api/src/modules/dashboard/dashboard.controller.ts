import type { RequestHandler } from "express";

import { sendSuccess } from "../../common/utils/response";
import { dashboardService } from "./dashboard.service";

const overview: RequestHandler = (_req, res) => {
  return sendSuccess(
    res,
    {
      kpis: dashboardService.getKpis(),
      trend: dashboardService.getWorkOrderTrend()
    },
    "Dashboard overview fetched"
  );
};

export const dashboardController = {
  overview
};
