import type { RequestHandler } from "express";
import { z } from "zod";

import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/response";
import { notificationsService } from "./notifications.service";

const sendNotificationSchema = z.object({
  channel: z.enum(["email", "push", "whatsapp"]),
  recipient: z.string().min(2),
  title: z.string().min(2),
  message: z.string().min(2)
});

const send: RequestHandler = asyncHandler(async (req, res) => {
  const payload = sendNotificationSchema.parse(req.body);
  const result = await notificationsService.send(payload);

  return sendSuccess(res, result, "Notification processed");
});

export const notificationsController = {
  send
};
