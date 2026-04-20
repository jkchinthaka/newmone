import { Router } from "express";

import { requireAuth } from "../../common/middlewares/auth.middleware";
import { inventoryController } from "./inventory.controller";

const inventoryRouter = Router();

inventoryRouter.get("/", requireAuth, inventoryController.list);
inventoryRouter.post("/", requireAuth, inventoryController.create);
inventoryRouter.get("/low-stock", requireAuth, inventoryController.lowStock);

export { inventoryRouter };
