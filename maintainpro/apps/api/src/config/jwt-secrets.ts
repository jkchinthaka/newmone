import { InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

function readSecret(configService: ConfigService, keys: string[]): string {
  for (const key of keys) {
    const value = configService.get<string>(key);
    if (value?.trim()) {
      return value;
    }
  }

  if (configService.get<string>("NODE_ENV") !== "production") {
    return "dev-jwt-secret-change-me";
  }

  throw new InternalServerErrorException("JWT secret is not configured");
}

export function getAccessJwtSecret(configService: ConfigService): string {
  return readSecret(configService, ["JWT_ACCESS_SECRET", "JWT_SECRET"]);
}

export function getRefreshJwtSecret(configService: ConfigService): string {
  return readSecret(configService, ["JWT_REFRESH_SECRET", "JWT_SECRET"]);
}