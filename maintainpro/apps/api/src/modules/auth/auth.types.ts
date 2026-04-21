import { RoleName } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleName;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
