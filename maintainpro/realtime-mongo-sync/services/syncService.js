"use strict";

const fs = require("fs/promises");
const path = require("path");
const { MongoClient } = require("mongodb");
const winston = require("winston");

const DEFAULT_RECONNECT_DELAY_MS = 5000;
const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_ACTIVITY_LIMIT = 10;
const DEFAULT_ERROR_LIMIT = 100;

/**
 * Creates a Winston logger for sync operations.
 * @param {string} logLevel - Logger level (error, warn, info, debug).
 * @returns {winston.Logger} Configured Winston logger.
 */
function createSyncLogger(logLevel = "info") {
  try {
    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: "mongo-sync-service" },
      transports: [new winston.transports.Console()]
    });
  } catch (error) {
    throw new Error(`Failed to create sync logger: ${error.message}`);
  }
}

/**
 * Parses a MongoDB URI and returns the database name from its path.
 * @param {string} uri - MongoDB connection URI.
 * @returns {string|null} Database name or null when not found.
 */
function parseDatabaseNameFromUri(uri) {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname.replace(/^\/+/, "").trim();
    return dbName.length > 0 ? dbName : null;
  } catch (error) {
    throw new Error(`Invalid MongoDB URI provided: ${error.message}`);
  }
}

/**
 * Parses a comma-separated collections string into an array.
 * @param {string} collections - Comma-separated collection names.
 * @returns {string[]} Normalized collection list.
 */
function parseSyncCollections(collections) {
  try {
    if (!collections || !collections.trim()) {
      return [];
    }

    return collections
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  } catch (error) {
    throw new Error(`Failed to parse sync collections: ${error.message}`);
  }
}

/**
 * Creates a Promise-based delay.
 * @param {number} milliseconds - Delay duration in milliseconds.
 * @returns {Promise<void>} Promise resolved after the delay.
 */
async function wait(milliseconds) {
  try {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  } catch (error) {
    throw new Error(`Delay execution failed: ${error.message}`);
  }
}

/**
 * Real-time sync service that mirrors MongoDB source data into a target MongoDB database.
 */
class SyncService {
  /**
   * Creates a new SyncService instance.
   * @param {object} options - Service options.
   * @param {string} options.sourceUri - Source MongoDB URI.
   * @param {string} options.targetUri - Target MongoDB URI.
   * @param {string[]} [options.syncCollections=[]] - Optional collection allowlist.
   * @param {string} [options.sourceDbName] - Optional source database name override.
   * @param {string} [options.targetDbName] - Optional target database name override.
   * @param {string} [options.resumeFilePath] - Optional path to resume token file.
   * @param {number} [options.reconnectDelayMs=5000] - Reconnect delay in milliseconds.
   * @param {number} [options.batchSize=500] - Batch size for snapshot sync.
   * @param {winston.Logger} [options.logger] - Optional shared logger instance.
   * @param {string} [options.logLevel=info] - Logger level when logger is not provided.
   */
  constructor(options) {
    try {
      this.sourceUri = options?.sourceUri;
      this.targetUri = options?.targetUri;

      if (!this.sourceUri || !this.targetUri) {
        throw new Error("sourceUri and targetUri are required.");
      }

      this.sourceDbName = options?.sourceDbName || parseDatabaseNameFromUri(this.sourceUri);
      this.targetDbName = options?.targetDbName || parseDatabaseNameFromUri(this.targetUri);

      if (!this.sourceDbName || !this.targetDbName) {
        throw new Error("Both source and target database names must be resolvable from URI or options.");
      }

      this.syncCollections = Array.isArray(options?.syncCollections)
        ? options.syncCollections.filter(Boolean)
        : [];

      this.resumeFilePath =
        options?.resumeFilePath || path.join(process.cwd(), "sync_resume.json");

      this.reconnectDelayMs = Number(options?.reconnectDelayMs || DEFAULT_RECONNECT_DELAY_MS);
      this.batchSize = Number(options?.batchSize || DEFAULT_BATCH_SIZE);
      this.logger = options?.logger || createSyncLogger(options?.logLevel || "info");

      this.status = "idle";
      this.lastSyncedAt = null;
      this.totalSynced = 0;
      this.pendingErrors = [];
      this.recentEvents = [];

      this.isRunning = false;
      this.isStopping = false;
      this.isResyncing = false;
      this.hasCompletedInitialSync = false;

      this.sourceClient = null;
      this.targetClient = null;
      this.sourceDb = null;
      this.targetDb = null;
      this.changeStream = null;
      this.resumeToken = null;
      this.syncLoopPromise = null;

      this.recordActivity({
        type: "service",
        message: "Sync service initialized.",
        details: {
          sourceDbName: this.sourceDbName,
          targetDbName: this.targetDbName,
          syncCollections: this.syncCollections
        }
      });
    } catch (error) {
      throw new Error(`SyncService initialization failed: ${error.message}`);
    }
  }

  /**
   * Starts the background synchronization loop in non-blocking mode.
   * @returns {Promise<void>} Promise resolved after loop initialization.
   */
  async start() {
    try {
      if (this.isRunning) {
        this.logger.info("Sync service start requested, but service is already running.");
        return;
      }

      this.isRunning = true;
      this.isStopping = false;
      this.status = "connecting";

      this.syncLoopPromise = this.runSyncLoop();
      this.syncLoopPromise.catch((error) => {
        this.recordError(error, "background sync loop");
      });

      this.logger.info("Sync service started in background mode.");
    } catch (error) {
      this.recordError(error, "start");
      this.status = "error";
      throw new Error(`Failed to start sync service: ${error.message}`);
    }
  }

  /**
   * Stops the synchronization loop and closes all connections.
   * @returns {Promise<void>} Promise resolved after shutdown.
   */
  async stop() {
    try {
      this.isStopping = true;
      this.isRunning = false;

      if (this.changeStream) {
        await this.changeStream.close();
      }

      if (this.syncLoopPromise) {
        await this.syncLoopPromise;
      }

      await this.safeCloseConnections();
      this.status = "stopped";
      this.logger.info("Sync service stopped.");
    } catch (error) {
      this.recordError(error, "stop");
      throw new Error(`Failed to stop sync service cleanly: ${error.message}`);
    }
  }

  /**
   * Returns current sync status for API clients.
   * @returns {Promise<object>} Current sync health and metrics.
   */
  async getStatus() {
    try {
      return {
        status: this.status,
        lastSyncedAt: this.lastSyncedAt,
        totalSynced: this.totalSynced,
        pendingErrors: this.pendingErrors.length,
        recentEvents: this.recentEvents.slice(0, DEFAULT_ACTIVITY_LIMIT)
      };
    } catch (error) {
      throw new Error(`Failed to retrieve sync status: ${error.message}`);
    }
  }

  /**
   * Triggers a manual full re-sync operation.
   * @returns {Promise<object>} Re-sync trigger response.
   */
  async forceResync() {
    try {
      if (this.isResyncing) {
        return {
          status: this.status,
          message: "A sync operation is already in progress.",
          accepted: false
        };
      }

      this.isResyncing = true;

      await this.ensureConnections();
      await this.fullResyncInternal("manual");

      this.hasCompletedInitialSync = true;
      this.status = "live";

      this.recordActivity({
        type: "manual-resync",
        message: "Manual full re-sync completed successfully.",
        details: { totalSynced: this.totalSynced }
      });

      return {
        status: this.status,
        message: "Manual full re-sync completed.",
        accepted: true
      };
    } catch (error) {
      this.recordError(error, "forceResync");
      this.status = "error";
      throw new Error(`Manual full re-sync failed: ${error.message}`);
    } finally {
      this.isResyncing = false;
    }
  }

  /**
   * Runs the continuous sync loop with reconnect behavior.
   * @returns {Promise<void>} Promise resolved when loop exits.
   */
  async runSyncLoop() {
    try {
      while (this.isRunning && !this.isStopping) {
        try {
          await this.ensureConnections();
          await this.loadResumeToken();

          if (!this.hasCompletedInitialSync) {
            await this.fullResyncInternal("startup");
            this.hasCompletedInitialSync = true;
          }

          await this.watchChangeStream();
        } catch (error) {
          this.status = "error";
          this.recordError(error, "sync loop iteration");

          await this.safeCloseConnections();

          if (this.isRunning && !this.isStopping) {
            this.logger.warn(
              `Sync loop will attempt reconnect in ${this.reconnectDelayMs}ms.`
            );
            await wait(this.reconnectDelayMs);
          }
        }
      }
    } catch (error) {
      this.status = "error";
      this.recordError(error, "runSyncLoop");
      throw new Error(`Sync loop terminated unexpectedly: ${error.message}`);
    }
  }

  /**
   * Ensures both source and target MongoDB clients are connected.
   * @returns {Promise<void>} Promise resolved after successful connections.
   */
  async ensureConnections() {
    try {
      if (this.sourceClient && this.targetClient && this.sourceDb && this.targetDb) {
        return;
      }

      this.status = "connecting";

      const sharedClientOptions = {
        maxPoolSize: 20,
        minPoolSize: 2,
        connectTimeoutMS: 10_000,
        socketTimeoutMS: 30_000,
        serverSelectionTimeoutMS: 10_000
      };

      this.sourceClient = new MongoClient(this.sourceUri, sharedClientOptions);
      this.targetClient = new MongoClient(this.targetUri, sharedClientOptions);

      await Promise.all([this.sourceClient.connect(), this.targetClient.connect()]);

      this.sourceDb = this.sourceClient.db(this.sourceDbName);
      this.targetDb = this.targetClient.db(this.targetDbName);

      this.recordActivity({
        type: "connection",
        message: "Source and target MongoDB connections established.",
        details: {
          sourceDbName: this.sourceDbName,
          targetDbName: this.targetDbName
        }
      });
    } catch (error) {
      throw new Error(`Failed to establish MongoDB connections: ${error.message}`);
    }
  }

  /**
   * Closes stream and database connections safely.
   * @returns {Promise<void>} Promise resolved after cleanup.
   */
  async safeCloseConnections() {
    try {
      if (this.changeStream) {
        await this.changeStream.close();
      }

      if (this.sourceClient) {
        await this.sourceClient.close();
      }

      if (this.targetClient) {
        await this.targetClient.close();
      }

      this.changeStream = null;
      this.sourceClient = null;
      this.targetClient = null;
      this.sourceDb = null;
      this.targetDb = null;
    } catch (error) {
      this.recordError(error, "safeCloseConnections");
      throw new Error(`Failed to close MongoDB resources: ${error.message}`);
    }
  }

  /**
   * Loads a persisted resume token from disk when available.
   * @returns {Promise<void>} Promise resolved after token load.
   */
  async loadResumeToken() {
    try {
      const fileContent = await fs.readFile(this.resumeFilePath, "utf8");
      const payload = JSON.parse(fileContent);
      this.resumeToken = payload?.resumeToken || null;
    } catch (error) {
      if (error.code === "ENOENT") {
        this.resumeToken = null;
        return;
      }

      throw new Error(`Failed to load resume token: ${error.message}`);
    }
  }

  /**
   * Persists the latest resume token to disk.
   * @param {object} resumeToken - Resume token from MongoDB change stream event.
   * @returns {Promise<void>} Promise resolved after save.
   */
  async saveResumeToken(resumeToken) {
    try {
      this.resumeToken = resumeToken;

      const tempPath = `${this.resumeFilePath}.tmp`;
      const payload = {
        resumeToken,
        updatedAt: new Date().toISOString()
      };

      await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
      await fs.rename(tempPath, this.resumeFilePath);
    } catch (error) {
      throw new Error(`Failed to save resume token: ${error.message}`);
    }
  }

  /**
   * Clears resume token from memory and disk.
   * @returns {Promise<void>} Promise resolved after cleanup.
   */
  async clearResumeToken() {
    try {
      this.resumeToken = null;
      await fs.rm(this.resumeFilePath, { force: true });
    } catch (error) {
      throw new Error(`Failed to clear resume token: ${error.message}`);
    }
  }

  /**
   * Resolves which collections should be synchronized.
   * @returns {Promise<string[]>} Collection names to sync.
   */
  async getCollectionsToSync() {
    try {
      const allCollections = await this.sourceDb
        .listCollections({}, { nameOnly: true })
        .toArray();

      const allCollectionNames = allCollections.map((item) => item.name);

      if (this.syncCollections.length === 0) {
        return allCollectionNames;
      }

      return allCollectionNames.filter((collectionName) =>
        this.syncCollections.includes(collectionName)
      );
    } catch (error) {
      throw new Error(`Failed to resolve sync collections: ${error.message}`);
    }
  }

  /**
   * Performs a full snapshot copy from source DB to target DB.
   * @param {string} trigger - Trigger type: startup or manual.
   * @returns {Promise<void>} Promise resolved after full sync.
   */
  async fullResyncInternal(trigger) {
    try {
      this.status = "syncing";

      const collections = await this.getCollectionsToSync();

      this.recordActivity({
        type: "full-sync-start",
        message: `Full sync started (${trigger}).`,
        details: { collections }
      });

      for (const collectionName of collections) {
        await this.syncCollectionSnapshot(collectionName);
      }

      this.lastSyncedAt = new Date().toISOString();

      this.recordActivity({
        type: "full-sync-complete",
        message: `Full sync completed (${trigger}).`,
        details: {
          collectionsSynced: collections.length,
          totalSynced: this.totalSynced
        }
      });

      this.status = "live";
    } catch (error) {
      throw new Error(`Full re-sync failed: ${error.message}`);
    }
  }

  /**
   * Synchronizes one collection snapshot into target database.
   * @param {string} collectionName - Collection name.
   * @returns {Promise<void>} Promise resolved after collection sync.
   */
  async syncCollectionSnapshot(collectionName) {
    try {
      const sourceCollection = this.sourceDb.collection(collectionName);
      const targetCollection = this.targetDb.collection(collectionName);

      await targetCollection.deleteMany({});

      const cursor = sourceCollection.find({});

      let batch = [];
      let syncedCount = 0;

      for await (const document of cursor) {
        batch.push(document);

        if (batch.length >= this.batchSize) {
          await targetCollection.insertMany(batch, { ordered: false });
          syncedCount += batch.length;
          batch = [];
        }
      }

      if (batch.length > 0) {
        await targetCollection.insertMany(batch, { ordered: false });
        syncedCount += batch.length;
      }

      this.totalSynced += syncedCount;
      this.lastSyncedAt = new Date().toISOString();

      this.recordActivity({
        type: "collection-sync",
        message: `Collection snapshot synced: ${collectionName}`,
        details: {
          collectionName,
          syncedCount
        }
      });

      this.logger.info("Collection snapshot synced.", {
        collectionName,
        syncedCount,
        trigger: "snapshot"
      });
    } catch (error) {
      throw new Error(`Collection sync failed for ${collectionName}: ${error.message}`);
    }
  }

  /**
   * Watches source database change stream and mirrors real-time events.
   * @returns {Promise<void>} Promise resolved only when stream closes during shutdown.
   */
  async watchChangeStream() {
    try {
      const watchOptions = {
        fullDocument: "updateLookup"
      };

      if (this.resumeToken) {
        watchOptions.resumeAfter = this.resumeToken;
      }

      this.changeStream = this.sourceDb.watch([], watchOptions);
      this.status = "live";

      this.recordActivity({
        type: "change-stream-start",
        message: "Change stream started.",
        details: {
          resumed: Boolean(this.resumeToken)
        }
      });

      for await (const changeEvent of this.changeStream) {
        await this.handleChangeEvent(changeEvent);
      }

      if (!this.isStopping && this.isRunning) {
        throw new Error("Change stream closed unexpectedly.");
      }
    } catch (error) {
      throw new Error(`Change stream watcher failed: ${error.message}`);
    }
  }

  /**
   * Handles a single change stream event.
   * @param {object} changeEvent - MongoDB change stream event.
   * @returns {Promise<void>} Promise resolved after event mirror.
   */
  async handleChangeEvent(changeEvent) {
    try {
      const collectionName = changeEvent?.ns?.coll;

      if (!collectionName) {
        if (changeEvent?._id) {
          await this.saveResumeToken(changeEvent._id);
        }

        this.recordActivity({
          type: "change-skip",
          message: "Change event skipped because collection name is missing.",
          details: { operationType: changeEvent?.operationType }
        });
        return;
      }

      if (this.syncCollections.length > 0 && !this.syncCollections.includes(collectionName)) {
        if (changeEvent?._id) {
          await this.saveResumeToken(changeEvent._id);
        }
        return;
      }

      const targetCollection = this.targetDb.collection(collectionName);
      const operationType = changeEvent.operationType;

      if (operationType === "insert" || operationType === "replace") {
        await targetCollection.replaceOne(
          { _id: changeEvent.fullDocument._id },
          changeEvent.fullDocument,
          { upsert: true }
        );
      } else if (operationType === "update") {
        const fullDocument =
          changeEvent.fullDocument ||
          (await this.fetchSourceDocument(collectionName, changeEvent?.documentKey?._id));

        if (fullDocument) {
          await targetCollection.replaceOne({ _id: fullDocument._id }, fullDocument, {
            upsert: true
          });
        }
      } else if (operationType === "delete") {
        await targetCollection.deleteOne({ _id: changeEvent.documentKey._id });
      } else if (operationType === "drop") {
        await targetCollection.drop().catch((dropError) => {
          if (dropError.codeName !== "NamespaceNotFound") {
            throw dropError;
          }
        });
      } else if (operationType === "rename") {
        const destinationName = changeEvent?.to?.coll;
        if (destinationName) {
          await targetCollection.rename(destinationName, { dropTarget: true });
        }
      } else if (operationType === "invalidate") {
        await this.clearResumeToken();
        this.hasCompletedInitialSync = false;
        throw new Error("Change stream invalidated. A full sync will run on reconnect.");
      }

      await this.saveResumeToken(changeEvent._id);

      this.totalSynced += 1;
      this.lastSyncedAt = new Date().toISOString();

      this.recordActivity({
        type: "change",
        message: `Mirrored ${this.operationToHumanText(operationType)} for ${collectionName}.`,
        details: {
          operationType,
          collectionName,
          documentKey: changeEvent?.documentKey || null
        }
      });

      this.logger.info("Change event mirrored.", {
        operationType,
        collectionName,
        documentKey: changeEvent?.documentKey || null
      });
    } catch (error) {
      throw new Error(`Failed to handle change event: ${error.message}`);
    }
  }

  /**
   * Fetches the latest source document by _id.
   * @param {string} collectionName - Source collection name.
   * @param {unknown} id - Document identifier.
   * @returns {Promise<object|null>} Source document or null.
   */
  async fetchSourceDocument(collectionName, id) {
    try {
      if (id === undefined || id === null) {
        return null;
      }

      return await this.sourceDb.collection(collectionName).findOne({ _id: id });
    } catch (error) {
      throw new Error(`Failed to fetch source document from ${collectionName}: ${error.message}`);
    }
  }

  /**
   * Adds an activity event to in-memory rolling log.
   * @param {object} event - Event payload.
   * @returns {void}
   */
  recordActivity(event) {
    try {
      const activityEntry = {
        timestamp: new Date().toISOString(),
        ...event
      };

      this.recentEvents.unshift(activityEntry);
      this.recentEvents = this.recentEvents.slice(0, DEFAULT_ACTIVITY_LIMIT);
    } catch (error) {
      this.logger.error("Failed to record activity entry.", {
        error: error.message,
        event
      });
    }
  }

  /**
   * Adds an error event to logger and in-memory error queue.
   * @param {Error} error - Original error object.
   * @param {string} context - Error context string.
   * @returns {void}
   */
  recordError(error, context) {
    try {
      this.logger.error("Sync service error.", {
        context,
        message: error.message,
        stack: error.stack
      });

      this.pendingErrors.unshift({
        timestamp: new Date().toISOString(),
        context,
        message: error.message
      });

      this.pendingErrors = this.pendingErrors.slice(0, DEFAULT_ERROR_LIMIT);

      this.recordActivity({
        type: "error",
        message: `Error in ${context}: ${error.message}`,
        details: { context }
      });
    } catch (recordingError) {
      this.logger.error("Failed to record sync error metadata.", {
        message: recordingError.message
      });
    }
  }

  /**
   * Converts a MongoDB operation type into a readable action string.
   * @param {string} operationType - MongoDB operation type.
   * @returns {string} Readable operation text.
   */
  operationToHumanText(operationType) {
    try {
      const operationMap = {
        insert: "insert",
        update: "update",
        replace: "replace",
        delete: "delete",
        drop: "drop",
        rename: "rename",
        invalidate: "invalidation"
      };

      return operationMap[operationType] || "event";
    } catch (error) {
      throw new Error(`Failed to map operation type: ${error.message}`);
    }
  }
}

module.exports = {
  SyncService,
  createSyncLogger,
  parseSyncCollections
};
