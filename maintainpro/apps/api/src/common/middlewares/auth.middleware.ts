import type { RequestHandler } from "express";

import { AppError } from "../errors/AppError";
import { verifyAccessToken } from "../utils/jwt";

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Authorization header with Bearer token is required", 401));
  }

  const token = header.replace("Bearer ", "").trim();

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(new AppError("Invalid or expired access token", 401));
  }
};
