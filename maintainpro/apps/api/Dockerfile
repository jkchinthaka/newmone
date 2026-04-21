FROM node:20-alpine AS base
WORKDIR /workspace
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui-components/package.json packages/ui-components/package.json

RUN npm ci

COPY . .
RUN npm run db:generate

FROM base AS dev
WORKDIR /workspace
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace", "@maintainpro/api"]

FROM base AS build
WORKDIR /workspace
RUN npm run build --workspace @maintainpro/shared-types && npm run build --workspace @maintainpro/api

FROM node:20-alpine AS production
WORKDIR /workspace
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/packages/shared-types ./packages/shared-types
COPY --from=build /workspace/prisma ./prisma

EXPOSE 3000
WORKDIR /workspace/apps/api
CMD ["node", "dist/main.js"]
