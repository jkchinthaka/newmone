import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Apply Nest throttling to HTTP only. WebSocket gateways use their own
 * connection lifecycle and must not be blocked by this HTTP abuse guard.
 *
 * Disposable E2E shares one CI egress IP across many persona logins; keep
 * production limits intact and skip abuse throttling only when E2E_TEST_MODE=true.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") {
      return true;
    }
    if ((process.env.E2E_TEST_MODE || "").trim() === "true") {
      return true;
    }
    return super.shouldSkip(context);
  }
}
