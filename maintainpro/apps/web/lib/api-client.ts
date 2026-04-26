import axios from "axios";
import { clearAuthSession, getAccessToken } from "@/lib/auth-storage";
import { getActiveTenantId, setActiveTenantId } from "@/lib/tenant-context";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api",
  timeout: 15_000
});

function isAuthMeRequest(url?: string): boolean {
  return url === "/auth/me" || url?.endsWith("/auth/me") === true;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  const tenantId = getActiveTenantId();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId && !isAuthMeRequest(config.url)) {
    config.headers["X-Tenant-Id"] = tenantId;
  } else if (isAuthMeRequest(config.url) && config.headers) {
    delete (config.headers as Record<string, unknown>)["X-Tenant-Id"];
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.error?.message ?? "").toLowerCase();

    if (typeof window !== "undefined" && status === 403 && message.includes("tenant access denied")) {
      setActiveTenantId(null);
    }

    if (typeof window !== "undefined" && status === 401) {
      clearAuthSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?reason=session_expired";
      }
    }

    return Promise.reject(error);
  }
);
