import { Router } from "express";

import { requireAuth } from "../../common/middlewares/auth.middleware";
import { usersController } from "./users.controller";

const usersRouter = Router();

usersRouter.get("/", requireAuth, usersController.list);
usersRouter.get("/me", requireAuth, usersController.me);

export { usersRouter };
