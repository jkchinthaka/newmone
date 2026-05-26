import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PushDispatchService } from "./push-dispatch.service";

@Processor("notifications")
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly pushDispatchService: PushDispatchService) {}

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
}
