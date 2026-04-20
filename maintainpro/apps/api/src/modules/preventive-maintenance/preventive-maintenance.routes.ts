import { Router } from "express";

import { requireAuth } from "../../common/middlewares/auth.middleware";
import { preventiveMaintenanceController } from "./preventive-maintenance.controller";

const preventiveMaintenanceRouter = Router();

preventiveMaintenanceRouter.get("/", requireAuth, preventiveMaintenanceController.list);
preventiveMaintenanceRouter.get("/weather-impact/:location", requireAuth, preventiveMaintenanceController.weatherImpact);

export { preventiveMaintenanceRouter };
