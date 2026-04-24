import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import Stripe from "stripe";

import { PrismaService } from "../../database/prisma.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";

type WebhookInvoice = {
  id?: string;
  number?: string | null;
  amount_due?: number | null;
  amount_paid?: number | null;
  currency?: string | null;
  status?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  due_date?: number | null;
  customer?: string | null;
  subscription?: string | null;
  lines?: {
    data?: Array<{
      period?: {
        start?: number;
        end?: number;
      };
    }>;
  };
  status_transitions?: {
    paid_at?: number | null;
  };
};

@Injectable()
export class BillingService {
  private readonly stripe: Stripe | null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(EntitlementsService)
    private readonly entitlementsService: EntitlementsService
  ) {
    const stripeSecret = this.configService.get<string>("STRIPE_SECRET_KEY")?.trim();
    this.stripe = stripeSecret ? new Stripe(stripeSecret) : null;
  }

  private mapStripeSubscriptionStatus(
    status?: string | null
  ): SubscriptionStatus {
    switch ((status ?? "").toLowerCase()) {
      case "trialing":
        return SubscriptionStatus.TRIALING;
      case "active":
        return SubscriptionStatus.ACTIVE;
      case "past_due":
        return SubscriptionStatus.PAST_DUE;
      case "canceled":
        return SubscriptionStatus.CANCELED;
      case "incomplete":
        return SubscriptionStatus.INCOMPLETE;
      case "paused":
        return SubscriptionStatus.PAUSED;
      default:
        return SubscriptionStatus.ACTIVE;
    }
  }

  private resolvePrice(plan: { priceMonthly: unknown; priceYearly: unknown }, billingInterval: BillingInterval): number {
    const candidate =
      billingInterval === BillingInterval.YEARLY
        ? Number(plan.priceYearly)
        : Number(plan.priceMonthly);

    if (!Number.isFinite(candidate) || candidate < 0) {
      return 0;
    }

    return candidate;
  }

  private toMinorUnits(amount: number): number {
    return Math.max(0, Math.round(amount * 100));
  }

  private toDate(unixSeconds?: number | null): Date | null {
    if (typeof unixSeconds !== "number" || Number.isNaN(unixSeconds)) {
      return null;
    }

    return new Date(unixSeconds * 1000);
  }

  private stringifyJson(value: unknown) {
    if (!value || typeof value !== "object") {
      return null;
    }

    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  private resolveStripePriceId(
    metadata: unknown,
    billingInterval: BillingInterval
  ): string | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return null;
    }

    const object = metadata as Record<string, unknown>;
    const key =
      billingInterval === BillingInterval.YEARLY
        ? "stripePriceYearly"
        : "stripePriceMonthly";
    const value = object[key];

    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  }

  private async activateSubscription(params: {
    tenantId: string;
    planId: string;
    billingInterval: BillingInterval;
    seats: number;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    status?: SubscriptionStatus;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }) {
    const currentPeriodStart = params.currentPeriodStart ?? new Date();

    const currentPeriodEnd =
      params.currentPeriodEnd ??
      (() => {
        const nextPeriod = new Date(currentPeriodStart);
        if (params.billingInterval === BillingInterval.YEARLY) {
          nextPeriod.setUTCFullYear(nextPeriod.getUTCFullYear() + 1);
        } else {
          nextPeriod.setUTCMonth(nextPeriod.getUTCMonth() + 1);
        }
        return nextPeriod;
      })();

    await this.prisma.subscription.updateMany({
      where: {
        tenantId: params.tenantId,
        isCurrent: true
      },
      data: {
        isCurrent: false
      }
    });

    return this.prisma.subscription.create({
      data: {
        tenantId: params.tenantId,
        planId: params.planId,
        status: params.status ?? SubscriptionStatus.ACTIVE,
        billingInterval: params.billingInterval,
        seats: params.seats,
        isCurrent: true,
        currentPeriodStart,
        currentPeriodEnd,
        stripeSubscriptionId: params.stripeSubscriptionId ?? null,
        stripePriceId: params.stripePriceId ?? null
      },
      include: {
        plan: {
          include: {
            entitlements: true
          }
        }
      }
    });
  }

  private async getOrCreateStripeCustomer(tenantId: string, userId: string) {
    if (!this.stripe) {
      return null;
    }

    const existing = await this.prisma.stripeCustomer.findUnique({
      where: {
        tenantId
      }
    });

    if (existing) {
      return existing;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      metadata: {
        tenantId
      }
    });

    return this.prisma.stripeCustomer.create({
      data: {
        tenantId,
        customerId: customer.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim()
      }
    });
  }

  async createCheckoutSession(
    userId: string,
    tenantId: string,
    dto: CreateCheckoutSessionDto
  ) {
    const normalizedCode = dto.planCode.trim().toUpperCase();

    const plan = await this.prisma.plan.findUnique({
      where: {
        code: normalizedCode
      },
      include: {
        entitlements: true
      }
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException("Plan not found");
    }

    const billingInterval = dto.billingInterval ?? BillingInterval.MONTHLY;
    const seats = dto.seats ?? 5;

    const frontendUrl = this.configService.get<string>("FRONTEND_URL") ?? "http://localhost:3001";
    const successUrl = dto.successUrl ?? `${frontendUrl}/billing?checkout=success`;
    const cancelUrl = dto.cancelUrl ?? `${frontendUrl}/billing?checkout=canceled`;

    if (!this.stripe) {
      const subscription = await this.activateSubscription({
        tenantId,
        planId: plan.id,
        billingInterval,
        seats,
        status: SubscriptionStatus.ACTIVE
      });

      return {
        mode: "mock",
        sessionId: null,
        checkoutUrl: `${successUrl}${successUrl.includes("?") ? "&" : "?"}mode=mock`,
        subscription
      };
    }

    const stripeCustomer = await this.getOrCreateStripeCustomer(tenantId, userId);
    const stripePriceId = this.resolveStripePriceId(plan.metadata, billingInterval);

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomer?.customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenantId,
        planCode: plan.code,
        billingInterval,
        seats: String(seats),
        userId
      },
      line_items: [
        stripePriceId
          ? {
              price: stripePriceId,
              quantity: 1
            }
          : {
              quantity: 1,
              price_data: {
                currency: (plan.currency || "USD").toLowerCase(),
                recurring: {
                  interval: billingInterval === BillingInterval.YEARLY ? "year" : "month"
                },
                product_data: {
                  name: plan.name,
                  description: plan.description ?? undefined
                },
                unit_amount: this.toMinorUnits(
                  this.resolvePrice(plan, billingInterval)
                )
              }
            }
      ]
    });

    return {
      mode: "live",
      sessionId: session.id,
      checkoutUrl: session.url,
      subscription: null
    };
  }

  async getSubscription(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        tenantId,
        isCurrent: true
      },
      include: {
        plan: {
          include: {
            entitlements: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
  }

  async getUsage(tenantId: string) {
    const usage = await this.entitlementsService.getUsageSnapshot(tenantId);
    const recentInvoices = await this.prisma.stripeInvoice.findMany({
      where: {
        tenantId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 12
    });

    return {
      ...usage,
      recentInvoices
    };
  }

  private async handleCheckoutSessionCompleted(eventObject: Record<string, unknown>) {
    const metadata =
      eventObject.metadata && typeof eventObject.metadata === "object" && !Array.isArray(eventObject.metadata)
        ? (eventObject.metadata as Record<string, unknown>)
        : {};

    const tenantId = typeof metadata.tenantId === "string" ? metadata.tenantId : "";
    const planCode = typeof metadata.planCode === "string" ? metadata.planCode : "";
    const billingInterval =
      metadata.billingInterval === BillingInterval.YEARLY
        ? BillingInterval.YEARLY
        : BillingInterval.MONTHLY;
    const seats = Number(metadata.seats);

    if (!tenantId || !planCode) {
      return;
    }

    const plan = await this.prisma.plan.findUnique({
      where: {
        code: planCode
      },
      select: {
        id: true
      }
    });

    if (!plan) {
      return;
    }

    const stripeSubscriptionId =
      typeof eventObject.subscription === "string"
        ? eventObject.subscription
        : null;

    await this.activateSubscription({
      tenantId,
      planId: plan.id,
      billingInterval,
      seats: Number.isFinite(seats) && seats > 0 ? Math.floor(seats) : 5,
      stripeSubscriptionId,
      status: SubscriptionStatus.ACTIVE
    });

    const customerId =
      typeof eventObject.customer === "string" ? eventObject.customer : null;

    if (customerId) {
      await this.prisma.stripeCustomer.upsert({
        where: { tenantId },
        update: {
          customerId
        },
        create: {
          tenantId,
          customerId
        }
      });
    }
  }

  private async syncStripeSubscriptionStatus(eventObject: Record<string, unknown>) {
    const stripeSubscriptionId =
      typeof eventObject.id === "string" ? eventObject.id : null;

    if (!stripeSubscriptionId) {
      return;
    }

    const status = this.mapStripeSubscriptionStatus(
      typeof eventObject.status === "string" ? eventObject.status : null
    );

    const currentPeriodStart = this.toDate(
      typeof eventObject.current_period_start === "number"
        ? eventObject.current_period_start
        : null
    );

    const currentPeriodEnd = this.toDate(
      typeof eventObject.current_period_end === "number"
        ? eventObject.current_period_end
        : null
    );

    await this.prisma.subscription.updateMany({
      where: {
        stripeSubscriptionId
      },
      data: {
        status,
        cancelAtPeriodEnd:
          eventObject.cancel_at_period_end === true,
        currentPeriodStart: currentPeriodStart ?? undefined,
        currentPeriodEnd: currentPeriodEnd ?? undefined,
        canceledAt:
          status === SubscriptionStatus.CANCELED ? new Date() : null
      }
    });
  }

  private async handleInvoiceEvent(
    invoice: WebhookInvoice,
    fallbackStatus: string
  ) {
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : null;

    if (!customerId) {
      return;
    }

    const customer = await this.prisma.stripeCustomer.findUnique({
      where: {
        customerId
      },
      select: {
        tenantId: true
      }
    });

    if (!customer) {
      return;
    }

    const stripeInvoiceId = typeof invoice.id === "string" ? invoice.id : null;

    if (!stripeInvoiceId) {
      return;
    }

    const stripeSubscriptionId =
      typeof invoice.subscription === "string" ? invoice.subscription : null;

    const subscription = stripeSubscriptionId
      ? await this.prisma.subscription.findFirst({
          where: {
            stripeSubscriptionId
          },
          select: {
            id: true
          }
        })
      : null;

    const linePeriod = invoice.lines?.data?.[0]?.period;

    await this.prisma.stripeInvoice.upsert({
      where: {
        stripeInvoiceId
      },
      update: {
        tenantId: customer.tenantId,
        subscriptionId: subscription?.id ?? null,
        invoiceNumber: invoice.number ?? null,
        amountDue: Number((invoice.amount_due ?? 0) / 100),
        amountPaid: Number((invoice.amount_paid ?? 0) / 100),
        currency: (invoice.currency ?? "usd").toLowerCase(),
        status: (invoice.status ?? fallbackStatus).toLowerCase(),
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdf: invoice.invoice_pdf ?? null,
        dueDate: this.toDate(invoice.due_date),
        paidAt: this.toDate(invoice.status_transitions?.paid_at),
        periodStart: this.toDate(linePeriod?.start),
        periodEnd: this.toDate(linePeriod?.end),
        raw: this.stringifyJson(invoice)
      },
      create: {
        tenantId: customer.tenantId,
        subscriptionId: subscription?.id ?? null,
        stripeInvoiceId,
        invoiceNumber: invoice.number ?? null,
        amountDue: Number((invoice.amount_due ?? 0) / 100),
        amountPaid: Number((invoice.amount_paid ?? 0) / 100),
        currency: (invoice.currency ?? "usd").toLowerCase(),
        status: (invoice.status ?? fallbackStatus).toLowerCase(),
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdf: invoice.invoice_pdf ?? null,
        dueDate: this.toDate(invoice.due_date),
        paidAt: this.toDate(invoice.status_transitions?.paid_at),
        periodStart: this.toDate(linePeriod?.start),
        periodEnd: this.toDate(linePeriod?.end),
        raw: this.stringifyJson(invoice)
      }
    });
  }

  async processStripeWebhook(
    signatureHeader: string | null,
    rawBody: Buffer | undefined,
    payload: unknown
  ) {
    if (!this.stripe) {
      return {
        received: true,
        mode: "mock"
      };
    }

    const webhookSecret =
      this.configService.get<string>("STRIPE_WEBHOOK_SECRET")?.trim() ?? "";

    let event: Stripe.Event;

    if (webhookSecret.length > 0) {
      if (!signatureHeader || !rawBody) {
        throw new BadRequestException("Stripe signature or raw body missing");
      }

      try {
        event = this.stripe.webhooks.constructEvent(
          rawBody,
          signatureHeader,
          webhookSecret
        );
      } catch (error) {
        throw new BadRequestException(
          `Invalid Stripe webhook signature: ${(error as Error).message}`
        );
      }
    } else if (payload && typeof payload === "object") {
      event = payload as Stripe.Event;
    } else {
      throw new BadRequestException("Invalid webhook payload");
    }

    const eventObject =
      event.data?.object && typeof event.data.object === "object"
        ? (event.data.object as Record<string, unknown>)
        : {};

    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutSessionCompleted(eventObject);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await this.syncStripeSubscriptionStatus(eventObject);
        break;
      case "invoice.paid":
        await this.handleInvoiceEvent(eventObject as WebhookInvoice, "paid");
        break;
      case "invoice.payment_failed":
        await this.handleInvoiceEvent(
          eventObject as WebhookInvoice,
          "payment_failed"
        );
        break;
      default:
        break;
    }

    return {
      received: true,
      eventType: event.type
    };
  }
}
