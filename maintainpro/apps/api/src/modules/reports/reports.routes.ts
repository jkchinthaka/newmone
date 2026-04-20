import { Router } from "express";

import { requireAuth } from "../../common/middlewares/auth.middleware";
import { reportsController } from "./reports.controller";

const reportsRouter = Router();

reportsRouter.post("/queue", requireAuth, reportsController.queueReport);
reportsRouter.post("/ai-summary", requireAuth, reportsController.aiSummary);

export { reportsRouter };
