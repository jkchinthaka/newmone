import { User } from "@maintainpro/shared-types";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
}
