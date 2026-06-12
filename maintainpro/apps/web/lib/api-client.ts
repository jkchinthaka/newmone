import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { apiBaseUrl } from "@/lib/api-url";
import { clearAuthSession, getAccessToken, setAccessToken } from "@/lib/auth-storage";
import { getActiveTenantId, setActiveTenantId } from "@/lib/tenant-context";

const DEFAULT_API_TIMEOUT_MS = 60_000;
const CSRF_COOKIE_KEY = "maintainpro_csrf";
const CSRF_HEADER = "X-CSRF-Token";

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

function isAuthRequest(url?: string): boolean {
  const path = url?.split("?")[0] ?? "";
  return path === "/auth" || path.startsWith("/auth/") || path.includes("/api/auth/");
}

function readCookie(name: string): string | null {
  if (typeof window === "undefined") return null;
  const header = document.cookie;
  if (!header) return null;

  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function getCsrfTokenFromCookie(): string | null {
  return readCookie(CSRF_COOKIE_KEY);
}

function attachCsrfHeader(config: InternalAxiosRequestConfig): void {
  const method = (config.method ?? "get").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return;
  }

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    config.headers[CSRF_HEADER] = csrfToken;
  }
}

function handleSessionExpiredRedirect() {
  clearAuthSession();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login?reason=session_expired";
  }
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

async function attemptAccessTokenRefresh(): Promise<boolean> {
  const csrfToken = getCsrfTokenFromCookie();
  if (!csrfToken) {
    return false;
  }

  try {
    const response = await apiClient.post(
      "/auth/refresh",
      {},
      {
        headers: {
          [CSRF_HEADER]: csrfToken
        }
      }
    );
    const nextAccessToken = response?.data?.data?.accessToken;
    if (typeof nextAccessToken !== "string" || nextAccessToken.trim().length === 0) {
      return false;
    }

    setAccessToken(nextAccessToken);
    return true;
  } catch {
    return false;
  }
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tenantId = getActiveTenantId();
  const accessToken = getAccessToken();
  config.headers = config.headers ?? {};

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else {
    delete (config.headers as Record<string, unknown>).Authorization;
  }

  if (tenantId && !isAuthRequest(config.url)) {
    config.headers["X-Tenant-Id"] = tenantId;
  } else {
    delete (config.headers as Record<string, unknown>)["X-Tenant-Id"];
  }

  attachCsrfHeader(config);

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error?.response?.status;
    const message = String((error.response?.data as { error?: { message?: string } } | undefined)?.error?.message ?? "").toLowerCase();
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (typeof window !== "undefined" && status === 403 && message.includes("tenant access denied")) {
      setActiveTenantId(null);
    }

    if (
      typeof window !== "undefined" &&
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest(originalRequest.url)
    ) {
      originalRequest._retry = true;
      const refreshed = await attemptAccessTokenRefresh();
      if (refreshed) {
        return apiClient(originalRequest);
      }
    }

    if (typeof window !== "undefined" && status === 401) {
      handleSessionExpiredRedirect();
    }

    return Promise.reject(error);
  }
);
