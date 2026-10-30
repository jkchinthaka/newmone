import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { displayJobNumbers, normalizeJobNumberInput } from "../job-number-display";

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
/**
 * Secret columns that must never leave the API, whatever a query happened to include
 * (a full User row has passwordHash; token tables have hashes). Last line of defence:
 * queries should still select public fields only.
 */
export const RESPONSE_SECRET_KEYS = new Set([
  "passwordHash",
  "tokenHash",
  "replacedByTokenHash",
  "secretHash",
  "keyHash"
]);

export function normalizeDecimals(value: unknown): unknown {
  // Job order numbers are stored as WO-… and shown as JO-… (see common/job-number-display.ts).
  if (typeof value === "string") return displayJobNumbers(value);
  if (value === null || typeof value !== "object") return value;
  if (isDecimalLike(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(normalizeDecimals);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (RESPONSE_SECRET_KEYS.has(key)) continue;
    out[key] = normalizeDecimals(entry);
  }
  return out;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    // A job number typed or scanned as JO-… searches and looks up the stored WO-… value.
    if (context.getType() === "http") normalizeJobNumberInput(context.switchToHttp().getRequest());
    return next.handle().pipe(
      map((value) => {
        const payload = value as { data?: unknown; message?: string; meta?: PaginationMeta };

        return {
          success: true,
          data: normalizeDecimals(payload?.data ?? value) as T,
          message: displayJobNumbers(payload?.message ?? "Operation successful"),
          meta: payload?.meta
        };
      })
    );
  }
}
