import { createLogger, format, transports } from "winston";

import { env } from "./env";

export const logger = createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level.toUpperCase()}] ${stack ?? message}`;
    })
  ),
  transports: [new transports.Console()]
});

export const morganStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  }
};
