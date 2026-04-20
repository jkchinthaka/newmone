import { Router } from "express";

import { requireAuth } from "../../common/middlewares/auth.middleware";
import { workOrdersController } from "./work-orders.controller";

const workOrdersRouter = Router();

workOrdersRouter.get("/", requireAuth, workOrdersController.list);
workOrdersRouter.post("/", requireAuth, workOrdersController.create);

export { workOrdersRouter };
