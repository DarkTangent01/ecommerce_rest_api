# --- build: compile TypeScript ---
# Needs the dev toolchain, which requires a newer Node than the app (vitest 5, eslint 10).
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

# --- runtime: production dependencies + compiled output only ---
# Same major as the build stage: yarn v1 checks every lockfile package's engines even for a
# --production install, so a Node 20 runtime is refused because of vitest 5.
FROM node:24-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
# Listen on all container interfaces (the app now honours APP_IP_ADDRESS). Behind a reverse proxy,
# also set TRUST_PROXY to its address or hop count; it defaults to off.
ENV APP_IP_ADDRESS=0.0.0.0
EXPOSE 5000

RUN mkdir -p uploads logs && addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.APP_PORT || 5000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
