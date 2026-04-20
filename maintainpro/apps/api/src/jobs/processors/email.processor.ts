import { Worker } from "bullmq";

import { logger } from "../../config/logger";
import { redis } from "../../config/redis";
import { sendEmail } from "../../integrations/email/smtp.client";
import { EmailJobPayload } from "../queue";

export const startEmailWorker = (): Worker<EmailJobPayload> => {
  const worker = new Worker<EmailJobPayload>(
    "emails",
    async (job) => {
      await sendEmail({
        to: job.data.to,
        subject: job.data.subject,
        html: job.data.html
      });
    },
    { connection: redis }
  );

  worker.on("completed", (job) => {
    logger.info(`Email job completed: ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    logger.error(`Email job failed: ${job?.id} - ${error.message}`);
  });

  return worker;
};
