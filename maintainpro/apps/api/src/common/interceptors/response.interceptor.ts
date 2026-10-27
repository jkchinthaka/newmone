import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Prisma } from "@prisma/client";
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

function isDecimalLike(value: object): value is { toNumber: () => number } {
  if (Prisma.Decimal.isDecimal(value)) return true;
  // decimal.js instances from another copy of the library (e.g. a nested node_modules).
  const candidate = value as { toNumber?: unknown; d?: unknown; e?: unknown; s?: unknown };
  return (
    typeof candidate.toNumber === "function" &&
    Array.isArray(candidate.d) &&
    typeof candidate.e === "number" &&
    typeof candidate.s === "number"
  );
}

/**
 * Prisma Decimal columns serialize to JSON strings ("12.50"), which breaks numeric
 * handling on the web. Convert them to numbers once, here. Only plain objects and
 * arrays are walked, so Dates, Buffers and streams pass through untouched.
 */
export function normalizeDecimals(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (isDecimalLike(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(normalizeDecimals);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = normalizeDecimals(entry);
  }
  return out;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        const payload = value as { data?: unknown; message?: string; meta?: PaginationMeta };

        return {
          success: true,
          data: normalizeDecimals(payload?.data ?? value) as T,
          message: payload?.message ?? "Operation successful",
          meta: payload?.meta
        };
      })
    );
  }
}
