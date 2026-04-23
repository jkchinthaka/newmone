"use strict";

const express = require("express");

/**
 * Builds sync routes for status and manual re-sync endpoints.
 * @param {object} params - Route initialization params.
 * @param {import('../services/syncService').SyncService} params.syncService - Sync service instance.
 * @param {import('winston').Logger} params.logger - Shared application logger.
 * @returns {express.Router} Configured Express router.
 */
function buildSyncRoutes({ syncService, logger }) {
  try {
    const router = express.Router();

    /**
     * Returns sync service current status.
     */
    router.get("/status", async (req, res) => {
      try {
        const statusPayload = await syncService.getStatus();
        res.status(200).json(statusPayload);
      } catch (error) {
        logger.error("Failed to fetch sync status.", {
          message: error.message,
          stack: error.stack
        });

        res.status(500).json({
          status: "error",
          message: "Unable to fetch sync status.",
          error: error.message
        });
      }
    });

    /**
     * Triggers a manual full re-sync.
     */
    router.post("/force", async (req, res) => {
      try {
        const result = await syncService.forceResync();

        const statusCode = result.accepted ? 202 : 200;
        res.status(statusCode).json(result);
      } catch (error) {
        logger.error("Failed to execute manual full re-sync.", {
          message: error.message,
          stack: error.stack
        });

        res.status(500).json({
          status: "error",
          message: "Manual full re-sync failed.",
          error: error.message
        });
      }
    });

    return router;
  } catch (error) {
    throw new Error(`Failed to build sync routes: ${error.message}`);
  }
}

module.exports = buildSyncRoutes;
