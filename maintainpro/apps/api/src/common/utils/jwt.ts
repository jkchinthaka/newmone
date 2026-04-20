import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../../config/env";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export const createTokenPair = (payload: AuthTokenPayload): { accessToken: string; refreshToken: string } => {
  const accessTokenOptions: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions["expiresIn"]
  };

  const refreshTokenOptions: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions["expiresIn"]
  };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...accessTokenOptions
  });

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    ...refreshTokenOptions
  });

  return {
    accessToken,
    refreshToken
  };
};

export const verifyAccessToken = (token: string): AuthTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthTokenPayload;
};
