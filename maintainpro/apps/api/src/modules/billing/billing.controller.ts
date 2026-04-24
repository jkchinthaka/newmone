import { Body, Controller, ForbiddenException, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { BillingService } from "./billing.service";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";

type BillingRequest = {
  user: {
    sub: string;
    tenantId?: string | null;
  };
  tenantId?: string | null;
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
  body?: unknown;
};

@ApiTags("Billing")
@ApiBearerAuth()
@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post("checkout-session")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async checkoutSession(
    @Req() req: BillingRequest,
    @Body() dto: CreateCheckoutSessionDto
  ) {
    const tenantId = req.user.tenantId ?? req.tenantId ?? null;

    if (!tenantId) {
      throw new ForbiddenException("No active tenant selected");
    }

    const data = await this.billingService.createCheckoutSession(
      req.user.sub,
      tenantId,
      dto
    );

    return {
      data,
      message: "Checkout session prepared"
    };
  }

  @Public()
  @Post("webhooks/stripe")
  async stripeWebhook(@Req() req: BillingRequest) {
    const signatureHeader = req.headers["stripe-signature"];
    const signature =
      typeof signatureHeader === "string"
        ? signatureHeader
        : Array.isArray(signatureHeader) && signatureHeader.length > 0
          ? signatureHeader[0]
          : null;

    const data = await this.billingService.processStripeWebhook(
      signature,
      req.rawBody,
      req.body
    );

    return {
      data,
      message: "Stripe webhook processed"
    };
  }

  @Get("subscription")
  async subscription(@Req() req: BillingRequest) {
    const tenantId = req.user.tenantId ?? req.tenantId ?? null;

    if (!tenantId) {
      throw new ForbiddenException("No active tenant selected");
    }

    const data = await this.billingService.getSubscription(tenantId);

    return {
      data,
      message: "Subscription fetched"
    };
  }

  @Get("usage")
  async usage(@Req() req: BillingRequest) {
    const tenantId = req.user.tenantId ?? req.tenantId ?? null;

    if (!tenantId) {
      throw new ForbiddenException("No active tenant selected");
    }

    const data = await this.billingService.getUsage(tenantId);

    return {
      data,
      message: "Usage fetched"
    };
  }
}
