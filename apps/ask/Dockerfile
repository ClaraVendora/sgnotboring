# AI search service (no tables).
# Build context is the REPO ROOT (npm workspaces need the root lockfile).
#   docker build -f apps/ask/Dockerfile .
# Railway builds the last stage (prod). docker-compose targets the dev stage.

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/gateway/package.json apps/gateway/
COPY apps/places/package.json apps/places/
COPY apps/ask/package.json apps/ask/
COPY apps/accounts/package.json apps/accounts/
COPY apps/community/package.json apps/community/
COPY apps/web/package.json apps/web/
COPY packages/shared ./packages/shared
COPY packages/service-kit ./packages/service-kit

# ---- dev: source is bind-mounted by docker-compose, node --watch reloads ----
FROM base AS dev
RUN npm ci --workspace=ask
WORKDIR /app/apps/ask
EXPOSE 3012
CMD ["npm", "run", "dev"]

# ---- prod: what Railway runs ----
FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --workspace=ask --omit=dev && npm cache clean --force
COPY apps/ask ./apps/ask
WORKDIR /app/apps/ask
EXPOSE 3012
CMD ["node", "src/server.js"]
