import { ApiResponse } from "@maintainpro/shared-types";

import { apiClient } from "@/lib/api-client";

import { AuthSession, LoginRequest } from "./types";

export const loginRequest = async (payload: LoginRequest): Promise<AuthSession> => {
  const response = await apiClient.post<ApiResponse<AuthSession>>("/auth/login", payload);
  return response.data.data;
};
