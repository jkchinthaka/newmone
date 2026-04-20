import { enqueueEmailJob } from "../../jobs/queues/email.queue";
import { sendWhatsAppMessage } from "../../integrations/whatsapp/whatsapp.client";
import { firebaseMessaging } from "../../config/firebase";

export type NotificationChannel = "email" | "push" | "whatsapp";

export interface NotificationInput {
  channel: NotificationChannel;
  recipient: string;
  title: string;
  message: string;
}

export const notificationsService = {
  async send(input: NotificationInput): Promise<{ channel: NotificationChannel; status: string }> {
    if (input.channel === "email") {
      await enqueueEmailJob({
        to: input.recipient,
        subject: input.title,
        html: `<p>${input.message}</p>`
      });

      return {
        channel: "email",
        status: "queued"
      };
    }

    if (input.channel === "whatsapp") {
      await sendWhatsAppMessage({
        to: input.recipient,
        text: `${input.title}: ${input.message}`
      });

      return {
        channel: "whatsapp",
        status: "sent"
      };
    }

    if (!firebaseMessaging) {
      return {
        channel: "push",
        status: "skipped (firebase not configured)"
      };
    }

    await firebaseMessaging.send({
      token: input.recipient,
      notification: {
        title: input.title,
        body: input.message
      }
    });

    return {
      channel: "push",
      status: "sent"
    };
  }
};
