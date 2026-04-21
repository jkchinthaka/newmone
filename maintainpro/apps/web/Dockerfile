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
RUN npm run build --workspace @maintainpro/shared-types && npm run build --workspace @maintainpro/web

FROM node:20-alpine AS production
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/web ./apps/web
COPY --from=build /workspace/packages/shared-types ./packages/shared-types

EXPOSE 3001
WORKDIR /workspace/apps/web
CMD ["npm", "run", "start"]
