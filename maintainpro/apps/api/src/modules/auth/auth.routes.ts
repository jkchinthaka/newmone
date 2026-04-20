import { Router } from "express";

import { validate } from "../../common/middlewares/validate.middleware";
import { authController } from "./auth.controller";
import { loginSchema, registerSchema, setupMfaSchema, verifyMfaSchema } from "./auth.schemas";

const authRouter = Router();

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a user
 *     responses:
 *       201:
 *         description: User registered
 */
authRouter.post("/register", validate(registerSchema), authController.register);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: User login
 *     responses:
 *       200:
 *         description: Login successful
 */
authRouter.post("/login", validate(loginSchema), authController.login);
authRouter.post("/mfa/setup", validate(setupMfaSchema), authController.setupMfa);
authRouter.post("/mfa/verify", validate(verifyMfaSchema), authController.verifyMfa);

export { authRouter };
