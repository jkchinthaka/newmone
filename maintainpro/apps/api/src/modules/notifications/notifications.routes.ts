import { Router } from "express";

import { requireAuth } from "../../common/middlewares/auth.middleware";
import { notificationsController } from "./notifications.controller";

const notificationsRouter = Router();

notificationsRouter.post("/send", requireAuth, notificationsController.send);

export { notificationsRouter };
