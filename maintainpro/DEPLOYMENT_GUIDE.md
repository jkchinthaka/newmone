# MaintainPro Deployment Guide

This guide prepares MaintainPro for a low-cost production deployment using:

- Frontend: Vercel
- Backend API: Render Web Service
- Database: MongoDB Atlas M0 Free Tier
- File storage: Cloudinary when configured, with local filesystem fallback for development

## 1. Project Structure

MaintainPro is an npm workspace monorepo.

- `apps/web`: Next.js frontend deployed to Vercel
- `apps/api`: NestJS API deployed to Render
- `packages/shared-types`: shared TypeScript package required by both apps
- `packages/ui-components`: shared UI package used by the full monorepo build
- `prisma/schema.prisma`: Prisma MongoDB schema

Run commands from the `maintainpro` directory unless a platform setting says otherwise.

## 2. MongoDB Atlas Free Tier

1. Create a MongoDB Atlas account.
2. Create an M0 free cluster.
3. Create a database user with a strong password.
4. In Network Access, allow Render to connect.
   - Recommended: add the outbound ranges shown by your Render service/region.
   - For this workspace, use:
     - `74.220.49.0/24`
     - `74.220.57.0/24`
   - Quick trial fallback: `0.0.0.0/0` (less secure; avoid for long-term production).
5. Click Connect, choose Drivers, and copy the Node.js connection string.
6. Replace the username, password, cluster host, and database name. Use the launch database path, for example `/bileeta_db`.
7. Set both Render variables to the same Atlas URI:
   - `DATABASE_PROVIDER=mongodb`
   - `MONGO_DATABASE_NAME=bileeta_db`
   - `MONGO_SYNC_ON_STARTUP=false`
   - `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>/bileeta_db?retryWrites=true&w=majority`
   - `DATABASE_URL=mongodb+srv://<user>:<password>@<cluster-host>/bileeta_db?retryWrites=true&w=majority`

Before routing production traffic, push the Prisma MongoDB schema and seed initial data from a Render shell or a one-off job:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

For the full rehearsal, rollback, and verification checklist, use [DATABASE_MIGRATION_TO_MONGODB.md](DATABASE_MIGRATION_TO_MONGODB.md).

## 3. Render Backend Settings

Recommended setup: create a Render Blueprint from the repository root. The root `render.yaml` already points Render to the `maintainpro` monorepo folder.

Manual Render Web Service settings:

- Runtime: `Node`
- Root Directory: `maintainpro`
- Build Command: `npm install && npm run render:build`
- Start Command: `npm run render:start`
- Health Check Path: `/health`
- Plan: `Free` for trial, upgrade when production traffic grows
- Auto Deploy: enabled

Required Render environment variables:

```env
NODE_ENV=production
DATABASE_PROVIDER=mongodb
MONGO_DATABASE_NAME=bileeta_db
MONGO_SYNC_ON_STARTUP=false
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>/bileeta_db?retryWrites=true&w=majority
DATABASE_URL=mongodb+srv://<user>:<password>@<cluster-host>/bileeta_db?retryWrites=true&w=majority
JWT_SECRET=<strong-random-secret>
CORS_ORIGIN=https://your-vercel-app.vercel.app
FRONTEND_URL=https://your-vercel-app.vercel.app
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
```

Optional Render variables:

```env
REDIS_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_ASSET_FOLDER=maintainpro/asset-documents
SMTP_HOST=
SMTP_PORT=
SMTP_ENABLED=false
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=MaintainPro Alerts <alerts@example.com>
SMS_ENABLED=false
SMS_API_URL=
SMS_API_KEY=
SMS_API_SECRET=
SMS_AUTH_HEADER=Authorization
SMS_SENDER_ID=MaintainPro
ERP_SYNC_PROVIDER=mock
ERP_SYNC_ALLOW_MOCK_IN_PRODUCTION=false
ERP_PROVIDER_ID=
ERP_API_URL=
ERP_API_KEY=
ERP_AUTH_HEADER=Authorization
ERP_TIMEOUT_MS=15000
PUSH_PROVIDER=noop
PUSH_PROVIDER_ENABLED=false
PUSH_PROVIDER_API_URL=
PUSH_PROVIDER_API_KEY=
PUSH_PROVIDER_AUTH_HEADER=Authorization
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://your-render-api.onrender.com/api/auth/google/callback
```

Notes:

- Render injects `PORT`; do not hardcode it in production.
- `JWT_SECRET` is enough for low-cost deployment. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` remain supported if you want split secrets.
- Without `REDIS_URL`, background queues may be degraded, but the API can boot and `/health` will still report database status.
- Cloudinary is recommended for persistent file uploads on Render. Render free instance disk is ephemeral.
- Leave SMTP, SMS, ERP, and push enable flags as `false` until provider credentials and webhook/firewall requirements are verified. `/health/ready` reports each provider as configured, disabled, or degraded.
- Keep `ERP_SYNC_PROVIDER=mock` only for trials. For production ERP sync, switch to `http` and set `ERP_API_URL` plus `ERP_API_KEY`; mock mode is blocked in production unless explicitly allowed.
- If Atlas (or another external provider) enforces IP allowlists, include your Render outbound CIDRs (`74.220.49.0/24`, `74.220.57.0/24`) in that provider's firewall rules.

## 4. Vercel Frontend Settings

Recommended Vercel project settings when the Vercel project root is `maintainpro`:

- Framework Preset: `Next.js`
- Root Directory: `maintainpro`
- Install Command: `npm install`
- Build Command: `npm run vercel:build`
- Output Directory: `apps/web/.next`

If Vercel is connected to the repository root instead, the root `vercel.json` runs the same build from `maintainpro`.

Required Vercel environment variables:

```env
NEXT_PUBLIC_API_URL=https://your-render-api.onrender.com/api
NEXT_PUBLIC_API_BASE_URL=https://your-render-api.onrender.com/api
NEXT_PUBLIC_API_ORIGIN=https://your-render-api.onrender.com
```

`NEXT_PUBLIC_API_URL` is the primary variable. The other two are kept for compatibility and websocket clarity.

Cloudflare Workers/OpenNext remains supported for the web app. Use `npm run cloudflare:build` and keep `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_API_ORIGIN` pointed at the Render API origin before deploying with Wrangler.

## 4.1 Hosting And Domain Readiness

Before go-live:

- Select one frontend host as canonical: Vercel or Cloudflare Workers.
- Configure the custom app domain on the chosen frontend host and verify HTTPS issuance.
- Configure the custom API domain on Render, then update DNS with Render's required CNAME/ALIAS target.
- Set `CORS_ORIGIN` and `FRONTEND_URL` to the final frontend origin without a trailing slash.
- Set `NEXT_PUBLIC_API_URL` to the final API URL ending in `/api`, and `NEXT_PUBLIC_API_ORIGIN` to the API origin without `/api`.
- Redeploy API and web after domain environment variables are changed.
- Verify `/health` and `/health/ready` on the custom API domain before switching users to the new URL.

## 5. Cloudinary File Storage

1. Create a Cloudinary account.
2. Open Dashboard and copy Cloud Name, API Key, and API Secret.
3. Add these variables in Render:

```env
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
CLOUDINARY_ASSET_FOLDER=maintainpro/asset-documents
```

When all three credentials are present, asset document uploads are stored in Cloudinary. If they are blank, the API falls back to local disk storage for development.

## 6. Local Deployment Checks

Before pushing:

```bash
npm run deploy:check
```

This runs TypeScript checks plus the Render and Vercel production builds.

After publishing both services, run a live smoke test:

```bash
$env:MAINTAINPRO_WEB_URL="https://your-vercel-app.vercel.app"
$env:MAINTAINPRO_API_URL="https://your-render-api.onrender.com/api"
$env:MAINTAINPRO_SMOKE_EMAIL="admin@maintainpro.local"
$env:MAINTAINPRO_SMOKE_PASSWORD="Admin@1234"
npm run smoke:deploy
```

The smoke test verifies:

- Vercel frontend returns valid Next.js HTML
- Render `/health` is reachable
- MongoDB Atlas status is operational
- `/health/ready` reports required services as `ok` and optional disabled providers as intentionally disabled, not misconfigured
- CORS accepts the Vercel origin with credentials
- Login endpoint returns a valid response without exposing `passwordHash`

## 7. Common Deployment Errors

### Vercel shows `404: NOT_FOUND`

Check the Vercel project settings:

- Root Directory must be `maintainpro`, or the repository root must use the provided root `vercel.json`.
- Build Command must be `npm run vercel:build`.
- Output Directory must be `apps/web/.next`.

### Render build fails with `failed to read dockerfile`

Render is currently running the service in Docker mode and looking for a repository-root `Dockerfile`.

- This repository now includes a root `Dockerfile` that builds and starts the backend from `maintainpro/apps/api`.
- If you prefer non-Docker deployment, set Render service runtime to `Node`.
- Root Directory: `maintainpro`
- Build Command: `npm install && npm run render:build`
- Start Command: `npm run render:start`

### Browser shows API network errors

Check Vercel environment variables:

- `NEXT_PUBLIC_API_URL` must be the Render API URL ending in `/api`.
- Redeploy Vercel after editing environment variables.
- Free Render services can sleep; the first request may take time to wake up.

### CORS blocked by browser

Check Render environment variables:

- `CORS_ORIGIN` must exactly match the Vercel app origin.
- `FRONTEND_URL` must exactly match the Vercel app origin.
- Do not include a trailing slash.

### API health is degraded

Open `https://your-render-api.onrender.com/health`.

- If database is degraded, verify Atlas credentials and Network Access.
- If readiness shows Redis, SMTP, or storage degraded, configure those optional providers or keep them disabled during low-cost trials.

### Prisma or MongoDB connection errors

- Confirm the Atlas URI contains the database name after the host.
- Confirm username/password are URL encoded if they contain special characters.
- Confirm Atlas Network Access allows Render.
- Confirm both `MONGODB_URI` and `DATABASE_URL` are present during Render build and runtime and point to the same MongoDB database.
- Confirm schema rollout used `npm run db:push`, not SQL migration commands.

### Uploaded files disappear

Render free disk is ephemeral. Configure Cloudinary for persistent uploads before using asset document upload features in production.

## 8. Render API Deploy Trigger (Optional)

Use this only if you want to trigger Render deploys from your local terminal via API.

1. Copy `.env.render.local.example` to `.env.render.local` in `maintainpro/`.
2. Set `RENDER_API_KEY` and `RENDER_SERVICE_ID` in `.env.render.local`.
3. Run `npm run render:deploy:dry` to validate the key and target service.
4. Run `npm run render:deploy` to trigger a deployment.

`RENDER_API_KEY` is sensitive. Keep it only in local ignored files or your secret manager.

## 9. Secret Safety

Never commit real `.env` files. This repo ignores local env files and includes only `.env.example` templates. If a real credential has ever been used in a local file or terminal output, rotate it before production deployment.
