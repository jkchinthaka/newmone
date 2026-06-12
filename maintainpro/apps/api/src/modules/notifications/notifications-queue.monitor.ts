import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";

import { QueueHealthService } from "../queues/queue-health.service";

@Injectable()
export class NotificationsQueueMonitor implements OnModuleInit {
  constructor(
    @InjectQueue("notifications")
    private readonly notificationsQueue: Queue,
    @Inject(QueueHealthService)
    private readonly queueHealthService: QueueHealthService
  ) {}

  onModuleInit(): void {
    this.queueHealthService.registerQueue("notification", this.notificationsQueue);
  }
}
