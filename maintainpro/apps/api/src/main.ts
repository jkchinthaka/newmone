import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { isAuthorizedForReadiness } from "./bootstrap/readiness-guard";
import {
  shouldProtectSwaggerWithBasicAuth,
  shouldSetupSwagger,
  verifySwaggerBasicAuth
} from "./bootstrap/swagger-guard";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { getAccessJwtSecret } from "./config/jwt-secrets";
import { HealthService } from "./health.service";
import { QueueHealthService } from "./modules/queues/queue-health.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true
  });

  const configuredOrigins = [process.env.CORS_ORIGIN, process.env.FRONTEND_URL]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const allowedOrigins = Array.from(
    new Set(["http://localhost:3001", "http://localhost:5173", ...configuredOrigins])
  );

  app.use(helmet());

  // Development environments frequently run frontends from dynamic hosts
  // (localhost ports, Cloudflare Workers previews, etc.), so only enforce a
  // strict origin allowlist in production.
  const isProd = process.env.NODE_ENV === "production";

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (!isProd) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Tenant-Id",
      "X-CSRF-Token",
      "X-Request-Id",
      "Idempotency-Key",
      "Stripe-Signature"
    ]
  });

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const healthService = app.get(HealthService);
  const queueHealthService = app.get(QueueHealthService);
  const configService = app.get(ConfigService);

  process.on("unhandledRejection", (reason: unknown) => {
    if (queueHealthService.captureBootstrapRedisError("unhandledRejection", reason)) {
      return;
    }
    // eslint-disable-next-line no-console
    console.error("[bootstrap] Unhandled rejection:", reason);
  });

  process.on("uncaughtException", (err: Error) => {
    if (queueHealthService.captureBootstrapRedisError("uncaughtException", err)) {
      return;
    }
    // eslint-disable-next-line no-console
    console.error("[bootstrap] Uncaught exception:", err);
  });

  type ExpressRequest = {
    headers: Record<string, string | string[] | undefined>;
  };
  type ExpressResponse = {
    status: (code: number) => ExpressResponse;
    json: (body: unknown) => void;
    set: (field: string, value: string) => ExpressResponse;
  };
  const express = app.getHttpAdapter().getInstance() as {
    get: (path: string, handler: (req: ExpressRequest, res: ExpressResponse) => void | Promise<void>) => void;
    use: (path: string | string[], handler: (req: ExpressRequest, res: ExpressResponse, next: () => void) => void) => void;
  };

  express.get("/", async (_req, res) => {
    res.json({
      data: await healthService.getPublicHealth(),
      message: "MaintainPro API is running"
    });
  });

  express.get("/health", async (_req, res) => {
    res.json({
      data: await healthService.getPublicHealth(),
      message: "Health check passed"
    });
  });

  // Detailed readiness exposes dependency/configuration internals (DB replication
  // status, which third-party integrations are configured, etc.) and must not be
  // public in production. Allow either an ADMIN/SUPER_ADMIN bearer token or a
  // shared READINESS_API_KEY (for uptime/infra monitoring that can't hold a JWT).
  const readinessApiKey = process.env.READINESS_API_KEY;
  const accessJwtSecret = getAccessJwtSecret(configService);

  express.get("/health/readiness", async (req, res) => {
    if (!isAuthorizedForReadiness(req.headers, { isProd, accessJwtSecret, readinessApiKey })) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json({
      data: await healthService.getReadiness(),
      message: "Readiness check completed"
    });
  });

  // Swagger is always available outside production. In production it is opt-in via
  // SWAGGER_ENABLED=true and protected by HTTP Basic Auth (SWAGGER_USER/SWAGGER_PASSWORD).
  const swaggerOptions = {
    isProd,
    swaggerEnabled: process.env.SWAGGER_ENABLED === "true",
    swaggerUser: process.env.SWAGGER_USER,
    swaggerPassword: process.env.SWAGGER_PASSWORD
  };

  if (shouldSetupSwagger(swaggerOptions)) {
    if (shouldProtectSwaggerWithBasicAuth(swaggerOptions)) {
      express.use(["/api/docs", "/api/docs-json"], (req, res, next) => {
        if (
          verifySwaggerBasicAuth(
            req.headers.authorization,
            swaggerOptions.swaggerUser as string,
            swaggerOptions.swaggerPassword as string
          )
        ) {
          next();
          return;
        }

        res.set("WWW-Authenticate", "Basic realm=\"API Docs\"").status(401).json({ message: "Unauthorized" });
      });
    }

    const config = new DocumentBuilder()
      .setTitle("MaintainPro API")
      .setDescription("Enterprise Asset, Fleet, Service, and Utility Management API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();

    try {
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup("api/docs", app, document);
    } catch (err) {
      // Don't let Swagger introspection errors crash the API at boot.
      // eslint-disable-next-line no-console
      console.warn("[Swagger] Skipped doc generation:", (err as Error).message);
    }
  } else if (isProd && swaggerOptions.swaggerEnabled) {
    // eslint-disable-next-line no-console
    console.warn("[Swagger] SWAGGER_ENABLED=true but SWAGGER_USER/SWAGGER_PASSWORD are not set — Swagger disabled.");
  }

  const port = Number(process.env.PORT ?? 3000);
  // Bind to 0.0.0.0 so both IPv4 (127.0.0.1) and IPv6 (::1) clients can connect.
  // On Windows, defaulting to "::" can refuse IPv4 connections from browsers
  // that resolve "localhost" to 127.0.0.1, causing ERR_CONNECTION_REFUSED.
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen(port, host);
}

bootstrap();
