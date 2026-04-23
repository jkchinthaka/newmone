const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const winston = require("winston");
const createSyncRoutes = require("./routes/syncRoutes");
const SyncService = require("./services/syncService");

dotenv.config();

/**
 * Build shared application logger.
 * @returns {winston.Logger}
 */
function createLogger() {
  try {
    return winston.createLogger({
      level: process.env.SYNC_LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()],
    });
  } catch (error) {
    throw new Error(`Failed to initialize app logger: ${error.message}`);
  }
}

/**
 * Start Express server with background sync service.
 * @returns {Promise<void>}
 */
async function bootstrap() {
  try {
    const app = express();
    const logger = createLogger();
    const port = Number(process.env.PORT || 5000);

    const syncService = new SyncService({ logger });

    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: "1mb" }));

    app.use("/api/sync", createSyncRoutes(syncService));
    app.use("/frontend", express.static(path.resolve(__dirname, "frontend")));

    app.get("/health", async (req, res) => {
      try {
        res.status(200).json({ status: "ok" });
      } catch (error) {
        res.status(500).json({ status: "error", error: error.message });
      }
    });

    app.get("/", async (req, res) => {
      try {
        res.sendFile(path.resolve(__dirname, "frontend", "sync-dashboard.html"));
      } catch (error) {
        res.status(500).send("Failed to load Sync Dashboard.");
      }
    });

    app.listen(port, async () => {
      try {
        logger.info("Express server started", { port });
      } catch (error) {
        throw new Error(`Failed to log server startup: ${error.message}`);
      }
    });

    syncService.start().catch((error) => {
      logger.error("Background sync startup failure (server still running)", {
        error: error.message,
      });
    });
  } catch (error) {
    const fallbackLogger = createLogger();
    fallbackLogger.error("Fatal bootstrap error", { error: error.message });
    process.exit(1);
  }
}

bootstrap();
