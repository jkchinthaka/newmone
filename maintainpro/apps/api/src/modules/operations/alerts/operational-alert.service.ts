import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OperationalAlertSeverity,
  OperationalAlertStatus,
  Prisma
} from "@prisma/client";

import { requestContext } from "../../../common/context/request-context";
import { sanitizeLogText } from "../../../common/logging/sanitize-for-log.util";
import { PrismaService } from "../../../database/prisma.service";

export type ObserveAlertInput = {
  key: string;
  fingerprint: string;
  severity: OperationalAlertSeverity;
  source: string;
  safeSummary: string;
  tenantId?: string | null;
  metadataSafe?: Record<string, string | number | boolean | null>;
  cooldownSeconds?: number;
};

@Injectable()
export class OperationalAlertService {
  private readonly logger = new Logger(OperationalAlertService.name);
  private readonly mockNotifications: Array<Record<string, unknown>> = [];

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService
  ) {}

  getMockNotificationEvidence() {
    return [...this.mockNotifications];
  }

  clearMockNotificationEvidence(): void {
    this.mockNotifications.length = 0;
  }

  async observe(input: ObserveAlertInput) {
    const now = new Date();
    const cooldownSeconds =
      input.cooldownSeconds ??
      Number(this.configService?.get<number>("OPERATIONAL_ALERT_COOLDOWN_SECONDS") ?? 300);
    const active = await this.prisma.operationalAlert.findFirst({
      where: {
        fingerprint: input.fingerprint,
        status: { in: [OperationalAlertStatus.OPEN, OperationalAlertStatus.ACKNOWLEDGED] }
      }
    });

    if (active) {
      const inCooldown =
        active.cooldownUntil != null && active.cooldownUntil.getTime() > now.getTime();
      const updated = await this.prisma.operationalAlert.update({
        where: { id: active.id },
        data: {
          lastObservedAt: now,
          occurrenceCount: { increment: 1 },
          safeSummary: sanitizeLogText(input.safeSummary, 500),
          metadataSafe: (input.metadataSafe ?? Prisma.JsonNull) as Prisma.InputJsonValue
        }
      });

      if (!inCooldown && active.status === OperationalAlertStatus.OPEN) {
        await this.maybeNotify(updated, "repeat_suppressed_or_cooldown");
      }

      return {
        alert: this.toSafeView(updated),
        created: false,
        notified: false,
        duplicateSuppressed: true
      };
    }

    const created = await this.prisma.operationalAlert.create({
      data: {
        key: input.key,
        fingerprint: input.fingerprint,
        severity: input.severity,
        status: OperationalAlertStatus.OPEN,
        source: input.source,
        safeSummary: sanitizeLogText(input.safeSummary, 500),
        firstObservedAt: now,
        lastObservedAt: now,
        occurrenceCount: 1,
        cooldownUntil: new Date(now.getTime() + cooldownSeconds * 1000),
        lastNotificationAt: now,
        tenantId: input.tenantId ?? null,
        metadataSafe: (input.metadataSafe ?? Prisma.JsonNull) as Prisma.InputJsonValue
      }
    });

    await this.maybeNotify(created, "opened");

    return {
      alert: this.toSafeView(created),
      created: true,
      notified: true,
      duplicateSuppressed: false
    };
  }

  async resolveByFingerprint(fingerprint: string, reason: string) {
    const active = await this.prisma.operationalAlert.findFirst({
      where: {
        fingerprint,
        status: { in: [OperationalAlertStatus.OPEN, OperationalAlertStatus.ACKNOWLEDGED] }
      }
    });
    if (!active) {
      return { resolved: false, alert: null };
    }

    const resolved = await this.prisma.operationalAlert.update({
      where: { id: active.id },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionReason: sanitizeLogText(reason, 300)
      }
    });

    await this.maybeNotify(resolved, "resolved");
    return { resolved: true, alert: this.toSafeView(resolved) };
  }

  async acknowledge(alertId: string, actorId: string) {
    const alert = await this.prisma.operationalAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException("Operational alert not found");
    }
    if (
      alert.status !== OperationalAlertStatus.OPEN &&
      alert.status !== OperationalAlertStatus.ACKNOWLEDGED
    ) {
      throw new ForbiddenException("Alert is not active");
    }

    const updated = await this.prisma.operationalAlert.update({
      where: { id: alertId },
      data: {
        status: OperationalAlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedById: actorId
      }
    });

    return this.toSafeView(updated);
  }

  async listActive(limit = 50) {
    const rows = await this.prisma.operationalAlert.findMany({
      where: {
        status: { in: [OperationalAlertStatus.OPEN, OperationalAlertStatus.ACKNOWLEDGED] }
      },
      orderBy: { lastObservedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100)
    });
    return rows.map((row: any) => this.toSafeView(row));
  }

  private async maybeNotify(
    alert: {
      id: string;
      key: string;
      fingerprint: string;
      severity: OperationalAlertSeverity;
      status: OperationalAlertStatus;
      safeSummary: string;
    },
    outcome: string
  ) {
    const mode = String(
      this.configService?.get<string>("OPERATIONAL_ALERT_NOTIFICATION_MODE") ?? "disabled"
    )
      .trim()
      .toLowerCase();

    if (mode !== "mock" && mode !== "uat") {
      return;
    }

    if (outcome === "repeat_suppressed_or_cooldown") {
      return;
    }

    this.mockNotifications.push({
      mode,
      outcome,
      alertKey: alert.key,
      fingerprint: alert.fingerprint,
      severity: alert.severity,
      status: alert.status,
      safeSummary: alert.safeSummary,
      requestId: requestContext.getRequestId() ?? null,
      recordedAt: new Date().toISOString()
    });

    this.logger.log(
      sanitizeLogText(
        JSON.stringify({
          event: "operational_alert_mock_notification",
          alertKey: alert.key,
          outcome,
          requestId: requestContext.getRequestId() ?? null
        }),
        500
      )
    );
  }

  private toSafeView(alert: {
    id: string;
    key: string;
    fingerprint: string;
    severity: OperationalAlertSeverity;
    status: OperationalAlertStatus;
    source: string;
    safeSummary: string;
    firstObservedAt: Date;
    lastObservedAt: Date;
    occurrenceCount: number;
    acknowledgedAt: Date | null;
    resolvedAt: Date | null;
    resolutionReason: string | null;
    cooldownUntil: Date | null;
    tenantId: string | null;
    metadataSafe: Prisma.JsonValue | null;
  }) {
    return {
      id: alert.id,
      key: alert.key,
      fingerprint: alert.fingerprint,
      severity: alert.severity,
      status: alert.status,
      source: alert.source,
      safeSummary: alert.safeSummary,
      firstObservedAt: alert.firstObservedAt.toISOString(),
      lastObservedAt: alert.lastObservedAt.toISOString(),
      occurrenceCount: alert.occurrenceCount,
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: alert.resolvedAt?.toISOString() ?? null,
      resolutionReason: alert.resolutionReason,
      cooldownUntil: alert.cooldownUntil?.toISOString() ?? null,
      tenantScoped: Boolean(alert.tenantId),
      metadataSafe: alert.metadataSafe
    };
  }
}
