import { Queue } from "bullmq";

import { redis } from "../config/redis";

export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
}

export interface ReportJobPayload {
  reportType: "work-orders" | "assets" | "inventory";
  requestedBy: string;
  dateRange: {
    from: string;
    to: string;
  };
}

const defaultJobOptions = {
  removeOnComplete: 200,
  removeOnFail: 300
};

export const emailQueue = new Queue<EmailJobPayload>("emails", {
  connection: redis,
  defaultJobOptions
});

export const reportQueue = new Queue<ReportJobPayload>("reports", {
  connection: redis,
  defaultJobOptions
});
