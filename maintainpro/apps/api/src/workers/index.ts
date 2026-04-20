import { logger } from "../config/logger";
import { startEmailWorker } from "../jobs/processors/email.processor";
import { startReportWorker } from "../jobs/processors/report.processor";

const emailWorker = startEmailWorker();
const reportWorker = startReportWorker();

logger.info("MaintainPro background worker started");

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info(`Worker shutdown started (${signal})`);

  await Promise.allSettled([emailWorker.close(), reportWorker.close()]);

  logger.info("Worker shutdown complete");
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
