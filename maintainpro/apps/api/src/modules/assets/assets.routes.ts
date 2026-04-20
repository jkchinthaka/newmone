import multer from "multer";
import { Router } from "express";

import { requireAuth } from "../../common/middlewares/auth.middleware";
import { assetsController } from "./assets.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const assetsRouter = Router();

assetsRouter.get("/", requireAuth, assetsController.list);
assetsRouter.post("/", requireAuth, assetsController.create);
assetsRouter.post("/upload", requireAuth, upload.single("file"), assetsController.uploadImage);

export { assetsRouter };
