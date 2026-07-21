import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

import { requestContext } from "../context/request-context";

const STATUS_ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "VALIDATION_ERROR",
  [HttpStatus.UNAUTHORIZED]: "AUTHENTICATION_REQUIRED",
  [HttpStatus.FORBIDDEN]: "PERMISSION_DENIED",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "VALIDATION_ERROR",
  [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
  [HttpStatus.SERVICE_UNAVAILABLE]: "DEPENDENCY_UNAVAILABLE"
};

function mapErrorCode(status: number, message: string, dependencyFailure: boolean): string {
  if (dependencyFailure) {
    return "DATABASE_UNAVAILABLE";
  }

  const lower = message.toLowerCase();
  if (lower.includes("csrf")) return "CSRF_INVALID";
  if (lower.includes("session") && lower.includes("expired")) return "SESSION_EXPIRED";
  if (lower.includes("refresh token") && lower.includes("reus")) return "REFRESH_TOKEN_REUSED";
  if (lower.includes("tenant required") || lower.includes("no active tenant")) return "TENANT_REQUIRED";
  if (lower.includes("tenant access denied")) return "TENANT_ACCESS_DENIED";
  if (lower.includes("tenant") && lower.includes("inactive")) return "TENANT_INACTIVE";
  if (lower.includes("membership") && lower.includes("disabled")) return "MEMBERSHIP_DISABLED";
  if (lower.includes("duplicate")) return "DUPLICATE_RECORD";
  if (lower.includes("invalid state") || lower.includes("transition")) return "INVALID_STATE_TRANSITION";

  return STATUS_ERROR_CODES[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "HTTP_ERROR");
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const dependencyFailure = this.isDependencyFailure(exception);
    const status = dependencyFailure
      ? HttpStatus.SERVICE_UNAVAILABLE
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    const rawMessage =
      typeof exceptionResponse === "string"
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] })?.message ??
          (exception instanceof Error ? exception.message : null) ??
          "Internal server error";

    const errorMessage = dependencyFailure
      ? "Database unavailable. Please retry later."
      : Array.isArray(rawMessage)
        ? rawMessage.join(", ")
        : rawMessage;

    const details =
      typeof exceptionResponse === "object" && exceptionResponse !== null
        ? ((exceptionResponse as { message?: string[] }).message ?? [])
        : [];

    const fieldErrors =
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null &&
      typeof (exceptionResponse as { fieldErrors?: unknown }).fieldErrors === "object"
        ? ((exceptionResponse as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? undefined)
        : undefined;

    const requestId =
      request.requestId ??
      requestContext.getRequestId() ??
      (typeof response.getHeader("X-Request-Id") === "string"
        ? String(response.getHeader("X-Request-Id"))
        : null);

    if (requestId) {
      response.setHeader("X-Request-Id", requestId);
    }

    const code = mapErrorCode(status, errorMessage, dependencyFailure);
    const requestSummary = `${request.method} ${request.url} -> ${status} code=${code} requestId=${requestId ?? "none"}`;
    const isSessionProbe = request.method === "GET" && request.url.startsWith("/api/auth/me");

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(requestSummary, exception instanceof Error ? exception.stack : "");
    } else if (isSessionProbe && (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN)) {
      this.logger.debug(`${requestSummary} ${errorMessage}`);
    } else {
      this.logger.warn(`${requestSummary} ${errorMessage}`);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message: errorMessage,
        details: dependencyFailure
          ? ["MongoDB or Prisma dependency is not reachable."]
          : Array.isArray(details)
            ? details
            : [details],
        ...(fieldErrors ? { fieldErrors } : {}),
        requestId: requestId ?? undefined
      }
    });
  }

  private isDependencyFailure(exception: unknown): boolean {
    if (exception instanceof HttpException) {
      return false;
    }

    const message = exception instanceof Error ? exception.message : String(exception ?? "");
    const name = exception instanceof Error ? exception.name : "";

    return /Prisma|Mongo|ReplicaSetNoPrimary|Server selection|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|P1001|P6001/i.test(
      `${name} ${message}`
    );
  }
}