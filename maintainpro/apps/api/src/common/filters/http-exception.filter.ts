import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    const rawMessage =
      typeof exceptionResponse === "string"
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] })?.message ??
          (exception instanceof Error ? exception.message : null) ??
          "Internal server error";

    const errorMessage = Array.isArray(rawMessage) ? rawMessage.join(", ") : rawMessage;

    const details =
      typeof exceptionResponse === "object" && exceptionResponse !== null
        ? ((exceptionResponse as { message?: string[] }).message ?? [])
        : [];

    const requestSummary = `${request.method} ${request.url} -> ${status}`;
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
        code: exception instanceof HttpException ? "HTTP_ERROR" : "INTERNAL_ERROR",
        message: errorMessage,
        details: Array.isArray(details) ? details : [details]
      }
    });
  }
}
