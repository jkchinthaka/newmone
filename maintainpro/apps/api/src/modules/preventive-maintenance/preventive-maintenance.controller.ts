import type { RequestHandler } from "express";

import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/response";
import { preventiveMaintenanceService } from "./preventive-maintenance.service";

const list: RequestHandler = (_req, res) => {
  return sendSuccess(res, preventiveMaintenanceService.listSchedules(), "PM schedules fetched");
};

const weatherImpact: RequestHandler = asyncHandler(async (req, res) => {
  const location = String(req.params.location ?? "").trim();
  const data = await preventiveMaintenanceService.weatherImpact(location);

  return sendSuccess(res, data, "Weather impact generated");
});

export const preventiveMaintenanceController = {
  list,
  weatherImpact
};
