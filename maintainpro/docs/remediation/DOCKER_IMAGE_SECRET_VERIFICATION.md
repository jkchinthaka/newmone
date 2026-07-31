# Docker Image Secret Path Verification Plan (DEPLOY-CONFIG-002)

**Goal:** Prove disposable API/Web images do not contain real env or private-key **paths**.  
**Rule:** Inspect filenames only. Never search for or print secret **values**.

## Commands (CI / local disposable tags)

```powershell
cd maintainpro

docker compose --env-file .env.compose-ci -f docker-compose.yml config --quiet

docker build -f apps/api/Dockerfile --target production -t maintainpro-api:secretcheck .
docker build -f apps/web/Dockerfile --target production -t maintainpro-web:secretcheck .

node scripts/validate-image-secret-paths.mjs maintainpro-api:secretcheck maintainpro-web:secretcheck
```

Forbidden paths (examples): `.env`, `.env.local`, `.env.production`, `*.pem`, `*.key`, `*.pfx`, `*.p12`, `*-credentials.json`.

Allowed if present: `.env.example`, `.env.compose-ci` (placeholders only).

## Pass criteria

Script exits 0 and prints `PASS DEPLOY-CONFIG-002` for each image.

## Notes

- Do not start production containers for this check.
- Do not mount the real production `.env` into the build.
- Rebuild without cache after `.dockerignore` changes when validating a prior leak concern.