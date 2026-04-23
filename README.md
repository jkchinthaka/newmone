# MongoDB Real-Time Sync System (Express + Native MongoDB Driver)

This project runs a production-ready real-time MongoDB Atlas sync pipeline with:

- Full startup copy of existing data from source DB to target DB
- Continuous live sync for new changes via MongoDB Change Streams
- Resume token persistence (`sync_resume.json`) for restart safety
- Auto reconnect every 5 seconds on stream/connection failures
- Sync status APIs and manual force re-sync
- Browser dashboard for live monitoring and control

## Tech Stack

- Backend: Node.js + Express
- Frontend: HTML + JavaScript dashboard
- Database: MongoDB Atlas (native `mongodb` driver, no Mongoose)

## Files Included

- `services/syncService.js`
- `routes/syncRoutes.js`
- `server.js`
- `frontend/sync-dashboard.html`
- `.env.example`
- `package.json`
- `scripts/bootstrap.js`
- `sync_resume.json` (auto-created)

## One-Time Setup

1. Install dependencies:
   `npm install`
2. The bootstrap script auto-creates `.env` from `.env.example` if missing.

## Run

- Production:
  `npm start`
- Development (auto-reload):
  `npm run dev`

Server starts on `http://localhost:5000` by default.

## Dashboard

- Open `http://localhost:5000/`
- It auto-refreshes every 10 seconds and shows:
  - Sync status (`Live`, `Error`, `Syncing`)
  - Total documents synced
  - Last synced timestamp
  - Pending error count
  - Last 10 activity events
  - Force re-sync button

## API Endpoints

- `GET /api/sync/status`
  - Returns:
    - `status`
    - `lastSyncedAt`
    - `totalSynced`
    - `pendingErrors`
    - `recentActivity` (last 10)

- `POST /api/sync/force`
  - Queues a manual full re-sync

- `GET /health`
  - Basic health check for Express process

## Environment Configuration

`.env.example` ships with working values for your cluster. You can update them if needed:

- `MONGO_URI`
- `TARGET_MONGO_URI`
- `MONGO_DB_NAME`
- `TARGET_MONGO_DB_NAME`
- `SYNC_COLLECTIONS` (comma-separated, blank = all)
- `SYNC_LOG_LEVEL`
- `PORT`

## Reliability Notes

- Sync runs in the background and does not block Express startup.
- Sync crashes are isolated and will not terminate the Express server.
- On failures, the service retries with a 5-second reconnect delay.
- Every sync operation is logged through Winston.
