import { Router } from "express";

import { requireAuth } from "../../common/middlewares/auth.middleware";
import { dashboardController } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/overview", requireAuth, dashboardController.overview);

export { dashboardRouter };
