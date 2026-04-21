import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";

import { PrismaService } from "../../database/prisma.service";
import { NotificationsGateway } from "./notifications.gateway";

export interface NotificationPreference {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly preferenceStore = new Map<string, NotificationPreference>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectQueue("notifications") private readonly notificationsQueue: Queue
  ) {}

  findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
  }

  async markRead(id: string) {
    const notification = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true
      }
    });

    this.notificationsGateway.emitMarkRead(notification.userId, notification);

    await this.notificationsQueue.add("send", {
      channel: "IN_APP",
      userId: notification.userId,
      message: `Notification ${notification.id} marked as read`
    });

    return notification;
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    this.notificationsGateway.emitMarkRead(userId, { markAllRead: true });

    await this.notificationsQueue.add("send", {
      channel: "IN_APP",
      userId,
      message: "All notifications marked as read"
    });

    return { updated: true };
  }

  getPreferences(userId: string): NotificationPreference {
    return (
      this.preferenceStore.get(userId) ?? {
        inApp: true,
        email: true,
        sms: false,
        whatsapp: false,
        push: true
      }
    );
  }

  updatePreferences(userId: string, data: Partial<NotificationPreference>) {
    const current = this.getPreferences(userId);

    const merged = {
      ...current,
      ...data
    };

    this.preferenceStore.set(userId, merged);

    return merged;
  }
}
