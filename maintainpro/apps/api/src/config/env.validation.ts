import Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default("http://localhost:3001"),
  FRONTEND_URL: Joi.string().uri().default("http://localhost:3001"),
  DATABASE_PROVIDER: Joi.string().valid("mongodb").default("mongodb"),
  PRIMARY_DATABASE_URL: Joi.string().allow(""),
  BACKUP_DATABASE_URL: Joi.string().allow(""),
  PRIMARY_DATABASE_NAME: Joi.string().allow("").default("nelna"),
  BACKUP_DATABASE_NAME: Joi.string().allow("").default("bileeta_db"),
  DATABASE_SERVER_SELECTION_TIMEOUT_MS: Joi.number().integer().min(500).default(5000),
  DATABASE_CONNECT_TIMEOUT_MS: Joi.number().integer().min(500).default(5000),
  DATABASE_REPLICATION_ENABLED: Joi.boolean().default(true),
  DATABASE_REPLICATION_MODE: Joi.string()
    .valid("async_outbox", "strict_dual_write", "disabled")
    .default("async_outbox"),
  DATABASE_REPLICATION_RETRY_ATTEMPTS: Joi.number().integer().min(1).default(5),
  DATABASE_REPLICATION_RETRY_DELAY_MS: Joi.number().integer().min(250).default(5000),
  DATABASE_REPLICATION_BATCH_SIZE: Joi.number().integer().min(1).default(100),
  BACKUP_DATABASE_REQUIRED_FOR_READINESS: Joi.boolean().default(false),
  BACKUP_DATABASE_REQUIRED_FOR_STRICT_MODE: Joi.boolean().default(true),
  MONGO_DATABASE_NAME: Joi.string().allow(""),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().empty("").default(""),
  REDIS_REQUIRED_FOR_READINESS: Joi.boolean().default(false),
  REDIS_REQUIRED_IN_PRODUCTION: Joi.boolean().default(true),
  ALLOW_MOCK_IN_PRODUCTION: Joi.boolean().default(false),
  ERP_MODE: Joi.string().valid("disabled", "mock", "live").default("mock"),
  BILLING_MODE: Joi.string().valid("disabled", "mock", "live").default("mock"),
  EMAIL_MODE: Joi.string().valid("disabled", "live").default("disabled"),
  SMS_MODE: Joi.string().valid("disabled", "mock", "live").default("disabled"),
  PUSH_MODE: Joi.string().valid("disabled", "mock", "live").default("disabled"),
  STORAGE_MODE: Joi.string()
    .valid("local", "r2", "s3", "minio", "cloudinary")
    .default("local"),
  MONGODB_URI: Joi.string().allow(""),
  MONGO_SYNC_ON_STARTUP: Joi.boolean().default(false),
  MAINTAINPRO_SEED_PASSWORD: Joi.string().allow(""),
  MAINTAINPRO_SMOKE_EMAIL: Joi.string().allow(""),
  MAINTAINPRO_SMOKE_PASSWORD: Joi.string().allow(""),
  JWT_SECRET: Joi.string().empty(""),
  JWT_ACCESS_SECRET: Joi.string().empty(""),
  JWT_REFRESH_SECRET: Joi.string().empty(""),
  JWT_ACCESS_EXPIRES: Joi.string().default("15m"),
  JWT_REFRESH_EXPIRES: Joi.string().default("7d"),
  ALLOW_PUBLIC_REGISTRATION: Joi.boolean().default(false),
  ALLOW_PUBLIC_REGISTRATION_IN_PRODUCTION: Joi.boolean().default(false),
  STRIPE_SECRET_KEY: Joi.string().allow(""),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow(""),
  GOOGLE_CLIENT_ID: Joi.string().allow(""),
  GOOGLE_CLIENT_SECRET: Joi.string().allow(""),
  GOOGLE_CALLBACK_URL: Joi.string().allow(""),
  RAPIDAPI_GOOGLE_MAP_PLACES_KEY: Joi.string().allow(""),
  SENDGRID_API_KEY: Joi.string().allow(""),
  SMTP_ENABLED: Joi.boolean().default(false),
  SMTP_HOST: Joi.string().allow(""),
  SMTP_PORT: Joi.number().allow(""),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow(""),
  SMTP_PASS: Joi.string().allow(""),
  SMTP_FROM: Joi.string().allow(""),
  SMS_ENABLED: Joi.boolean().default(false),
  SMS_API_URL: Joi.string().allow(""),
  SMS_API_KEY: Joi.string().allow(""),
  SMS_API_SECRET: Joi.string().allow(""),
  SMS_AUTH_HEADER: Joi.string().default("Authorization"),
  SMS_SENDER_ID: Joi.string().allow(""),
  TWILIO_ACCOUNT_SID: Joi.string().allow(""),
  TWILIO_AUTH_TOKEN: Joi.string().allow(""),
  TWILIO_PHONE_NUMBER: Joi.string().allow(""),
  ERP_SYNC_PROVIDER: Joi.string().valid("mock", "http", "real").default("mock"),
  ERP_SYNC_ALLOW_MOCK_IN_PRODUCTION: Joi.boolean().default(false),
  ERP_SYNC_REQUIRED_FOR_READINESS: Joi.boolean().default(false),
  ERP_PROVIDER_ID: Joi.string().allow(""),
  ERP_API_URL: Joi.string().allow(""),
  ERP_BASE_URL: Joi.string().allow(""),
  ERP_API_KEY: Joi.string().allow(""),
  ERP_AUTH_HEADER: Joi.string().default("Authorization"),
  ERP_TIMEOUT_MS: Joi.number().default(15000),
  PUSH_PROVIDER: Joi.string().default("noop"),
  PUSH_PROVIDER_ENABLED: Joi.boolean().default(false),
  PUSH_PROVIDER_API_URL: Joi.string().allow(""),
  PUSH_PROVIDER_API_KEY: Joi.string().allow(""),
  PUSH_PROVIDER_AUTH_HEADER: Joi.string().default("Authorization"),
  RAPIDAPI_COPILOT_API_KEY: Joi.string().allow(""),
  RAPIDAPI_COPILOT_HOST: Joi.string().default("copilot5.p.rapidapi.com"),
  RAPIDAPI_QR_CODE_API_KEY: Joi.string().allow(""),
  RAPIDAPI_QR_CODE_HOST: Joi.string().default(
    "simple-qr-code-generator-cheap-and-efficient.p.rapidapi.com"
  ),
  RAPIDAPI_QR_CODE_COLOR: Joi.string().allow(""),
  RAPIDAPI_QR_CODE_BG_COLOR: Joi.string().allow(""),
  CLOUDINARY_CLOUD_NAME: Joi.string().allow(""),
  CLOUDINARY_API_KEY: Joi.string().allow(""),
  CLOUDINARY_API_SECRET: Joi.string().allow(""),
  CLOUDINARY_ASSET_FOLDER: Joi.string().default("maintainpro/asset-documents"),
  OBJECT_STORAGE_REQUIRED_FOR_READINESS: Joi.boolean().default(false),
  MINIO_ENDPOINT: Joi.string().allow(""),
  MINIO_PORT: Joi.number().allow("").default(9000),
  MINIO_USE_SSL: Joi.boolean().default(false),
  MINIO_ACCESS_KEY: Joi.string().allow(""),
  MINIO_SECRET_KEY: Joi.string().allow(""),
  MINIO_BUCKET: Joi.string().allow(""),
  SWAGGER_ENABLED: Joi.boolean().default(false),
  SWAGGER_USER: Joi.string().allow(""),
  SWAGGER_PASSWORD: Joi.string().allow(""),
  READINESS_API_KEY: Joi.string().allow(""),
  ALLOW_FACILITY_BACKFILL_APPLY: Joi.boolean().default(false),
  DUPLICATE_ISSUE_WINDOW_DAYS: Joi.number().integer().min(1).max(90).default(7)
})
  .custom((value, helpers) => {
    const nodeEnv = String(value.NODE_ENV ?? "development");
    const redisUrl = String(value.REDIS_URL ?? "").trim();
    const redisRequiredInProduction = Boolean(value.REDIS_REQUIRED_IN_PRODUCTION);
    const allowMockInProduction = Boolean(value.ALLOW_MOCK_IN_PRODUCTION);

    if (nodeEnv === "production" && redisRequiredInProduction && redisUrl.length === 0) {
      return helpers.error("any.invalid", {
        message: "REDIS_URL must be configured in production when REDIS_REQUIRED_IN_PRODUCTION=true"
      });
    }

    const mockModes = [
      ["ERP_MODE", value.ERP_MODE],
      ["BILLING_MODE", value.BILLING_MODE],
      ["SMS_MODE", value.SMS_MODE],
      ["PUSH_MODE", value.PUSH_MODE]
    ].filter(([, mode]) => String(mode) === "mock");

    if (nodeEnv === "production" && !allowMockInProduction && mockModes.length > 0) {
      return helpers.error("any.invalid", {
        message: `Mock integration modes are blocked in production. Set ALLOW_MOCK_IN_PRODUCTION=true only for controlled temporary operation. Offending keys: ${mockModes.map(([key]) => key).join(", ")}`
      });
    }

    const requireKeys = (modeKey: string, mode: unknown, keys: string[]) => {
      if (String(mode) !== "live") return;
      const missing = keys.filter((key) => String(value[key] ?? "").trim().length === 0);
      if (missing.length > 0) {
        return helpers.error("any.invalid", {
          message: `${modeKey}=live requires: ${missing.join(", ")}`
        });
      }
    };

    const errors = [
      requireKeys("ERP_MODE", value.ERP_MODE, ["ERP_API_URL", "ERP_API_KEY"]),
      requireKeys("BILLING_MODE", value.BILLING_MODE, ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]),
      requireKeys("EMAIL_MODE", value.EMAIL_MODE, ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]),
      requireKeys("SMS_MODE", value.SMS_MODE, ["SMS_API_URL", "SMS_API_KEY", "SMS_SENDER_ID"]),
      requireKeys("PUSH_MODE", value.PUSH_MODE, ["PUSH_PROVIDER_API_URL", "PUSH_PROVIDER_API_KEY"])
    ].filter(Boolean);

    if (errors.length > 0) {
      return errors[0];
    }

    const storageMode = String(value.STORAGE_MODE ?? "local");
    if (storageMode === "cloudinary") {
      const missing = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter(
        (key) => String(value[key] ?? "").trim().length === 0
      );
      if (missing.length > 0) {
        return helpers.error("any.invalid", {
          message: `STORAGE_MODE=cloudinary requires: ${missing.join(", ")}`
        });
      }
    }

    if (storageMode === "minio") {
      const missing = ["MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET"].filter(
        (key) => String(value[key] ?? "").trim().length === 0
      );
      if (missing.length > 0) {
        return helpers.error("any.invalid", {
          message: `STORAGE_MODE=minio requires: ${missing.join(", ")}`
        });
      }
    }

    return value;
  }, "production redis queue requirement")
  .or("JWT_SECRET", "JWT_ACCESS_SECRET")
  .or("JWT_SECRET", "JWT_REFRESH_SECRET")
  .messages({
    "any.invalid": "{{#message}}"
  });
