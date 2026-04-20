import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import { errorHandler } from "./common/errors/error-handler";
import { notFoundMiddleware } from "./common/middlewares/not-found.middleware";
import { apiRateLimiter } from "./common/middlewares/rate-limit.middleware";
import { env } from "./config/env";
import { morganStream } from "./config/logger";
import { swaggerSpec } from "./config/swagger";
import { healthRouter } from "./modules/health/health.routes";
import { apiRouter } from "./routes";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", { stream: morganStream }));
app.use(apiRateLimiter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/health", healthRouter);
app.use("/api/v1", apiRouter);

app.get("/", (_req, res) => {
  res.json({
    name: "MaintainPro API",
    environment: env.NODE_ENV,
    docs: "/api-docs",
    health: "/health"
  });
});

app.use(notFoundMiddleware);
app.use(errorHandler);
