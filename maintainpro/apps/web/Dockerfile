FROM node:20-alpine AS base
WORKDIR /workspace
RUN apk add --no-cache libc6-compat

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui-components/package.json packages/ui-components/package.json

RUN npm ci

COPY . .

FROM base AS dev
WORKDIR /workspace
EXPOSE 3001
CMD ["npm", "run", "dev", "--workspace", "@maintainpro/web"]

FROM base AS build
WORKDIR /workspace
# Next.js inlines NEXT_PUBLIC_* at build time. CI/image builds must supply values
# (override via --build-arg in deploy pipelines). No silent production host fallback.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN \
    NEXT_PUBLIC_USE_BFF=true
RUN npm run build --workspace @maintainpro/shared-types && npm run build --workspace @maintainpro/web

FROM node:20-alpine AS production
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/web ./apps/web
COPY --from=build /workspace/packages/shared-types ./packages/shared-types
# Node-based healthcheck — no wget/curl dependency
COPY scripts/container-http-healthcheck.cjs /usr/local/bin/container-http-healthcheck.cjs

EXPOSE 3001
WORKDIR /workspace/apps/web
CMD ["npm", "run", "start"]
