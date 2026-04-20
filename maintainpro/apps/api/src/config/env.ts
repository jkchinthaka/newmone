import "dotenv/config";

import { z } from "zod";

const durationPattern = /^\d+[smhd]$/;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(24),
  JWT_REFRESH_SECRET: z.string().min(24),
  JWT_ACCESS_EXPIRES: z.string().regex(durationPattern, "Use duration format like 15m or 1h"),
  JWT_REFRESH_EXPIRES: z.string().regex(durationPattern, "Use duration format like 7d or 30d"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_ID: z.string().regex(/^\d+$/, "WHATSAPP_PHONE_ID must contain only digits"),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  WEATHER_API_KEY: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(3),
  FRONTEND_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formattedErrors = parsed.error.errors
    .map((error) => `${error.path.join(".")}: ${error.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${formattedErrors}`);
}

const parsedCorsOrigins = parsed.data.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const env = {
  ...parsed.data,
  FIREBASE_PRIVATE_KEY: parsed.data.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  CORS_ORIGIN: parsedCorsOrigins
} as const;

export type AppEnv = typeof env;
