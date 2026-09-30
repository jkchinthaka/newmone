import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { ERP_QUANTITY_EVENT_TYPES } from "../work-orders/work-order-erp-consumption";

export type DomainEventRecord = {
  tenantId: string;
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger(DomainEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(event: DomainEventRecord) {
    try {
      await this.prisma.domainEventOutbox.create({
        data: {
          tenantId: event.tenantId,
          eventId: event.eventId,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      if (this.isUnique(error)) {
        const existing = await this.prisma.domainEventOutbox.findUnique({
          where: { tenantId_eventId: { tenantId: event.tenantId, eventId: event.eventId } }
        });
        const samePayload = JSON.stringify(existing?.payload ?? {}) === JSON.stringify(event.payload ?? {});
        if (!samePayload) {
          throw error;
        }
        return existing;
      }
      throw error;
    }
  }

  async drain(tenantId: string, limit = 50) {
    const pending = await this.prisma.domainEventOutbox.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: limit
    });
    const processed: string[] = [];
    for (const event of pending) {
      if (ERP_QUANTITY_EVENT_TYPES.has(event.eventType)) {
        continue;
      }
      try {
        await this.prisma.domainEventOutbox.update({
          where: { id: event.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null
          }
        });
        processed.push(event.eventId);
      } catch (error) {
        await this.prisma.domainEventOutbox.update({
          where: { id: event.id },
          data: {
            status: "FAILED",
            attempts: { increment: 1 },
            lastError: error instanceof Error ? error.message : "unknown"
          }
        });
        this.logger.warn(`Domain event ${event.eventId} failed: ${String(error)}`);
      }
    }
    return { drained: pending.length, processed: processed.length };
  }

  async acknowledgeErpEvent(tenantId: string, id: string, externalReference: string, actorId?: string) {
    const reference = externalReference?.trim() ?? "";
    if (reference.length < 3) {
      throw new BadRequestException("A Bileeta posting reference is required. This does not call the Bileeta API.");
    }
    const event = await this.prisma.domainEventOutbox.findFirst({ where: { id, tenantId } });
    if (!event) {
      throw new NotFoundException("ERP event not found");
    }
    if (!ERP_QUANTITY_EVENT_TYPES.has(event.eventType)) {
      throw new BadRequestException("Only stock consumption, return, and receipt events can be acknowledged here.");
    }
    if (event.status === "ACKNOWLEDGED" || event.status === "POSTED") {
      return event;
    }
    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(event.payload);
      if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>;
    } catch {
      payload = {};
    }
    payload.externalReference = reference;
    payload.acknowledgedAt = new Date().toISOString();
    payload.acknowledgedById = actorId ?? null;
    payload.quantityInStockMutated = false;
    payload.bileetaApiCalled = false;
    const updated = await this.prisma.domainEventOutbox.update({
      where: { id: event.id },
      data: {
        status: "ACKNOWLEDGED",
        processedAt: new Date(),
        lastError: null,
        payload: JSON.stringify(payload)
      }
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        entity: "DomainEventOutbox",
        entityId: event.id,
        action: "UPDATE",
        module: "enterprise-ops",
        reason: reference,
        actorId: actorId ?? null,
        metadata: JSON.stringify({
          event: "erp_event_acknowledged",
          eventType: event.eventType,
          externalReference: reference,
          bileetaApiCalled: false,
          quantityInStockMutated: false
        }),
        beforeData: JSON.stringify({ status: event.status }),
        afterData: JSON.stringify({ status: "ACKNOWLEDGED" })
      }
    });
    return updated;
  }

  async list(tenantId: string, status?: string) {
    return this.prisma.domainEventOutbox.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  private isUnique(error: unknown): boolean {
    return Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
    );
  }
}
