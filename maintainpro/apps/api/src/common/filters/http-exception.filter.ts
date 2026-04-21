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

    const errorMessage =
      typeof exceptionResponse === "string"
        ? exceptionResponse
        : (exceptionResponse as { message?: string })?.message ?? "Internal server error";

    const details =
      typeof exceptionResponse === "object" && exceptionResponse !== null
        ? ((exceptionResponse as { message?: string[] }).message ?? [])
        : [];

    this.logger.error(`${request.method} ${request.url} -> ${status}`, exception instanceof Error ? exception.stack : "");

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
