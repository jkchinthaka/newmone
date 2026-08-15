import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Apply Nest throttling to HTTP only. WebSocket gateways use their own
 * connection lifecycle and must not be blocked by this HTTP abuse guard.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") {
      return true;
    }
    return super.shouldSkip(context);
  }
}
