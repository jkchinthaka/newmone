import { RoleName } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleName;
  permissions?: string[];
  tenantId?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
