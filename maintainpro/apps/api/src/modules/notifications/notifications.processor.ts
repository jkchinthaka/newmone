import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { Logger } from "@nestjs/common";

@Processor("notifications")
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  @Process("send")
  async handleSend(job: Job<{ channel: string; message: string; userId: string }>): Promise<void> {
    this.logger.log(`Processing notification for user ${job.data.userId} via ${job.data.channel}`);
  }
}
