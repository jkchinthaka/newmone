import { emailQueue, EmailJobPayload } from "../queue";

export const enqueueEmailJob = async (payload: EmailJobPayload): Promise<void> => {
  await emailQueue.add("send-email", payload, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000
    }
  });
};
