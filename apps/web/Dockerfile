# Build context is the REPO ROOT (npm workspaces need the root lockfile).
#   docker build -f apps/web/Dockerfile .
# Railway builds the last stage (prod). docker-compose targets the dev stage.

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# ---- dev: source is bind-mounted by docker-compose, Vite HMR ----
FROM base AS dev
RUN npm ci --workspace=web
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host"]

# ---- build: Vite bakes VITE_* vars in at build time. Railway passes service
#      variables as build args as long as they are declared with ARG here. ----
FROM base AS build
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm ci --workspace=web
COPY apps/web ./apps/web
RUN npm run build --workspace=web

# ---- prod: static files served by nginx on $PORT (Railway injects PORT) ----
FROM nginx:1.27-alpine AS prod
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
ENV PORT=3000
EXPOSE 3000
