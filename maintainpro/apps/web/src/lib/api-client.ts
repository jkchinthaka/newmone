import axios from "axios";

import { useAuthStore } from "@/store/auth.store";

import { webEnv } from "./env";

export const apiClient = axios.create({
  baseURL: webEnv.VITE_API_BASE_URL,
  timeout: 15000,
  withCredentials: false
});

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().tokens?.accessToken;

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});
