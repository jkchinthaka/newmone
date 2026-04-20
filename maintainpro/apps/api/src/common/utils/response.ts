import type { Response } from "express";

export const sendSuccess = <T>(
  res: Response,
  payload: T,
  message = "OK",
  statusCode = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data: payload
  });
};
