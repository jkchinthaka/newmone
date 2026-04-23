const fs = require("fs/promises");
const path = require("path");
const { MongoClient } = require("mongodb");
const winston = require("winston");

/**
 * Sleep utility for retry loops.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
async function sleep(ms) {
  try {
    await new Promise((resolve) => setTimeout(resolve, ms));
  } catch (error) {
    throw new Error(`Failed while waiting in retry loop: ${error.message}`);
  }
}

/**
 * Parse a comma-separated collection list.
 * @param {string|undefined} rawValue - Raw env value.
 * @returns {string[]}
 */
function parseCollections(rawValue) {
  try {
    if (!rawValue || !rawValue.trim()) {
      return [];
    }

    return rawValue
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch (error) {
    throw new Error(`Failed to parse SYNC_COLLECTIONS: ${error.message}`);
  }
}

/**
 * Build a default Winston logger when one is not injected.
 * @returns {winston.Logger}
 */
function createDefaultLogger() {
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
    throw new Error(`Failed to create logger: ${error.message}`);
  }
}

/**
 * Production-ready MongoDB sync service using native driver + change streams.
 */
class SyncService {
  /**
   * @param {{ logger?: winston.Logger }} [options] - Optional service dependencies.
   */
  constructor(options = {}) {
    try {
      this.logger = options.logger || createDefaultLogger();

      this.sourceUri = process.env.MONGO_URI;
      this.targetUri = process.env.TARGET_MONGO_URI;
      this.sourceDbName = process.env.MONGO_DB_NAME || "nelna";
      this.targetDbName = process.env.TARGET_MONGO_DB_NAME || "nelna_mirror";
      this.collectionFilter = parseCollections(process.env.SYNC_COLLECTIONS);

      this.resumeTokenPath = path.resolve(process.cwd(), "sync_resume.json");
      this.sourceClient = null;
      this.targetClient = null;
      this.sourceDb = null;
      this.targetDb = null;
      this.changeStream = null;
      this.resumeToken = null;

      this.isRunning = false;
      this.hasCompletedInitialSync = false;
      this.forceResyncRequested = false;
      this.fullSyncInProgress = false;

      this.status = "idle";
      this.totalSynced = 0;
      this.lastSyncedAt = null;
      this.pendingErrors = [];
      this.recentActivity = [];
      this.reconnectDelayMs = 5000;
    } catch (error) {
      throw new Error(`Failed to initialize SyncService: ${error.message}`);
    }
  }

  /**
   * Start sync supervisor loop in the background.
   * @returns {Promise<void>}
   */
  async start() {
    try {
      if (this.isRunning) {
        return;
      }

      if (!this.sourceUri || !this.targetUri) {
        throw new Error(
          "MONGO_URI and TARGET_MONGO_URI must be set before starting sync service."
        );
      }

      this.isRunning = true;
      this.status = "syncing";
      this.resumeToken = await this.loadResumeToken();
      this.runSupervisorLoop().catch((error) => {
        this.recordError(`Sync supervisor crashed: ${error.message}`);
      });
    } catch (error) {
      this.status = "error";
      this.recordError(`Failed to start sync service: ${error.message}`);
    }
  }

  /**
   * Stop sync service and close active resources.
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      this.isRunning = false;

      if (this.changeStream) {
        await this.changeStream.close();
        this.changeStream = null;
      }

      if (this.sourceClient) {
        await this.sourceClient.close();
        this.sourceClient = null;
      }

      if (this.targetClient) {
        await this.targetClient.close();
        this.targetClient = null;
      }

      this.status = "idle";
    } catch (error) {
      this.recordError(`Failed to stop sync service cleanly: ${error.message}`);
    }
  }

  /**
   * Force a new full data sync.
   * @returns {Promise<{message: string}>}
   */
  async forceResync() {
    try {
      this.forceResyncRequested = true;
      this.status = "syncing";
      this.pushActivity("manual_force_resync", "Manual force re-sync requested.");

      if (this.changeStream) {
        await this.changeStream.close();
      }

      return { message: "Force re-sync queued successfully." };
    } catch (error) {
      throw new Error(`Failed to queue force re-sync: ${error.message}`);
    }
  }

  /**
   * Get current sync status snapshot.
   * @returns {{
   *   status: string,
   *   lastSyncedAt: string|null,
   *   totalSynced: number,
   *   pendingErrors: number,
   *   recentActivity: Array<{at: string, type: string, message: string}>
   * }}
   */
  getStatus() {
    try {
      return {
        status: this.status,
        lastSyncedAt: this.lastSyncedAt,
        totalSynced: this.totalSynced,
        pendingErrors: this.pendingErrors.length,
        recentActivity: this.recentActivity,
      };
    } catch (error) {
      this.recordError(`Failed to get sync status: ${error.message}`);
      return {
        status: "error",
        lastSyncedAt: this.lastSyncedAt,
        totalSynced: this.totalSynced,
        pendingErrors: this.pendingErrors.length,
        recentActivity: this.recentActivity,
      };
    }
  }

  /**
   * Core supervisor loop: connect, full sync, stream changes, retry on failures.
   * @returns {Promise<void>}
   */
  async runSupervisorLoop() {
    try {
      while (this.isRunning) {
        try {
          await this.ensureConnections();

          if (!this.hasCompletedInitialSync || this.forceResyncRequested) {
            await this.performFullSync();
            this.hasCompletedInitialSync = true;
            this.forceResyncRequested = false;
          }

          await this.watchChangesLoop();
        } catch (error) {
          this.status = "error";
          this.recordError(`Sync loop error: ${error.message}`);
          await this.closeClients();
          if (this.isRunning) {
            await sleep(this.reconnectDelayMs);
          }
        }
      }
    } catch (error) {
      throw new Error(`Supervisor loop terminated unexpectedly: ${error.message}`);
    }
  }

  /**
   * Ensure source and target clients are connected.
   * @returns {Promise<void>}
   */
  async ensureConnections() {
    try {
      if (!this.sourceClient) {
        this.sourceClient = new MongoClient(this.sourceUri, { maxPoolSize: 20 });
        await this.sourceClient.connect();
      }

      if (!this.targetClient) {
        this.targetClient = new MongoClient(this.targetUri, { maxPoolSize: 20 });
        await this.targetClient.connect();
      }

      this.sourceDb = this.sourceClient.db(this.sourceDbName);
      this.targetDb = this.targetClient.db(this.targetDbName);
      this.pushActivity(
        "connect",
        `Connected source (${this.sourceDbName}) and target (${this.targetDbName}) databases.`
      );
    } catch (error) {
      throw new Error(`Failed to connect to MongoDB Atlas: ${error.message}`);
    }
  }

  /**
   * Close MongoDB clients and stream resources.
   * @returns {Promise<void>}
   */
  async closeClients() {
    try {
      if (this.changeStream) {
        await this.changeStream.close();
        this.changeStream = null;
      }

      if (this.sourceClient) {
        await this.sourceClient.close();
        this.sourceClient = null;
      }

      if (this.targetClient) {
        await this.targetClient.close();
        this.targetClient = null;
      }
    } catch (error) {
      this.recordError(`Failed to close MongoDB clients: ${error.message}`);
    }
  }

  /**
   * Load persisted resume token from disk.
   * @returns {Promise<object|null>}
   */
  async loadResumeToken() {
    try {
      const fileContents = await fs.readFile(this.resumeTokenPath, "utf8");
      const parsed = JSON.parse(fileContents);
      if (!parsed || typeof parsed !== "object" || typeof parsed._data !== "string") {
        return null;
      }
      return parsed;
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      this.recordError(`Failed to load resume token: ${error.message}`);
      return null;
    }
  }

  /**
   * Persist resume token to disk for restart safety.
   * @param {object} token - Change stream resume token.
   * @returns {Promise<void>}
   */
  async saveResumeToken(token) {
    try {
      if (!token) {
        return;
      }

      await fs.writeFile(this.resumeTokenPath, JSON.stringify(token, null, 2), "utf8");
    } catch (error) {
      this.recordError(`Failed to save resume token: ${error.message}`);
    }
  }

  /**
   * Find list of source collections to synchronize.
   * @returns {Promise<string[]>}
   */
  async getCollectionsToSync() {
    try {
      const collections = await this.sourceDb.listCollections({}, { nameOnly: true }).toArray();
      const sourceCollectionNames = collections.map((item) => item.name);

      if (this.collectionFilter.length === 0) {
        return sourceCollectionNames;
      }

      return sourceCollectionNames.filter((name) => this.collectionFilter.includes(name));
    } catch (error) {
      throw new Error(`Failed to resolve collections to sync: ${error.message}`);
    }
  }

  /**
   * Perform startup/manual full copy of selected collections and documents.
   * @returns {Promise<void>}
   */
  async performFullSync() {
    try {
      if (this.fullSyncInProgress) {
        return;
      }

      this.fullSyncInProgress = true;
      this.status = "syncing";
      this.pushActivity("full_sync_start", "Full sync started.");

      const collections = await this.getCollectionsToSync();

      for (const collectionName of collections) {
        await this.copyCollection(collectionName);
      }

      this.pushActivity(
        "full_sync_complete",
        `Full sync completed for ${collections.length} collection(s).`
      );
      this.status = "live";
    } catch (error) {
      this.status = "error";
      throw new Error(`Full sync failed: ${error.message}`);
    } finally {
      this.fullSyncInProgress = false;
    }
  }

  /**
   * Copy one collection from source to target in batches.
   * @param {string} collectionName - Collection to copy.
   * @returns {Promise<void>}
   */
  async copyCollection(collectionName) {
    try {
      const sourceCollection = this.sourceDb.collection(collectionName);
      const targetCollection = this.targetDb.collection(collectionName);

      await targetCollection.deleteMany({});

      const cursor = sourceCollection.find({});
      let batch = [];
      let copiedCount = 0;

      for await (const document of cursor) {
        batch.push(document);
        if (batch.length >= 1000) {
          await targetCollection.insertMany(batch, { ordered: false });
          copiedCount += batch.length;
          this.totalSynced += batch.length;
          batch = [];
        }
      }

      if (batch.length > 0) {
        await targetCollection.insertMany(batch, { ordered: false });
        copiedCount += batch.length;
        this.totalSynced += batch.length;
      }

      this.lastSyncedAt = new Date().toISOString();
      this.pushActivity(
        "full_sync_collection",
        `Collection "${collectionName}" synced with ${copiedCount} document(s).`
      );
      this.logger.info("Collection sync completed", {
        event: "full_sync_collection",
        collection: collectionName,
        copiedCount,
      });
    } catch (error) {
      throw new Error(`Failed to copy collection "${collectionName}": ${error.message}`);
    }
  }

  /**
   * Start and maintain DB-level change stream processing.
   * @returns {Promise<void>}
   */
  async watchChangesLoop() {
    try {
      this.status = "live";
      this.pushActivity("watch_start", "Change stream watch started.");

      const pipeline = [];
      if (this.collectionFilter.length > 0) {
        pipeline.push({
          $match: {
            "ns.coll": { $in: this.collectionFilter },
          },
        });
      }

      const options = { fullDocument: "updateLookup" };
      if (this.resumeToken) {
        options.resumeAfter = this.resumeToken;
      }

      this.changeStream = this.sourceDb.watch(pipeline, options);

      for await (const changeEvent of this.changeStream) {
        await this.handleChangeEvent(changeEvent);
      }

      throw new Error("Change stream ended unexpectedly.");
    } catch (error) {
      throw new Error(`Change stream watch failed: ${error.message}`);
    } finally {
      if (this.changeStream) {
        await this.changeStream.close();
        this.changeStream = null;
      }
    }
  }

  /**
   * Mirror one change stream event to target DB.
   * @param {import("mongodb").ChangeStreamDocument} changeEvent - Incoming event.
   * @returns {Promise<void>}
   */
  async handleChangeEvent(changeEvent) {
    try {
      const collectionName = changeEvent.ns && changeEvent.ns.coll ? changeEvent.ns.coll : null;
      if (!collectionName) {
        return;
      }

      const targetCollection = this.targetDb.collection(collectionName);

      if (changeEvent.operationType === "insert") {
        await targetCollection.replaceOne(
          { _id: changeEvent.fullDocument._id },
          changeEvent.fullDocument,
          { upsert: true }
        );
      } else if (changeEvent.operationType === "update") {
        await targetCollection.replaceOne(
          { _id: changeEvent.documentKey._id },
          changeEvent.fullDocument,
          { upsert: true }
        );
      } else if (changeEvent.operationType === "replace") {
        await targetCollection.replaceOne(
          { _id: changeEvent.fullDocument._id },
          changeEvent.fullDocument,
          { upsert: true }
        );
      } else if (changeEvent.operationType === "delete") {
        await targetCollection.deleteOne({ _id: changeEvent.documentKey._id });
      } else {
        this.pushActivity(
          "watch_skipped",
          `Skipped unsupported operation "${changeEvent.operationType}" on "${collectionName}".`
        );
      }

      this.resumeToken = changeEvent._id;
      await this.saveResumeToken(this.resumeToken);

      this.totalSynced += 1;
      this.lastSyncedAt = new Date().toISOString();
      this.pushActivity(
        "watch_event",
        `${changeEvent.operationType} mirrored on collection "${collectionName}".`
      );

      this.logger.info("Change event mirrored", {
        event: "watch_event",
        operationType: changeEvent.operationType,
        collection: collectionName,
        documentKey: changeEvent.documentKey,
      });
    } catch (error) {
      throw new Error(`Failed to mirror change event: ${error.message}`);
    }
  }

  /**
   * Push one activity item to in-memory recent activity list.
   * @param {string} type - Event type.
   * @param {string} message - Human-readable event message.
   * @returns {void}
   */
  pushActivity(type, message) {
    try {
      const entry = {
        at: new Date().toISOString(),
        type,
        message,
      };

      this.recentActivity.unshift(entry);
      if (this.recentActivity.length > 10) {
        this.recentActivity = this.recentActivity.slice(0, 10);
      }

      this.logger.info("Sync activity", entry);
    } catch (error) {
      this.logger.error("Failed to append sync activity", { error: error.message });
    }
  }

  /**
   * Record error in memory and logger.
   * @param {string} message - Error message.
   * @returns {void}
   */
  recordError(message) {
    try {
      const entry = {
        at: new Date().toISOString(),
        message,
      };

      this.pendingErrors.unshift(entry);
      if (this.pendingErrors.length > 100) {
        this.pendingErrors = this.pendingErrors.slice(0, 100);
      }

      this.pushActivity("error", message);
      this.logger.error("Sync error", entry);
    } catch (error) {
      this.logger.error("Failed while recording sync error", { error: error.message });
    }
  }
}

module.exports = SyncService;
