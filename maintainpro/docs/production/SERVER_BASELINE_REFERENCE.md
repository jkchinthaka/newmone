# Nelna Server Baseline Reference (safe metadata only)

**Purpose:** Prevent unsafe Git/Compose operations against the live Nelna host.  
**Mutation:** none by this document.

## Verified topology (summary)

| Component | Binding / note |
| --- | --- |
| Public edge | Nginx — `0.0.0.0:80` |
| API | Internal `3000` |
| Web | Internal `3001` |
| MaintainPro Mongo | Host `127.0.0.1:27018` |
| Company Mongo | Host `127.0.0.1:27017` (`bileeta_db`) — **DO NOT TOUCH** |
| MinIO | Host `127.0.0.1:9000-9001` |
| Redis | Docker-internal |
| Airflow | Port `8080` — do not reuse/modify |
| Project path | `C:\Apps\newmone\maintainpro` |
| Compose project | `maintainpro` |

Private snapshot path (do not commit contents):

`C:\Apps\MaintainPro-Private\server-state-20260802-091642`

## Server-specific files that must be preserved

The live server repository contains server-specific modifications and untracked operational overrides. Future deployment **must not** blindly run:

- `git pull`
- `git checkout`
- `git restore`
- `git reset --hard`
- `git clean -fd`

Preserve at minimum:

- `.env` (never commit)
- `docker-compose.yml` server changes
- `docker-compose.mongo-keyfile.yml`
- `docker-compose.override.yml`
- `infra/nginx/default.conf`
- Mongo data volume
- Mongo keyfile volume
- Redis data volume
- MinIO data volume

## Critical volumes (names only)

- `maintainpro_maintainpro-mongo-data`
- `maintainpro_mongo-keyfile`
- `f4e30782cbc2b38ede041d50e5b61e223637b29262945eafb5bffd30d5cc9580`
- `maintainpro_maintainpro-redis-data`
- `maintainpro_maintainpro-minio-data`

## Prohibited commands (never run on Nelna for MaintainPro)

- `docker compose down -v`
- `docker compose down --volumes`
- `docker volume rm`
- `docker volume prune`
- `docker system prune`
- `prisma migrate reset`
- `prisma db push --accept-data-loss`
- `mongorestore --drop`
- any database drop/reset against MaintainPro or company Mongo

Allowed disposable E2E cleanup pattern (CI / local E2E only — not Nelna production):

`docker compose -p "$COMPOSE_PROJECT_NAME" --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml down --remove-orphans`