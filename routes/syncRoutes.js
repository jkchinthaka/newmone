const express = require("express");

/**
 * Build sync API router.
 * @param {import("../services/syncService")} syncService - Active sync service instance.
 * @returns {import("express").Router}
 */
function createSyncRoutes(syncService) {
  const router = express.Router();

  /**
   * Return current sync status.
   */
  router.get("/status", async (req, res) => {
    try {
      const status = syncService.getStatus();
      res.status(200).json(status);
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch sync status.",
        error: error.message,
      });
    }
  });

  /**
   * Force a manual full re-sync.
   */
  router.post("/force", async (req, res) => {
    try {
      const result = await syncService.forceResync();
      res.status(202).json({
        message: result.message,
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to queue force re-sync.",
        error: error.message,
      });
    }
  });

  return router;
}

module.exports = createSyncRoutes;
