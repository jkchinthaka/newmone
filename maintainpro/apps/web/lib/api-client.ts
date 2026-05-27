import axios from "axios";
import { apiBaseUrl } from "@/lib/api-url";
import { clearAuthSession, getAccessToken } from "@/lib/auth-storage";
import { getActiveTenantId, setActiveTenantId } from "@/lib/tenant-context";

const DEFAULT_API_TIMEOUT_MS = 60_000;

function readApiTimeoutMs() {
  const parsed = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_API_TIMEOUT_MS;
  return Math.max(5_000, Math.trunc(parsed));
}

export const apiTimeoutMs = readApiTimeoutMs();

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: apiTimeoutMs,
  withCredentials: true
});

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const candidate = error as {
      code?: string;
      message?: string;
      response?: {
        status?: number;
        data?: {
          error?: { code?: string; message?: string | string[] };
          message?: string | string[];
        };
      };
    };

    const rawMessage = candidate.response?.data?.error?.message ?? candidate.response?.data?.message;
    if (Array.isArray(rawMessage) && rawMessage.length > 0) {
      return rawMessage.join(", ");
    }
    if (typeof rawMessage === "string" && rawMessage.trim()) {
      return rawMessage;
    }
    if (!candidate.response && candidate.code === "ERR_NETWORK") {
      return "API is unreachable. Start the MaintainPro API and check the system health page.";
    }
    if (
      candidate.response?.status === 503 ||
      candidate.response?.data?.error?.code === "DATABASE_UNAVAILABLE"
    ) {
      return "API is temporarily unavailable because the database is not reachable. Check the system health page and Render database configuration.";
    }
    if (
      !candidate.response &&
      (candidate.code === "ECONNABORTED" ||
        candidate.code === "ETIMEDOUT" ||
        /timeout/i.test(candidate.message ?? ""))
    ) {
      return `The API request took longer than ${Math.round(apiTimeoutMs / 1000)} seconds. Try again after the API finishes waking up or check the system health page.`;
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
  }

  return fallback;
}

function isAuthMeRequest(url?: string): boolean {
  return url === "/auth/me" || url?.endsWith("/auth/me") === true;
}

apiClient.interceptors.request.use((config) => {
  const tenantId = getActiveTenantId();
  const accessToken = getAccessToken();

  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.headers) {
    delete (config.headers as Record<string, unknown>).Authorization;
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
