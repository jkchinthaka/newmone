import type { RequestHandler } from "express";

import { AppError } from "../../common/errors/AppError";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/response";
import { authService } from "./auth.service";

const register: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return sendSuccess(res, result, "User registered", 201);
});

const login: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return sendSuccess(res, result, "Login successful");
});

const setupMfa: RequestHandler = asyncHandler(async (req, res) => {
  const { email } = req.body as { email: string };
  const result = await authService.setupMfa(email);

  return sendSuccess(res, result, "MFA setup generated");
});

const verifyMfa: RequestHandler = asyncHandler(async (req, res) => {
  const { email, token } = req.body as { email: string; token: string };
  const verified = authService.verifyMfa(email, token);

  if (!verified) {
    throw new AppError("Invalid MFA token", 401);
  }

  return sendSuccess(res, { verified }, "MFA verified");
});

export const authController = {
  register,
  login,
  setupMfa,
  verifyMfa
};
