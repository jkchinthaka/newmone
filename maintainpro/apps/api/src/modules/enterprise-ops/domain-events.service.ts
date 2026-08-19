import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

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
