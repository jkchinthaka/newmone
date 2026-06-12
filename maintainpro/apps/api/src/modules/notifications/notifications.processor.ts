import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { QueueHealthService } from "../queues/queue-health.service";
import { EmailDispatchService } from "./email-dispatch.service";
import { PushDispatchService } from "./push-dispatch.service";
import { SmsDispatchService } from "./sms-dispatch.service";

@Processor("notifications")
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly pushDispatchService: PushDispatchService,
    private readonly emailDispatchService: EmailDispatchService,
    private readonly smsDispatchService: SmsDispatchService,
    private readonly queueHealthService: QueueHealthService
  ) {}

  @Process("send")
  async handleSend(
    job: Job<{
      channel: string;
      message: string;
      userId: string;
      title?: string;
      notificationId?: string;
      metadata?: Prisma.JsonValue;
    }>
  ): Promise<void> {
    if (job.data.channel === "EMAIL") {
      const result = await this.emailDispatchService.dispatch({
        userId: job.data.userId,
        title: job.data.title,
        message: job.data.message,
        notificationId: job.data.notificationId
      });

      this.logger.log(
        `Email notification for user ${job.data.userId}: attempted=${result.attempted}, delivered=${result.delivered}, skipped=${result.skipped}, mode=${result.mode}`
      );
      return;
    }

    if (job.data.channel === "SMS") {
      const result = await this.smsDispatchService.dispatch({
        userId: job.data.userId,
        message: job.data.message,
        notificationId: job.data.notificationId
      });

      this.logger.log(
        `SMS notification for user ${job.data.userId}: attempted=${result.attempted}, delivered=${result.delivered}, skipped=${result.skipped}, mode=${result.mode}`
      );
      return;
    }

    if (job.data.channel === "PUSH") {
      const result = await this.pushDispatchService.dispatch({
        userId: job.data.userId,
        title: job.data.title,
        message: job.data.message,
        notificationId: job.data.notificationId,
        metadata: job.data.metadata ?? null
      });

      this.logger.log(
        `Prepared push notification for user ${job.data.userId} across ${result.deviceCount} registered device(s)`
      );
      return;
    }

    this.logger.log(`Processing notification for user ${job.data.userId} via ${job.data.channel}`);
  }

  @OnQueueFailed()
  onQueueFailed(
    job: Job<{
      channel: string;
      userId: string;
      notificationId?: string;
    }>,
    error: Error
  ): void {
    this.queueHealthService.markQueueProcessorFailure("notification", error);
    this.logger.error(
      `Notification queue processing failed for job ${job.id} (channel=${job.data.channel}, userId=${job.data.userId}, notificationId=${job.data.notificationId ?? "n/a"})`
    );
  }
}
