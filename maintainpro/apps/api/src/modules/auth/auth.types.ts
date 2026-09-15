import { RoleName } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleName | string;
  permissions?: string[];
  tenantId?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
