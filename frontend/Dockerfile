# AeroScript web app: build the Angular production bundle, serve it with unprivileged nginx.
#
#   docker build -t aeroscript-web frontend
#   docker run -p 8080:8080 -e API_UPSTREAM=http://api:5000 aeroscript-web

# --- build ---
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
RUN npx ng build --configuration production

# --- runtime ---
# nginx-unprivileged runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Where /api and /uploads are proxied: the API service as the *container network* sees it
# (e.g. http://api:5000 in docker compose), never localhost.
ENV API_UPSTREAM=http://api:5000

# The official image renders /etc/nginx/templates/*.template with envsubst at start-up.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ecommerce-admin-ui/browser /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
