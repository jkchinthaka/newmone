# MaintainPro Monorepo

MaintainPro is a CMMS platform structured as a production-ready monorepo with API, web, mobile, and shared type packages.

## Stack

- API: Node.js + Express + TypeScript + Prisma
- Web: React 18 + Vite + TypeScript + TailwindCSS + shadcn-style UI patterns
- Mobile: Flutter (iOS + Android structure)
- Shared package: TypeScript domain contracts used by API and web
- Dev infra: Docker Compose (API, worker, PostgreSQL, Redis, pgAdmin)

## Monorepo Layout

```text
maintainpro/
├── apps/
│   ├── api/
│   ├── web/
│   └── mobile/
├── packages/
│   └── shared-types/
├── docker-compose.yml
├── .env.example
├── .github/workflows/ci.yml
└── README.md
```

## Quick Start

1. Copy environment template:

   ```bash
   cp .env.example .env
   ```

2. Install monorepo dependencies:

   ```bash
   npm install
   ```

3. Start backend and infrastructure with Docker:

   ```bash
   docker compose up --build
   ```

4. Run web and api in local Node mode (optional alternative to Docker API):

   ```bash
   npm run dev
   ```

## Key Commands

- `npm run dev` runs API and web in parallel.
- `npm run build` builds shared-types, API, and web.
- `npm run typecheck` runs strict type checks for API and web.
- `npm run docker:up` starts local services from compose.
- `npm run docker:down` stops local services.

## API Endpoints (starter)

- Health: `GET /health`
- Swagger docs: `GET /api-docs`
- Auth: `/api/v1/auth/*`
- Assets: `/api/v1/assets`
- Work Orders: `/api/v1/work-orders`
- Inventory: `/api/v1/inventory`
- Dashboard: `/api/v1/dashboard/overview`
- Notifications: `/api/v1/notifications/send`
- Reports: `/api/v1/reports/*`

## Local Demo Credentials

- Email: `admin@maintainpro.local`
- Password: `Admin@1234`

## Notes

- The API validates all required environment variables at startup via Zod.
- Redis and PostgreSQL health checks are enforced in Docker Compose.
- Worker service consumes BullMQ queues from Redis and runs report/email jobs.
- `packages/shared-types` is imported by API/web through workspace dependency links.
