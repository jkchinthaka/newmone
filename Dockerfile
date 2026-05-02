FROM node:20-alpine AS base
WORKDIR /workspace
RUN apk add --no-cache libc6-compat openssl

WORKDIR /workspace/maintainpro
COPY maintainpro/package*.json ./
COPY maintainpro/apps/api/package.json apps/api/package.json
COPY maintainpro/apps/web/package.json apps/web/package.json
COPY maintainpro/packages/shared-types/package.json packages/shared-types/package.json
COPY maintainpro/packages/ui-components/package.json packages/ui-components/package.json

RUN npm ci

COPY maintainpro/ ./
RUN npm run db:generate
RUN npm run build --workspace @maintainpro/shared-types && npm run build --workspace @maintainpro/api

FROM node:20-alpine AS production
WORKDIR /workspace
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --from=base /workspace/maintainpro/node_modules ./node_modules
COPY --from=base /workspace/maintainpro/apps/api/dist ./apps/api/dist
COPY --from=base /workspace/maintainpro/apps/api/package.json ./apps/api/package.json
COPY --from=base /workspace/maintainpro/packages/shared-types ./packages/shared-types
COPY --from=base /workspace/maintainpro/prisma ./prisma

EXPOSE 3000
WORKDIR /workspace/apps/api
CMD ["node", "dist/main.js"]
