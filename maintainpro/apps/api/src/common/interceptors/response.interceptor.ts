import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        const payload = value as { data?: unknown; message?: string; meta?: PaginationMeta };

        return {
          success: true,
          data: (payload?.data as T) ?? (value as T),
          message: payload?.message ?? "Operation successful",
          meta: payload?.meta
        };
      })
    );
  }
}
