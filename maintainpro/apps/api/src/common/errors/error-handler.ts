import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AppError } from "./AppError";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: error.errors
    });
  }

  if (error instanceof AppError) {
    if (!error.isOperational || env.NODE_ENV !== "production") {
      logger.error(error.stack ?? error.message);
    }

    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  logger.error(error instanceof Error ? error.stack ?? error.message : String(error));

  return res.status(500).json({
    success: false,
    message: "Internal server error"
  });
};
