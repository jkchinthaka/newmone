# Real-Time MongoDB Sync System (Express + HTML Dashboard)

This project is a standalone Node.js + Express service that mirrors data from one MongoDB Atlas database to another in real time.

Frontend choice: **HTML + JavaScript** (served by Express).

## What this system does automatically

1. Loads environment values from `.env`.
2. If `.env` is missing, it automatically creates it from `.env.example`.
3. Connects to source and target MongoDB Atlas databases using the native MongoDB driver.
4. Performs a full snapshot sync of existing documents on startup.
5. Starts a MongoDB Change Stream to mirror all real-time changes.
6. Persists the latest resume token in `sync_resume.json` for restart-safe continuation.
7. Reconnects every 5 seconds if the stream or connection drops.
8. Keeps Express server alive even if sync fails.
9. Exposes monitoring and control APIs.
10. Serves a dashboard page with live sync metrics and manual force re-sync.

## Project structure

- `services/syncService.js` — full sync + real-time change stream mirror logic.
- `routes/syncRoutes.js` — sync API endpoints.
- `server.js` — Express bootstrap + background sync startup.
- `frontend/sync-dashboard.html` — dashboard UI with auto-refresh.
- `.env.example` — complete runtime environment template.
- `package.json` — dependencies and scripts.

## Setup and run

1. Open a terminal in this folder:
   `maintainpro/realtime-mongo-sync`

2. Install dependencies:
   `npm install`

3. Start the service:
   `npm start`

4. Open dashboard in browser:
   `http://localhost:5000/`

## API endpoints

- `GET /api/sync/status`
  - Returns:
    - `status`
    - `lastSyncedAt`
    - `totalSynced`
    - `pendingErrors`
    - `recentEvents` (last 10)

- `POST /api/sync/force`
  - Triggers manual full re-sync of selected collections.

## Environment variables

- `MONGO_URI` — source MongoDB Atlas URI.
- `TARGET_MONGO_URI` — target MongoDB Atlas URI.
- `SYNC_COLLECTIONS` — comma-separated collection names. Leave blank to sync all collections.
- `SYNC_LOG_LEVEL` — Winston log level (`info`, `warn`, `error`, `debug`).
- `PORT` — Express server port.

## Operational notes

- Snapshot sync clears target collections before repopulating from source.
- Change Stream updates keep target database continuously in sync.
- Resume token file is written to `sync_resume.json` in this folder.
- If you rotate credentials, update `.env` and restart the service.
