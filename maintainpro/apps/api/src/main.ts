import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { HealthService } from "./health.service";

// Swallow Redis/ioredis connection errors so a missing Redis doesn't crash the API.
// Queue operations are wrapped in try/catch and degrade gracefully.
process.on("unhandledRejection", (reason: unknown) => {
  const err = reason as { code?: string; message?: string } | undefined;
  if (err && (err.code === "ECONNREFUSED" || /ECONNREFUSED|Redis|ioredis/i.test(err.message ?? ""))) {
    // eslint-disable-next-line no-console
    console.warn("[bootstrap] Suppressed Redis connection error:", err.message ?? err.code);
    return;
  }
  // eslint-disable-next-line no-console
  console.error("[bootstrap] Unhandled rejection:", reason);
});

process.on("uncaughtException", (err: Error & { code?: string }) => {
  if (err && (err.code === "ECONNREFUSED" || /ECONNREFUSED|Redis|ioredis/i.test(err.message ?? ""))) {
    // eslint-disable-next-line no-console
    console.warn("[bootstrap] Suppressed Redis uncaught exception:", err.message);
    return;
  }
  // eslint-disable-next-line no-console
  console.error("[bootstrap] Uncaught exception:", err);
});

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
  const express = app.getHttpAdapter().getInstance() as {
    get: (path: string, handler: (_req: unknown, res: { json: (body: unknown) => void }) => void | Promise<void>) => void;
  };

  express.get("/health", async (_req, res) => {
    res.json({
      data: await healthService.getPublicHealth(),
      message: "Health check passed"
    });
  });

  express.get("/health/readiness", async (_req, res) => {
    res.json({
      data: await healthService.getReadiness(),
      message: "Readiness check completed"
    });
  });

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

  const port = Number(process.env.PORT ?? 3000);
  // Bind to 0.0.0.0 so both IPv4 (127.0.0.1) and IPv6 (::1) clients can connect.
  // On Windows, defaulting to "::" can refuse IPv4 connections from browsers
  // that resolve "localhost" to 127.0.0.1, causing ERR_CONNECTION_REFUSED.
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen(port, host);
}

bootstrap();
