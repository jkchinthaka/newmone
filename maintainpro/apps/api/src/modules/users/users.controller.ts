import type { RequestHandler } from "express";

import { AppError } from "../../common/errors/AppError";
import { sendSuccess } from "../../common/utils/response";
import { usersService } from "./users.service";

const list: RequestHandler = (_req, res) => {
  return sendSuccess(res, usersService.listUsers(), "Users fetched");
};

const me: RequestHandler = (req, res, next) => {
  if (!req.user) {
    return next(new AppError("User context missing", 401));
  }

  const profile = usersService.getById(req.user.sub);

  if (!profile) {
    return next(new AppError("User not found", 404));
  }

  return sendSuccess(res, profile, "Profile fetched");
};

export const usersController = {
  list,
  me
};
