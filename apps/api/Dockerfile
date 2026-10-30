# Build context is the REPO ROOT (npm workspaces need the root lockfile).
#   docker build -f apps/api/Dockerfile .
# Railway builds the last stage (prod). docker-compose targets the dev stage.

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared ./packages/shared

# ---- dev: source is bind-mounted by docker-compose, node --watch reloads ----
FROM base AS dev
RUN npm ci --workspace=api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["npm", "run", "dev"]

# ---- prod: what Railway runs ----
FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --workspace=api --omit=dev && npm cache clean --force
COPY apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "src/server.js"]
