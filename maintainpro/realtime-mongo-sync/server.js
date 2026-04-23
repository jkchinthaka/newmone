"use strict";

const fs = require("fs/promises");
const path = require("path");
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");

const buildSyncRoutes = require("./routes/syncRoutes");
const {
  SyncService,
  createSyncLogger,
  parseSyncCollections
} = require("./services/syncService");

const ROOT_DIR = __dirname;
const ENV_PATH = path.join(ROOT_DIR, ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, ".env.example");
const DASHBOARD_PATH = path.join(ROOT_DIR, "frontend", "sync-dashboard.html");

/**
 * Ensures a local .env file exists by copying from .env.example when missing.
 * @returns {Promise<void>} Promise resolved when .env exists.
 */
async function ensureEnvFileExists() {
  try {
    await fs.access(ENV_PATH);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error(`Unable to access .env file: ${error.message}`);
    }

    try {
      await fs.copyFile(ENV_EXAMPLE_PATH, ENV_PATH);
    } catch (copyError) {
      throw new Error(`Unable to auto-create .env file: ${copyError.message}`);
    }
  }
}

/**
 * Loads environment variables from .env.
 * @returns {Promise<void>} Promise resolved when env vars are loaded.
 */
async function loadEnvironment() {
  try {
    await ensureEnvFileExists();

    const result = dotenv.config({ path: ENV_PATH });
    if (result.error) {
      throw result.error;
    }
  } catch (error) {
    throw new Error(`Environment loading failed: ${error.message}`);
  }
}

/**
 * Builds sync service configuration from process environment.
 * @returns {object} Sync service configuration object.
 */
function buildSyncConfigFromEnv() {
  try {
    const sourceUri = process.env.MONGO_URI;
    const targetUri = process.env.TARGET_MONGO_URI;

    if (!sourceUri || !targetUri) {
      throw new Error("MONGO_URI and TARGET_MONGO_URI are required in environment variables.");
    }

    return {
      sourceUri,
      targetUri,
      syncCollections: parseSyncCollections(process.env.SYNC_COLLECTIONS || ""),
      logLevel: process.env.SYNC_LOG_LEVEL || "info",
      reconnectDelayMs: 5000,
      resumeFilePath: path.join(ROOT_DIR, "sync_resume.json")
    };
  } catch (error) {
    throw new Error(`Sync configuration build failed: ${error.message}`);
  }
}

/**
 * Creates and configures the Express app.
 * @param {SyncService} syncService - Sync service instance.
 * @param {import('winston').Logger} logger - App logger.
 * @returns {express.Express} Configured Express app.
 */
function createExpressApp(syncService, logger) {
  try {
    const app = express();

    app.use(cors());
    app.use(express.json({ limit: "5mb" }));

    app.get("/health", async (req, res) => {
      try {
        res.status(200).json({
          status: "ok",
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error("Health endpoint failed.", {
          message: error.message,
          stack: error.stack
        });
        res.status(500).json({ status: "error", message: "Health check failed." });
      }
    });

    app.get("/", async (req, res) => {
      try {
        res.sendFile(DASHBOARD_PATH);
      } catch (error) {
        logger.error("Failed to serve dashboard page.", {
          message: error.message,
          stack: error.stack
        });
        res.status(500).json({ status: "error", message: "Dashboard unavailable." });
      }
    });

    app.use("/frontend", express.static(path.join(ROOT_DIR, "frontend")));
    app.use("/api/sync", buildSyncRoutes({ syncService, logger }));

    app.use(async (req, res) => {
      try {
        res.status(404).json({
          status: "not_found",
          message: "Requested resource does not exist."
        });
      } catch (error) {
        logger.error("Fallback route failed.", {
          message: error.message,
          stack: error.stack
        });
        res.status(500).json({ status: "error", message: "Unexpected routing error." });
      }
    });

    return app;
  } catch (error) {
    throw new Error(`Express app creation failed: ${error.message}`);
  }
}

/**
 * Starts HTTP server and resolves when listening.
 * @param {express.Express} app - Express app instance.
 * @param {number} port - HTTP port.
 * @param {import('winston').Logger} logger - App logger.
 * @returns {Promise<import('http').Server>} Running HTTP server.
 */
async function startHttpServer(app, port, logger) {
  try {
    const server = await new Promise((resolve, reject) => {
      const httpServer = app.listen(port);

      httpServer.once("listening", () => resolve(httpServer));
      httpServer.once("error", (error) => reject(error));
    });

    logger.info("Express server started.", { port });
    return server;
  } catch (error) {
    throw new Error(`HTTP server startup failed: ${error.message}`);
  }
}

/**
 * Closes HTTP server gracefully.
 * @param {import('http').Server} server - Running HTTP server.
 * @returns {Promise<void>} Promise resolved when server closes.
 */
async function closeHttpServer(server) {
  try {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  } catch (error) {
    throw new Error(`HTTP server shutdown failed: ${error.message}`);
  }
}

/**
 * Registers graceful shutdown handlers.
 * @param {object} params - Handler params.
 * @param {import('http').Server} params.server - HTTP server.
 * @param {SyncService} params.syncService - Sync service instance.
 * @param {import('winston').Logger} params.logger - App logger.
 * @returns {void}
 */
function registerShutdownHandlers({ server, syncService, logger }) {
  try {
    let shuttingDown = false;

    /**
     * Handles graceful shutdown for process signals.
     * @param {string} signal - Signal name.
     * @returns {Promise<void>} Promise resolved after cleanup.
     */
    const gracefulShutdown = async (signal) => {
      try {
        if (shuttingDown) {
          return;
        }

        shuttingDown = true;
        logger.info("Graceful shutdown started.", { signal });

        await syncService.stop();
        await closeHttpServer(server);

        logger.info("Graceful shutdown completed.", { signal });
        process.exit(0);
      } catch (error) {
        logger.error("Graceful shutdown failed.", {
          signal,
          message: error.message,
          stack: error.stack
        });
        process.exit(1);
      }
    };

    process.on("SIGINT", () => {
      void gracefulShutdown("SIGINT");
    });

    process.on("SIGTERM", () => {
      void gracefulShutdown("SIGTERM");
    });
  } catch (error) {
    throw new Error(`Failed to register shutdown handlers: ${error.message}`);
  }
}

/**
 * Bootstraps the full sync system.
 * @returns {Promise<void>} Promise resolved when bootstrap is complete.
 */
async function bootstrap() {
  try {
    await loadEnvironment();

    const logLevel = process.env.SYNC_LOG_LEVEL || "info";
    const logger = createSyncLogger(logLevel);

    const syncConfig = buildSyncConfigFromEnv();
    const syncService = new SyncService({ ...syncConfig, logger });

    const app = createExpressApp(syncService, logger);
    const port = Number(process.env.PORT || 5000);

    const server = await startHttpServer(app, port, logger);
    registerShutdownHandlers({ server, syncService, logger });

    syncService.start().catch((error) => {
      logger.error("Background sync failed to start.", {
        message: error.message,
        stack: error.stack
      });
    });
  } catch (error) {
    const fallbackLogger = createSyncLogger("error");
    fallbackLogger.error("Application bootstrap failed.", {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

void bootstrap();
