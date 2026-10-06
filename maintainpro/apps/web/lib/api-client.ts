import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { apiBaseUrl } from "@/lib/api-url";
import { clearAuthSession } from "@/lib/auth-storage";
import { safeInternalReturnPath } from "@/lib/role-redirect";
import {
  classifyRefreshFailure,
  createRefreshCoordinator,
  shouldRedirectToLogin,
  TRANSIENT_SESSION_ERROR_FLAG,
  type RefreshOutcome
} from "@/lib/session-refresh-policy";
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

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    response?: {
      status?: number;
      data?: { error?: { code?: string } };
    };
  };

  return (
    candidate.response?.status === 503 ||
    candidate.response?.data?.error?.code === "DATABASE_UNAVAILABLE"
  );
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const candidate = error as {
      code?: string;
      message?: string;
      response?: {
        status?: number;
        data?: {
          error?: {
            code?: string;
            message?: string | string[];
            details?: string[];
            fieldErrors?: Record<string, string[]>;
            requestId?: string;
          };
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
    if (isDatabaseUnavailableError(candidate)) {
      return "Database unavailable. Please contact IT or try again shortly.";
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

export function getApiErrorRequestId(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const requestId = (error as { response?: { data?: { error?: { requestId?: string } }; headers?: Record<string, string> } })
    .response?.data?.error?.requestId;
  return typeof requestId === "string" && requestId.trim() ? requestId : null;
}

export type DeploymentRouteFeature = "workforce" | "work-order-assignees" | "work-order-history";

const DEPLOYMENT_ROUTE_MESSAGES: Record<DeploymentRouteFeature, string> = {
  workforce: "Workforce API is not available on the current backend deployment.",
  "work-order-assignees": "Work order assignee API is not available on the current backend deployment.",
  "work-order-history": "Work order history API is not available on the current backend deployment."
};

export function getDeploymentRouteUnavailableMessage(
  error: unknown,
  feature: DeploymentRouteFeature
): string | null {
  if (error && typeof error === "object") {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 404) {
      return DEPLOYMENT_ROUTE_MESSAGES[feature];
    }
  }
  return null;
}

export function getApiErrorMessageForRoute(
  error: unknown,
  feature: DeploymentRouteFeature,
  fallback: string
): string {
  return getDeploymentRouteUnavailableMessage(error, feature) ?? getApiErrorMessage(error, fallback);
}

function normalizeRequestPath(url?: string): string {
  const raw = url?.split("?")[0] ?? "";
  if (!raw) {
    return "";
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      return new URL(raw).pathname.replace(/\/api\/backend(?=\/|$)/, "").replace(/\/api(?=\/|$)/, "") || "/";
    } catch {
      return raw;
    }
  }

  return raw.replace(/\/api\/backend(?=\/|$)/, "").replace(/\/api(?=\/|$)/, "") || raw;
}

function isAuthRequest(url?: string): boolean {
  const path = normalizeRequestPath(url);
  return path === "/auth" || path.startsWith("/auth/");
}

/** Credential endpoints where 401 means invalid input, not an expired session. */
function isCredentialAuthRequest(url?: string): boolean {
  const path = normalizeRequestPath(url);
  return (
    path === "/auth/login" ||
    path === "/auth/register" ||
    path === "/auth/forgot-password" ||
    path === "/auth/reset-password" ||
    path === "/auth/refresh"
  );
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
  if (window.location.pathname.startsWith("/login")) {
    return;
  }
  const current = `${window.location.pathname}${window.location.search}`;
  const returnTo = safeInternalReturnPath(current);
  const params = new URLSearchParams({ reason: "session_expired" });
  if (returnTo) params.set("returnTo", returnTo);
  window.location.href = `/login?${params.toString()}`;
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sentAt?: number;
  _sessionProbe?: boolean;
};

/**
 * One owner for token rotation (QA-MANUAL-001). Concurrent 401s share the in-flight
 * refresh; a 401 for a request sent before a just-completed rotation reuses it instead of
 * rotating again. Failures are classified so only a proven-invalid session logs out.
 */
const refreshCoordinator = createRefreshCoordinator(async (): Promise<RefreshOutcome> => {
  const csrfToken = getCsrfTokenFromCookie();
  try {
    const response = await apiClient.post(
      "/auth/refresh",
      {},
      {
        headers: csrfToken ? { [CSRF_HEADER]: csrfToken } : {}
      }
    );
    return response?.status >= 200 && response?.status < 300 ? "refreshed" : "transient";
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: { code?: string } }>;
    return classifyRefreshFailure(axiosError.response?.status, axiosError.response?.data?.error?.code);
  }
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Independent check: is the current cookie session still accepted by the API? */
async function probeSessionStatus(): Promise<number | undefined> {
  try {
    const response = await apiClient.get("/auth/me", { _sessionProbe: true, _retry: true } as never);
    return response.status;
  } catch (error) {
    return (error as AxiosError).response?.status;
  }
}

function markTransient(error: AxiosError) {
  (error as unknown as Record<string, unknown>)[TRANSIENT_SESSION_ERROR_FLAG] = true;
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tenantId = getActiveTenantId();
  config.headers = config.headers ?? {};

  // Access JWT is HttpOnly via BFF; do not attach from Web Storage.
  delete (config.headers as Record<string, unknown>).Authorization;

  if (tenantId && !isAuthRequest(config.url)) {
    config.headers["X-Tenant-Id"] = tenantId;
  } else {
    delete (config.headers as Record<string, unknown>)["X-Tenant-Id"];
  }

  if (!config.headers["X-Request-Id"] && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    config.headers["X-Request-Id"] = crypto.randomUUID();
  }

  attachCsrfHeader(config);
  (config as RetriableRequestConfig)._sentAt = Date.now();

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error?.response?.status;
    const errorPayload = error.response?.data as
      | { error?: { message?: string; code?: string } }
      | undefined;
    const message = String(errorPayload?.error?.message ?? "").toLowerCase();
    const code = String(errorPayload?.error?.code ?? "").toUpperCase();
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (
      typeof window !== "undefined" &&
      (status === 403 || status === 401) &&
      (message.includes("tenant access denied") ||
        code === "TENANT_ACCESS_DENIED" ||
        code === "TENANT_REQUIRED" ||
        code === "TENANT_INACTIVE" ||
        code === "MEMBERSHIP_DISABLED")
    ) {
      setActiveTenantId(null);
    }

    if (
      typeof window !== "undefined" &&
      status === 401 &&
      originalRequest &&
      !originalRequest._sessionProbe &&
      !isCredentialAuthRequest(originalRequest.url)
    ) {
      if (originalRequest._retry) {
        // Second 401 after a refresh: never loop; leave it to the caller without logout.
        markTransient(error);
        return Promise.reject(error);
      }
      originalRequest._retry = true;
      const outcome = await refreshCoordinator.refresh(originalRequest._sentAt);
      if (outcome === "refreshed") {
        return apiClient(originalRequest);
      }

      if (outcome === "transient") {
        // 409/429/stale CSRF/5xx: the cookies may still be valid (a sibling rotation may
        // have just landed). Retry once after a short pause, and never redirect here.
        await wait(400);
        try {
          return await apiClient(originalRequest);
        } catch (retryError) {
          markTransient(retryError as AxiosError);
          return Promise.reject(retryError);
        }
      }

      // Refresh says invalid. Confirm with an independent probe before logging out.
      const probeStatus = await probeSessionStatus();
      if (probeStatus !== undefined && probeStatus >= 200 && probeStatus < 300) {
        return apiClient(originalRequest);
      }
      if (shouldRedirectToLogin(outcome, probeStatus)) {
        handleSessionExpiredRedirect();
      } else {
        markTransient(error);
      }
    }

    return Promise.reject(error);
  }
);

export { isTransientSessionError } from "@/lib/session-refresh-policy";
