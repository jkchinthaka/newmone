import type { RequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../../common/errors/AppError";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/response";
import { assetsService } from "./assets.service";

const createAssetBodySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  location: z.string().min(2),
  status: z.enum(["active", "inactive", "maintenance"]),
  imageUrl: z.string().url().optional()
});

const list: RequestHandler = (_req, res) => {
  return sendSuccess(res, assetsService.listAssets(), "Assets fetched");
};

const create: RequestHandler = asyncHandler(async (req, res) => {
  const payload = createAssetBodySchema.parse(req.body);
  const created = assetsService.createAsset(payload);

  return sendSuccess(res, created, "Asset created", 201);
});

const uploadImage: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("File is required", 400);
  }

  const imageUrl = await assetsService.uploadAssetImage(req.file.buffer, req.file.originalname);

  return sendSuccess(res, { imageUrl }, "Asset image uploaded");
});

export const assetsController = {
  list,
  create,
  uploadImage
};
